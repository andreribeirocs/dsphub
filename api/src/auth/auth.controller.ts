import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Get,
  Request,
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
}
