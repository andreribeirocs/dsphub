import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { BetterAuthService } from "../../auth/better-auth.service";

@Injectable()
export class OrganizationMiddleware implements NestMiddleware {
  constructor(private betterAuthService: BetterAuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Extract subdomain from hostname
    const hostname = req.hostname;
    const subdomain = this.extractSubdomain(hostname);

    if (subdomain && subdomain !== "www" && subdomain !== "api") {
      // Look up organization by subdomain (slug)
      const organization =
        await this.betterAuthService.getOrganizationBySlug(subdomain);

      if (organization) {
        req["organizationId"] = organization.id;
        req["organization"] = organization;
        req["subdomain"] = subdomain;
      }
    }

    next();
  }

  private extractSubdomain(hostname: string): string | null {
    // Handle localhost development
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return null;
    }

    const parts = hostname.split(".");

    // For production: companyA.dsphub.com -> ["companyA", "dsphub", "com"]
    if (parts.length >= 3) {
      return parts[0];
    }

    // For development with custom hosts: companyA.local -> ["companyA", "local"]
    if (parts.length === 2 && parts[1] === "local") {
      return parts[0];
    }

    return null;
  }
}
