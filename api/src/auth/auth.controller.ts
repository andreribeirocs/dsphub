import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Get,
  Request,
  Param,
  Patch,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import {
  ThrottleAuth,
  ThrottleStrict,
  ThrottleModerate,
  ThrottleRelaxed,
} from "./decorators/throttle.decorator";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { FileInterceptor } from "@nestjs/platform-express";
import { IMAGE_UPLOAD_CONFIG } from "src/shared/config/multer.config";
import { SecureErrorUtil } from "../shared/utils/secure-error.util";

// Define interfaces for request objects
interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

interface ValidatedUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: string;
}

interface LoginResponse {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Authenticate user and generate tokens
   * @param req - Request object with user data from LocalAuthGuard
   * @param _loginDto - Login credentials (validated by guard)
   * @returns Authentication tokens and user data
   */
  @ApiOperation({ summary: "Login to the system" })
  @ApiResponse({
    status: 200,
    description: "User successfully logged in and token generated.",
  })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 429, description: "Too many requests." })
  @ThrottleAuth()
  @UseGuards(LocalAuthGuard)
  @Post("login")
  @HttpCode(200)
  async login(@Request() req: AuthenticatedRequest): Promise<LoginResponse> {
    return this.authService.login(req.user);
  }

  /**
   * Refresh authentication token
   * @param refreshTokenDto - Refresh token data
   * @returns New authentication tokens and user data
   */
  @ApiOperation({ summary: "Refresh authentication token" })
  @ApiResponse({ status: 200, description: "Token refreshed successfully." })
  @ApiResponse({ status: 401, description: "Invalid refresh token." })
  @ApiResponse({ status: 429, description: "Too many requests." })
  @ThrottleStrict()
  @Post("refresh")
  @HttpCode(200)
  async refresh(
    @Body() refreshTokenDto: RefreshTokenDto
  ): Promise<LoginResponse> {
    return this.authService.refreshToken(refreshTokenDto.token);
  }

  /**
   * Get current user profile
   * @param req - Request object with user data from JwtAuthGuard
   * @returns Current user profile
   */
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({ status: 200, description: "Profile retrieved successfully." })
  @ApiResponse({ status: 401, description: "Unauthorized." })
  @ApiResponse({ status: 429, description: "Too many requests." })
  @ThrottleRelaxed()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("profile")
  async getProfile(
    @Request() req: AuthenticatedRequest
  ): Promise<ValidatedUser & { avatar?: string }> {
    return await this.authService.getUserProfile(req.user.id);
  }

  /**
   * Request password reset
   * @param forgotPasswordDto - Email for password reset
   * @returns Success message
   */
  @ApiOperation({
    summary: "Request password reset",
    description:
      "Send a password reset link to the user's email address. For security, always returns success regardless of whether email exists.",
  })
  @ApiResponse({
    status: 200,
    description: "Password reset email sent (if email exists)",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example:
            "If the email exists, you will receive a password reset link shortly.",
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid email format" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  @ThrottleStrict()
  @Post("forgot-password")
  @HttpCode(200)
  async forgotPassword(
    @Body() forgotPasswordDto: ForgotPasswordDto
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  /**
   * Verify password reset token
   * @param token - Reset token from URL
   * @returns Token validity status
   */
  @ApiOperation({
    summary: "Verify password reset token",
    description: "Check if a password reset token is valid and not expired.",
  })
  @ApiResponse({
    status: 200,
    description: "Token validity status",
    schema: {
      type: "object",
      properties: {
        valid: { type: "boolean", example: true },
        message: { type: "string", example: "Token is valid" },
      },
    },
  })
  @ApiResponse({ status: 429, description: "Too many requests" })
  @ThrottleModerate()
  @Get("verify-reset-token/:token")
  async verifyResetToken(
    @Param("token") token: string
  ): Promise<{ valid: boolean; message?: string }> {
    return this.authService.verifyResetToken(token);
  }

  /**
   * Reset password using token
   * @param resetPasswordDto - Reset token and new password
   * @returns Success message
   */
  @ApiOperation({
    summary: "Reset password",
    description:
      "Reset user password using a valid reset token received via email.",
  })
  @ApiResponse({
    status: 200,
    description: "Password reset successfully",
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          example: "Password has been reset successfully",
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid or expired token" })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  @ThrottleStrict()
  @Post("reset-password")
  @HttpCode(200)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword
    );
  }

  /**
   * Upload user avatar
   * @param req - Request object with user data from JwtAuthGuard
   * @param file - Avatar image file
   * @returns Success message with avatar data
   */
  @ApiOperation({ summary: "Upload user avatar" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        avatar: {
          type: "string",
          format: "binary",
          description: "Avatar image file (JPEG, PNG, GIF, max 5MB)",
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Avatar uploaded successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
        avatar: { type: "string", description: "Base64 encoded avatar" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid file or processing error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 413, description: "File too large" })
  @ApiResponse({ status: 415, description: "Unsupported file type" })
  @ApiResponse({ status: 429, description: "Too many requests" })
  @ThrottleRelaxed()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("avatar", IMAGE_UPLOAD_CONFIG))
  @Patch("avatar")
  async uploadAvatar(
    @Request() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File
  ): Promise<{ message: string; avatar: string }> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new BadRequestException("File size too large. Maximum size is 5MB");
    }

    // Validate file type
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        "Invalid file type. Only JPEG, PNG, and GIF are allowed"
      );
    }

    try {
      // Convert file buffer to base64
      let base64Avatar: string;
      if (Buffer.isBuffer(file.buffer)) {
        base64Avatar = file.buffer.toString("base64");
      } else {
        // If it's not a buffer, try to create one
        base64Avatar = Buffer.from(file.buffer).toString("base64");
      }

      const dataUrl = `data:${file.mimetype};base64,${base64Avatar}`;

      // Save avatar to database
      const result = await this.authService.uploadAvatar(req.user.id, dataUrl);

      return result;
    } catch (error) {
      throw SecureErrorUtil.handleFileProcessingError(
        error,
        "Avatar processing"
      );
    }
  }
}
