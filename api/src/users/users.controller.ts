import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { AuditService } from "../audit/audit.service";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ThrottleModerate } from "../auth/decorators/throttle.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { Actor } from "./users.service";
import {
  CreateUserDto,
  UpdateUserDto,
  UpdatePasswordDto,
  UpdateStatusDto,
  UpdateOwnProfileDto,
  GetUsersDto,
  UserResponseDto,
  PaginatedUsersResponseDto,
  UserStatsResponseDto,
} from "./dto";

@ApiTags("users")
@Controller("users")
@UseGuards(BetterAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService
  ) {}

  // Declared before the ":id" routes so PATCH /users/avatar is not matched as an id
  /**
   * Upload user avatar
   * @param file - Avatar image file
   * @param user - Current authenticated user
   * @returns Avatar URL
   */
  @ApiOperation({
    summary: "Upload user avatar",
    description: "Upload or update the current user's profile picture",
  })
  @ApiResponse({
    status: 200,
    description: "Avatar uploaded successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", example: "Avatar uploaded successfully" },
        avatar: {
          type: "string",
          example: "/uploads/avatars/avatar-1234567890.jpg",
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Invalid file or file too large" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ThrottleModerate()
  @Patch("avatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      storage: diskStorage({
        destination: "./uploads/avatars",
        filename: (_req, file, callback) => {
          const uniqueSuffix =
            Date.now() + "-" + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `avatar-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return callback(
            new BadRequestException("Only image files are allowed"),
            false
          );
        }
        callback(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    })
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { id: string }
  ): Promise<{ message: string; avatar: string }> {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    const avatarPath = `/api/uploads/avatars/${file.filename}`;

    // Update user's avatar in database
    await this.usersService.updateOwnProfile(user.id, { avatar: avatarPath });

    return {
      message: "Avatar uploaded successfully",
      avatar: avatarPath,
    };
  }

  /**
   * Get all users with filtering and pagination
   * @param filters - Query parameters for filtering and pagination
   * @returns Paginated list of users
   */
  @ApiOperation({
    summary: "Get all users with filtering and pagination",
    description:
      "Retrieve a paginated list of users with optional filtering by role, status, and search term. Only accessible by Directors.",
  })
  @ApiResponse({
    status: 200,
    description: "Users retrieved successfully",
    type: PaginatedUsersResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Directors only" })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search by name or email",
  })
  @ApiQuery({
    name: "role",
    required: false,
    enum: [
      "SUPER_ADMIN",
      "OWNER",
      "DIRECTOR",
      "MANAGER_FINANCIAL",
      "MANAGER_FLEET",
      "MANAGER_ONSITE",
      "MANAGER_RECRUITMENT",
      "DRIVER",
    ],
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: ["ACTIVE", "INACTIVE", "PENDING"],
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 10, max: 100)",
  })
  @ApiQuery({
    name: "sortBy",
    required: false,
    enum: ["name", "email", "role", "status", "createdAt", "lastLogin"],
  })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["asc", "desc"] })
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR")
  @ThrottleModerate()
  @Get()
  async findAll(
    @Query() filters: GetUsersDto
  ): Promise<PaginatedUsersResponseDto> {
    return this.usersService.findAllUsers(filters);
  }

  /**
   * Get user statistics for dashboard
   * @returns User statistics including counts by role and status
   */
  @ApiOperation({
    summary: "Get user statistics",
    description:
      "Retrieve user statistics for admin dashboard including total users, active users, and breakdown by role.",
  })
  @ApiResponse({
    status: 200,
    description: "User statistics retrieved successfully",
    type: UserStatsResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Directors only" })
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR")
  @ThrottleModerate()
  @Get("stats")
  async getStats(): Promise<UserStatsResponseDto> {
    return this.usersService.getUserStats();
  }

  // Declared before ":id" so "me" is not matched as a user id
  @ApiOperation({ summary: "Update the logged-in user's own name and phone" })
  @Patch("me")
  async updateMe(@CurrentUser() user: Actor, @Body() dto: UpdateOwnProfileDto) {
    return this.usersService.updateOwnProfile(user.id, {
      name: dto.name?.trim(),
      phoneNumber: dto.phoneNumber?.trim(),
    });
  }

  @ApiOperation({ summary: "Sign-in history of the logged-in user on this DSP" })
  @Get("me/login-history")
  async myLoginHistory(@CurrentUser() user: Actor) {
    return this.auditService.loginHistory(user.id);
  }

  /**
   * Get specific user by ID
   * @param id - User UUID
   * @returns User details
   */
  @ApiOperation({
    summary: "Get user by ID",
    description:
      "Retrieve detailed information about a specific user by their ID.",
  })
  @ApiResponse({
    status: 200,
    description: "User retrieved successfully",
    type: UserResponseDto,
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Directors only" })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiParam({ name: "id", description: "User UUID" })
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR")
  @ThrottleModerate()
  @Get(":id")
  async findOne(
    @Param("id") id: string
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findById(id);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      phoneNumber: user.phoneNumber,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      twoFactorEnabled: false, // TODO: Implement 2FA with Better Auth
    };
  }

  /**
   * Create a new user
   * @param createUserDto - User creation data
   * @returns Created user information
   */
  @ApiOperation({
    summary: "Create a new user",
    description:
      "Create a new user account with the specified role and information.",
  })
  @ApiResponse({
    status: 201,
    description: "User created successfully",
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Directors only" })
  @ApiResponse({ status: 409, description: "User with email already exists" })
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR")
  @ThrottleModerate()
  @Post()
  async create(
    @Body() createUserDto: CreateUserDto,
    @CurrentUser() actor: Actor
  ): Promise<UserResponseDto> {
    return this.usersService.createUserFromDto(createUserDto, actor);
  }

  /**
   * Update user information
   * @param id - User UUID
   * @param updateUserDto - User update data
   * @returns Updated user information
   */
  @ApiOperation({
    summary: "Update user information",
    description:
      "Update user's profile information including name, email, role, and phone number.",
  })
  @ApiResponse({
    status: 200,
    description: "User updated successfully",
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Directors only" })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({ status: 409, description: "Email already in use" })
  @ApiParam({ name: "id", description: "User UUID" })
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR")
  @ThrottleModerate()
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() actor: Actor
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(id, updateUserDto, actor);
  }

  /**
   * Update user password
   * @param id - User UUID
   * @param updatePasswordDto - New password data
   * @returns Success message
   */
  @ApiOperation({
    summary: "Update user password",
    description:
      "Update a user's password. This is typically used for admin password resets.",
  })
  @ApiResponse({
    status: 200,
    description: "Password updated successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid password format" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Directors only" })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiParam({ name: "id", description: "User UUID" })
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR")
  @ThrottleModerate()
  @Patch(":id/password")
  @HttpCode(HttpStatus.OK)
  async updatePassword(
    @Param("id") id: string,
    @Body() updatePasswordDto: UpdatePasswordDto,
    @CurrentUser() actor: Actor
  ): Promise<{ message: string }> {
    await this.usersService.updatePassword(id, updatePasswordDto.newPassword, actor);
    return { message: "Password updated successfully" };
  }

  /**
   * Update user status
   * @param id - User UUID
   * @param updateStatusDto - New status data
   * @returns Updated user information
   */
  @ApiOperation({
    summary: "Update user status",
    description:
      "Update a user's status (ACTIVE, INACTIVE, PENDING). Use this to activate or deactivate user accounts.",
  })
  @ApiResponse({
    status: 200,
    description: "User status updated successfully",
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: "Invalid status value" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Directors only" })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiParam({ name: "id", description: "User UUID" })
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR")
  @ThrottleModerate()
  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @CurrentUser() actor: Actor
  ): Promise<UserResponseDto> {
    return this.usersService.updateStatus(id, updateStatusDto.status, actor);
  }

  /**
   * Soft delete user
   * @param id - User UUID
   * @returns Success message
   */
  @ApiOperation({
    summary: "Soft delete user",
    description:
      "Soft delete a user by setting their status to INACTIVE. The last active Director cannot be deleted.",
  })
  @ApiResponse({
    status: 200,
    description: "User deleted successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Cannot delete last active director",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - Directors only" })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiParam({ name: "id", description: "User UUID" })
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR")
  @ThrottleModerate()
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param("id") id: string,
    @CurrentUser() actor: Actor
  ): Promise<{ message: string }> {
    await this.usersService.softDeleteUser(id, actor);
    return { message: "User deleted successfully" };
  }

}
