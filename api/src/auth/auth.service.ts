import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { WhatsAppService } from "../whatsapp/whatsapp.service";
import { ConfigService } from "@nestjs/config";
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
    private readonly usersService: UsersService,
    private readonly whatsAppService: WhatsAppService,
    private readonly configService: ConfigService
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
   * Generate password reset token and send reset link via WhatsApp
   * @param phoneNumber - User phone number
   * @returns Success message
   */
  async forgotPassword(phoneNumber: string): Promise<{ message: string }> {
    // Find user by phone number
    const user = await this.prisma.user.findFirst({
      where: { phoneNumber },
    });

    if (!user) {
      // For security, don't reveal if phone number exists or not
      return {
        message:
          "If the phone number exists, you will receive a password reset link via WhatsApp shortly.",
      };
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY);

    // Store the reset token in the database
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: `reset:${resetToken}:${resetTokenExpiry.getTime()}`,
      },
    });

    // Generate reset link
    const frontendUrl =
      this.configService.get<string>("FRONTEND_URL") || "http://localhost:4200";
    const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send WhatsApp message with reset link
    const message = `Hello ${user.name},\n\nYou requested a password reset for your DSPHub account.\n\nClick the link below to reset your password:\n${resetLink}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this message.`;

    try {
      await this.whatsAppService.sendMessage({
        to: phoneNumber,
        body: message,
      });
    } catch (error) {
      console.error("Failed to send WhatsApp message:", error);
      // Still return success for security reasons
    }

    return {
      message:
        "If the phone number exists, you will receive a password reset link via WhatsApp shortly.",
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

  /**
   * Upload and save user avatar
   * @param userId - User ID
   * @param avatarBase64 - Base64 encoded avatar
   * @returns Success message with avatar data
   */
  async uploadAvatar(
    userId: string,
    avatarBase64: string
  ): Promise<{ message: string; avatar: string }> {
    try {
      // Update user avatar in database
      await this.prisma.user.update({
        where: { id: userId },
        data: { avatar: avatarBase64 },
        select: { avatar: true },
      });

      return {
        message: "Avatar uploaded successfully",
        avatar: avatarBase64,
      };
    } catch (error) {
      throw new BadRequestException(error, "Failed to save avatar");
    }
  }

  /**
   * Get user profile with avatar
   * @param userId - User ID
   * @returns User profile including avatar
   */
  async getUserProfile(
    userId: string
  ): Promise<ValidatedUser & { avatar?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Convert Prisma result to proper return type
    const { id, email, name, role, avatar: userAvatar } = user;

    const processedAvatar = userAvatar ? userAvatar : undefined;

    return {
      id,
      email,
      name,
      role,
      avatar: processedAvatar,
    };
  }
}
