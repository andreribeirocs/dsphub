import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface ResolvedTenant {
  organizationId: string;
  domain: string;
}

const CACHE_TTL_MS = 60_000;

/** Lowercase hostname without port or trailing dot */
export function normalizeHost(host: string | undefined): string | null {
  if (!host) return null;
  const withoutPort = host.trim().toLowerCase().replace(/:\d+$/, "");
  const cleaned = withoutPort.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  return cleaned || null;
}

/**
 * Maps the request host to a DSP organization using the organization_domain
 * table. Only active organizations resolve.
 */
@Injectable()
export class TenantResolverService {
  private readonly logger = new Logger(TenantResolverService.name);
  private readonly cache = new Map<
    string,
    { tenant: ResolvedTenant | null; expiresAt: number }
  >();

  constructor(private readonly prisma: PrismaService) {}

  async resolveByHost(host: string | undefined): Promise<ResolvedTenant | null> {
    const domain = normalizeHost(host);
    if (!domain) return null;

    const cached = this.cache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    // organization_domain and organization are not tenant-scoped models
    const record = await this.prisma.organizationDomain.findUnique({
      where: { domain },
      select: {
        organizationId: true,
        organization: { select: { isActive: true } },
      },
    });

    const tenant =
      record && record.organization.isActive
        ? { organizationId: record.organizationId, domain }
        : null;

    if (!tenant) {
      this.logger.warn(`No active organization for host "${domain}"`);
    }

    this.cache.set(domain, { tenant, expiresAt: Date.now() + CACHE_TTL_MS });
    return tenant;
  }

  /** Used by better-auth to accept requests coming from DSP domains */
  async isKnownOrigin(origin: string | undefined | null): Promise<boolean> {
    if (!origin) return false;
    try {
      const { hostname } = new URL(origin);
      return (await this.resolveByHost(hostname)) !== null;
    } catch {
      return false;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
