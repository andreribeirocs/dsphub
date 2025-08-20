import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { User, UserRole, UserStatus, Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import {
  CreateUserDto,
  UpdateUserDto,
  GetUsersDto,
  UserResponseDto,
  PaginatedUsersResponseDto,
  UserStatsResponseDto,
} from "./dto";

// Constants
const BCRYPT_ROUNDS = 10;

interface CreateUserData {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly role: UserRole;
}

type UserWithoutPassword = Omit<User, "password">;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find a user by their ID
   * @param id - User ID
   * @returns User without password field
   * @throws NotFoundException if user not found
   */
  async findById(id: string): Promise<UserWithoutPassword> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Find a user by their email address
   * @param email - User email
   * @returns Complete user object including password (for authentication)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  /**
   * Create a new user with hashed password
   * @param data - User creation data
   * @returns Created user without password field
   */
  async createUser(data: CreateUserData): Promise<UserWithoutPassword> {
    const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Create a new user from DTO
   * @param createUserDto - User creation data from DTO
   * @returns Created user without password field
   */
  async createUserFromDto(
    createUserDto: CreateUserDto
  ): Promise<UserResponseDto> {
    // Check if user with email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      BCRYPT_ROUNDS
    );

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        name: createUserDto.name,
        password: hashedPassword,
        role: createUserDto.role,
        phoneNumber: createUserDto.phoneNumber,
      },
    });

    return this.mapToUserResponse(user);
  }

  /**
   * Get all users with filtering and pagination
   * @param filters - Query filters and pagination options
   * @returns Paginated list of users
   */
  async findAllUsers(filters: GetUsersDto): Promise<PaginatedUsersResponseDto> {
    const {
      search,
      role,
      status,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filters;

    // Build where clause for filtering
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (status) {
      where.status = status;
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Build orderBy clause
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Execute queries in parallel
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users.map((user) => this.mapToUserResponse(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Update user information
   * @param id - User ID
   * @param updateUserDto - Update data
   * @returns Updated user without password field
   */
  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto
  ): Promise<UserResponseDto> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    // If email is being updated, check for conflicts
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });

      if (emailConflict) {
        throw new ConflictException("User with this email already exists");
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    return this.mapToUserResponse(updatedUser);
  }

  /**
   * Update user password
   * @param id - User ID
   * @param newPassword - New password to set
   * @returns void
   */
  async updatePassword(id: string, newPassword: string): Promise<void> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
  }

  /**
   * Update user status
   * @param id - User ID
   * @param status - New status to set
   * @returns Updated user without password field
   */
  async updateStatus(id: string, status: UserStatus): Promise<UserResponseDto> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException("User not found");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { status },
    });

    return this.mapToUserResponse(updatedUser);
  }

  /**
   * Soft delete user by setting status to INACTIVE
   * @param id - User ID
   * @returns void
   */
  async softDeleteUser(id: string): Promise<void> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Prevent deletion of the last DIRECTOR
    if (user.role === UserRole.DIRECTOR) {
      const directorCount = await this.prisma.user.count({
        where: {
          role: UserRole.DIRECTOR,
          status: { not: UserStatus.INACTIVE },
        },
      });

      if (directorCount <= 1) {
        throw new BadRequestException("Cannot delete the last active director");
      }
    }

    await this.prisma.user.update({
      where: { id },
      data: { status: UserStatus.INACTIVE },
    });
  }

  /**
   * Get user statistics for dashboard
   * @returns User statistics
   */
  async getUserStats(): Promise<UserStatsResponseDto> {
    // Get basic counts
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      pendingUsers,
      usersByRole,
      newUsersThisMonth,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.INACTIVE } }),
      this.prisma.user.count({ where: { status: UserStatus.PENDING } }),
      this.getUsersByRole(),
      this.getNewUsersThisMonth(),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      pendingUsers,
      usersByRole,
      newUsersThisMonth,
    };
  }

  /**
   * Helper method to get users count by role
   * @returns Object with role counts
   */
  private async getUsersByRole(): Promise<Record<UserRole, number>> {
    const roleCounts = await this.prisma.user.groupBy({
      by: ["role"],
      _count: { role: true },
    });

    const result: Record<UserRole, number> = {
      [UserRole.DIRECTOR]: 0,
      [UserRole.MANAGER_FINANCIAL]: 0,
      [UserRole.MANAGER_FLEET]: 0,
      [UserRole.MANAGER_ONSITE]: 0,
      [UserRole.MANAGER_RECRUITMENT]: 0,
      [UserRole.DRIVER]: 0,
    };

    roleCounts.forEach((item) => {
      result[item.role] = item._count.role;
    });

    return result;
  }

  /**
   * Helper method to get count of users created this month
   * @returns Number of new users this month
   */
  private async getNewUsersThisMonth(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.prisma.user.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    });
  }

  /**
   * Helper method to map User to UserResponseDto
   * @param user - User object from database
   * @returns UserResponseDto
   */
  private mapToUserResponse(user: User): UserResponseDto {
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
}
