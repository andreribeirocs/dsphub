import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";

// Constants
const REFRESH_TOKEN_EXPIRY = "7d";
const PASSWORD_RESET_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour in milliseconds
const BCRYPT_ROUNDS = 10;

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

  /**
   * Generate password reset token and send reset email
   * @param email - User email address
   * @returns Success message
   * @throws NotFoundException if user not found
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      // For security, don't reveal if email exists or not
      return {
        message:
          "If the email exists, you will receive a password reset link shortly.",
      };
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY);

    // Store the reset token in the database
    // Note: In a real implementation, you might want a separate table for reset tokens
    // For now, we'll use a simple approach with the refresh token field
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: `reset:${resetToken}:${resetTokenExpiry.getTime()}`,
      },
    });

    // TODO: Send email with reset link
    // In a real implementation, you would integrate with an email service here
    // For now, we'll just log the token (remove this in production)
    console.log(`Password reset token for ${email}: ${resetToken}`);
    console.log(
      `Reset link: ${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`
    );

    return {
      message:
        "If the email exists, you will receive a password reset link shortly.",
    };
  }

  /**
   * Verify if a password reset token is valid
   * @param token - Reset token
   * @returns Token validity status
   */
  async verifyResetToken(
    token: string
  ): Promise<{ valid: boolean; message?: string }> {
    try {
      // Find user with the reset token
      const user = await this.prisma.user.findFirst({
        where: {
          refreshToken: {
            startsWith: `reset:${token}:`,
          },
        },
      });

      if (!user || !user.refreshToken) {
        return { valid: false, message: "Invalid or expired reset token" };
      }

      // Extract expiry time from the token
      const tokenData = user.refreshToken.split(":");
      if (tokenData.length !== 3 || tokenData[0] !== "reset") {
        return { valid: false, message: "Invalid token format" };
      }

      const expiryTime = parseInt(tokenData[2]);
      if (Date.now() > expiryTime) {
        // Clean up expired token
        await this.prisma.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
        return { valid: false, message: "Reset token has expired" };
      }

      return { valid: true };
    } catch {
      return { valid: false, message: "Invalid reset token" };
    }
  }

  /**
   * Reset user password using reset token
   * @param token - Reset token
   * @param newPassword - New password
   * @returns Success message
   * @throws BadRequestException if token is invalid
   * @throws NotFoundException if user not found
   */
  async resetPassword(
    token: string,
    newPassword: string
  ): Promise<{ message: string }> {
    // Verify token is valid
    const tokenCheck = await this.verifyResetToken(token);
    if (!tokenCheck.valid) {
      throw new BadRequestException(
        tokenCheck.message || "Invalid reset token"
      );
    }

    // Find user with the reset token
    const user = await this.prisma.user.findFirst({
      where: {
        refreshToken: {
          startsWith: `reset:${token}:`,
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    // Update password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        refreshToken: null, // Clear the reset token
      },
    });

    return { message: "Password has been reset successfully" };
  }
}
