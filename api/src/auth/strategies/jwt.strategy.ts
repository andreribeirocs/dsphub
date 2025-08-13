import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../../users/users.service";
import { SessionService } from "../services/session.service";

interface JwtPayload {
  readonly sub: string;
  readonly jti?: string;
  readonly sessionId?: string;
  readonly type?: string;
  readonly iat?: number;
  readonly exp?: number;
}

interface ValidatedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly sessionService: SessionService
  ) {
    const jwtSecret = configService.get<string>("JWT_SECRET");

    if (!jwtSecret) {
      throw new Error("JWT_SECRET is not defined in the environment variables");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validate JWT payload and return user object
   * @param payload - JWT payload containing user ID
   * @returns Validated user object
   * @throws UnauthorizedException if validation fails
   */
  async validate(payload: JwtPayload): Promise<ValidatedUser> {
    try {
      this.logger.debug(`JWT payload received for user: ${payload.sub}`);

      if (!payload.sub) {
        this.logger.error("No user ID (sub) found in JWT payload");
        throw new UnauthorizedException("Invalid token payload");
      }

      // Check if token is revoked (if JTI is present)
      if (payload.jti) {
        const token = this.extractTokenFromRequest();
        if (token && (await this.sessionService.isTokenRevoked(token))) {
          this.logger.warn(`Revoked token attempted: ${payload.jti}`);
          throw new UnauthorizedException("Token has been revoked");
        }
      }

      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        this.logger.error(`User not found for ID: ${payload.sub}`);
        throw new UnauthorizedException("User not found");
      }

      // Check user status
      if (user.status !== "ACTIVE") {
        this.logger.warn(`Inactive user attempted access: ${user.email}`);
        throw new UnauthorizedException("User account is not active");
      }

      this.logger.debug(`User validated successfully: ${user.email}`);

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Error in JWT validation: ${errorMessage}`);
      throw new UnauthorizedException("Token validation failed");
    }
  }

  /**
   * Extract the actual JWT token from the request context
   * This is needed for token revocation checking
   */
  private extractTokenFromRequest(): string | null {
    // This is a simplified implementation
    // In a real scenario, you might need to access the request context
    return null;
  }
}
