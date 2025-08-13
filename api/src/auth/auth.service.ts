import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import * as bcrypt from "bcrypt";

// Constants
const REFRESH_TOKEN_EXPIRY = "7d";

interface ValidatedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
}

interface LoginResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly user: ValidatedUser;
}

interface JwtPayload {
  readonly sub: string;
  readonly iat?: number;
  readonly exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService
  ) {}

  /**
   * Validate user credentials for authentication
   * @param email - User email
   * @param password - User password
   * @returns Validated user object without password or null if invalid
   */
  async validateUser(
    email: string,
    password: string
  ): Promise<ValidatedUser | null> {
    const user = await this.usersService.findByEmail(email);

    if (user && (await bcrypt.compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _, ...result } = user;
      return result;
    }
    return null;
  }

  /**
   * Generate JWT tokens for authenticated user
   * @param user - Validated user object
   * @returns Login response with tokens and user data
   */
  async login(user: ValidatedUser): Promise<LoginResponse> {
    // Security improvement: Only include user ID in JWT payload to hide sensitive information
    // Previously contained: { email: user.email, sub: user.id, role: user.role }
    // Now contains only: { sub: user.id }
    // User details are fetched from database during token validation in JwtStrategy
    const payload: JwtPayload = { sub: user.id };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return {
      access_token: this.jwtService.sign(payload),
      refresh_token: this.jwtService.sign(payload, {
        expiresIn: REFRESH_TOKEN_EXPIRY,
      }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  /**
   * Refresh authentication token using refresh token
   * @param token - Refresh token
   * @returns New login response with fresh tokens
   * @throws UnauthorizedException if token is invalid
   */
  async refreshToken(token: string): Promise<LoginResponse> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const payload = this.jwtService.verify(token);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      return this.login(user);
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
}
