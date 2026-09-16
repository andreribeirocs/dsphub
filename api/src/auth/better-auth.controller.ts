import { All, Controller, Req, Res } from "@nestjs/common";
import { auth } from "./better-auth.config";
import type { Request, Response } from "express";
import { toNodeHandler } from "better-auth/node";

@Controller("auth")
export class BetterAuthController {
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
    // Use Better Auth's Node.js adapter for Express
    // toNodeHandler returns a handler function that we need to await
    await toNodeHandler(auth)(req, res);
  }
}
