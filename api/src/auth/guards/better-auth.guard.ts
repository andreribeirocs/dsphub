import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from "@nestjs/common";
import { TenantContext } from "../../tenancy/tenant-context";
import { BetterAuthService, SessionData } from "../better-auth.service";
import type { Request } from "express";

// Extend Express Request to include our custom properties
interface AuthenticatedRequest extends Request {
  user: SessionData["user"];
  session: SessionData["session"];
  userId: string;
  organizationId?: string;
  tenant?: { organizationId: string; domain: string };
}

@Injectable()
export class BetterAuthGuard implements CanActivate {
  constructor(private betterAuthService: BetterAuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("No session token provided");
    }

    const sessionData = await this.betterAuthService.validateSession(token);

    if (!sessionData) {
      throw new UnauthorizedException("Invalid or expired session");
    }

    // Check if user is active
    if (sessionData.user.status !== "ACTIVE") {
      throw new UnauthorizedException("User account is not active");
    }

    // The organization comes from the domain (TenantMiddleware), never from
    // the client. The user must belong to it; SUPER_ADMIN may access any DSP.
    const tenant = request.tenant;
    if (!tenant || TenantContext.getOrganizationId() !== tenant.organizationId) {
      throw new ForbiddenException("Organization could not be determined");
    }

    const isSuperAdmin = sessionData.user.role === "SUPER_ADMIN";
    if (
      !isSuperAdmin &&
      !(await this.betterAuthService.hasOrganizationAccess(
        sessionData.user.id,
        tenant.organizationId
      ))
    ) {
      throw new ForbiddenException(
        "You do not have access to this organization"
      );
    }

    // Managers can be limited to some depots; leaders see every depot
    const seesAllDepots = ["SUPER_ADMIN", "OWNER", "DIRECTOR"].includes(
      sessionData.user.role
    );
    const depotIds = seesAllDepots
      ? []
      : await this.betterAuthService.getMemberDepotIds(
          sessionData.user.id,
          tenant.organizationId
        );
    TenantContext.setDepotScope(depotIds.length > 0 ? depotIds : null);

    // Attach user and session to request
    request.user = sessionData.user;
    request.session = sessionData.session;
    request.userId = sessionData.user.id;
    request.organizationId = tenant.organizationId;

    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    // Try Authorization header first
    const authHeader = request.headers.authorization;
    if (
      authHeader &&
      typeof authHeader === "string" &&
      authHeader.startsWith("Bearer ")
    ) {
      return authHeader.substring(7);
    }

    // Try cookie (cookies property is added by cookie-parser middleware)
    // We need to access cookies which may not be in the base Request type
    const requestWithCookies = request as unknown as {
      cookies?: Record<string, string>;
    };

    if (requestWithCookies.cookies) {
      const betterAuthToken =
        requestWithCookies.cookies["better-auth.session_token"];
      const sessionToken = requestWithCookies.cookies["session_token"];
      const cookieToken = betterAuthToken || sessionToken;

      if (cookieToken && typeof cookieToken === "string") {
        // Better Auth cookie format is: {token}.{signature}
        // We only need the token part (before the dot) to query the database
        const tokenPart = cookieToken.split(".")[0];
        return tokenPart;
      }
    }

    return null;
  }
}
