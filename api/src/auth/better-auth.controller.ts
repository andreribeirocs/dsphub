import { All, Controller, Req, Res } from "@nestjs/common";
import { auth } from "./better-auth.config";
import type { Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";
import { AuditService } from "../audit/audit.service";
import type { TenantRequest } from "../tenancy/tenant.middleware";

const SIGN_IN_PATH = /\/sign-in\/email\/?$/;

@Controller("auth")
export class BetterAuthController {
  private readonly handler = toNodeHandler(auth);

  constructor(private readonly auditService: AuditService) {}

  /**
   * Handle all Better Auth routes
   * Better Auth provides built-in endpoints for:
   * - POST /api/auth/sign-in/email
   * - POST /api/auth/sign-out
   * - GET /api/auth/session
   * - POST /api/auth/organization/create
   * - POST /api/auth/organization/add-member
   * - etc.
   */
  // NestJS 11 / path-to-regexp v8: wildcards must be named ("*" alone triggers a warning)
  @All("*path")
  async handleAuth(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (req.method === "POST" && SIGN_IN_PATH.test(req.path)) {
      this.auditSignIn(req, res);
    }
    await this.handler(req, res);
  }

  /** Record every email sign-in attempt for the DSP of the domain (audit logs) */
  private auditSignIn(req: Request, res: Response) {
    const email = typeof req.body?.email === "string" ? req.body.email : "";
    if (!email) {
      return;
    }
    const organizationId = (req as TenantRequest).tenant?.organizationId;
    res.once("finish", () => {
      void this.auditService.recordSignIn({
        email,
        success: res.statusCode >= 200 && res.statusCode < 300,
        organizationId,
        ipAddress: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
      });
    });
  }
}
