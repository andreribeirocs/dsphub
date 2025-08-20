import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Get,
  Request,
  Param,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
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

// Define interfaces for request objects
interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
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
  getProfile(
    @Request() req: AuthenticatedRequest
  ): AuthenticatedRequest["user"] {
    return req.user;
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
}
