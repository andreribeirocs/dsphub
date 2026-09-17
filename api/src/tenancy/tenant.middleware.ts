import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { TenantContext } from "./tenant-context";
import { TenantResolverService } from "./tenant-resolver.service";

/** Routes that work without an organization (no DSP data involved) */
const TENANT_FREE_PATHS = [/^\/api\/?$/, /^\/api\/health(\/|$)/];

export interface TenantRequest extends Request {
  tenant?: { organizationId: string; domain: string };
}

/**
 * Resolves the DSP from the host the request arrived on and runs the rest of
 * the request inside that organization's TenantContext.
 *
 * Behind a reverse proxy set TRUST_PROXY=true so req.hostname uses
 * X-Forwarded-Host.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly resolver: TenantResolverService) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    const path = req.originalUrl.split("?")[0];
    const tenant = await this.resolver.resolveByHost(req.hostname);

    if (!tenant) {
      if (TENANT_FREE_PATHS.some((pattern) => pattern.test(path))) {
        return next();
      }
      res.status(404).json({
        statusCode: 404,
        message: "This domain is not linked to any organization",
        error: "Not Found",
      });
      return;
    }

    req.tenant = tenant;
    TenantContext.run(
      { organizationId: tenant.organizationId, domain: tenant.domain },
      () => next()
    );
  }
}
