import {
  Controller,
  Post,
  Body,
  HttpCode,
  UseGuards,
  Get,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: 'Login to the system' })
  @ApiResponse({
    status: 200,
    description: 'User successfully logged in and token generated.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  async login(@Request() req, @Body() loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  @ApiOperation({ summary: 'Refresh authentication token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully.' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token.' })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.token);
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return req.user;
  }
}
