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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ThrottleModerate } from "../auth/decorators/throttle.decorator";
import {
  CreateUserDto,
  UpdateUserDto,
  UpdatePasswordDto,
  UpdateStatusDto,
  GetUsersDto,
  UserResponseDto,
  PaginatedUsersResponseDto,
  UserStatsResponseDto,
} from "./dto";

@ApiTags("users")
@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
  @Roles("DIRECTOR")
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
  @Roles("DIRECTOR")
  @ThrottleModerate()
  @Get("stats")
  async getStats(): Promise<UserStatsResponseDto> {
    return this.usersService.getUserStats();
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
  @Roles("DIRECTOR")
  @ThrottleModerate()
  @Get(":id")
  async findOne(
    @Param("id", ParseUUIDPipe) id: string
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
      twoFactorEnabled: user.twoFactorEnabled,
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
  @Roles("DIRECTOR")
  @ThrottleModerate()
  @Post()
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.createUserFromDto(createUserDto);
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
  @Roles("DIRECTOR")
  @ThrottleModerate()
  @Patch(":id")
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<UserResponseDto> {
    return this.usersService.updateUser(id, updateUserDto);
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
  @Roles("DIRECTOR")
  @ThrottleModerate()
  @Patch(":id/password")
  @HttpCode(HttpStatus.OK)
  async updatePassword(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updatePasswordDto: UpdatePasswordDto
  ): Promise<{ message: string }> {
    await this.usersService.updatePassword(id, updatePasswordDto.newPassword);
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
  @Roles("DIRECTOR")
  @ThrottleModerate()
  @Patch(":id/status")
  async updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateStatusDto
  ): Promise<UserResponseDto> {
    return this.usersService.updateStatus(id, updateStatusDto.status);
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
  @Roles("DIRECTOR")
  @ThrottleModerate()
  @Delete(":id")
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<{ message: string }> {
    await this.usersService.softDeleteUser(id);
    return { message: "User deleted successfully" };
  }
}
