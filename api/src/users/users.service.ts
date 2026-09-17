import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { User, UserRole, UserStatus, Prisma } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import {
  CreateUserDto,
  UpdateUserDto,
  GetUsersDto,
  UserResponseDto,
  PaginatedUsersResponseDto,
  UserStatsResponseDto,
} from "./dto";
import { TenantContext } from "../tenancy/tenant-context";

interface CreateUserData {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly role: UserRole;
}

/** The authenticated user performing the action */
export interface Actor {
  readonly id: string;
  readonly role: string;
}

type UserWithoutPassword = User; // password lives in Account (better-auth)

/** Member.role values used by the better-auth organization plugin */
const memberRoleFor = (role: UserRole): string =>
  role === UserRole.OWNER ? "owner" : role === UserRole.DIRECTOR ? "admin" : "member";

const SORTABLE_FIELDS = new Set(["name", "email", "role", "status", "createdAt", "lastLogin"]);

/**
 * Users are global identities; a DSP only sees and manages users that are
 * members of the current organization (TenantContext).
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private memberOfCurrentOrganization(): Prisma.UserWhereInput {
    return {
      members: { some: { organizationId: TenantContext.requireOrganizationId() } },
    };
  }

  private assertRoleChangeAllowed(actor: Actor | undefined, role?: UserRole) {
    if (role === UserRole.SUPER_ADMIN && actor?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("Only super administrators can grant this role");
    }
  }

  private async findInOrganizationOrThrow(id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, ...this.memberOfCurrentOrganization() },
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return user;
  }

  private assertCanManage(actor: Actor | undefined, target: User) {
    if (target.role === UserRole.SUPER_ADMIN && actor?.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException("You cannot change this user");
    }
  }

  /**
   * Find a user of the current organization by id
   * @throws NotFoundException if the user is not a member of this DSP
   */
  async findById(id: string): Promise<UserWithoutPassword> {
    return this.findInOrganizationOrThrow(id);
  }

  /**
   * Find a user by email (global lookup, used by authentication flows)
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  private async createMemberWithCredentials(
    data: { email: string; name: string; role: UserRole; phoneNumber?: string },
    password: string
  ): Promise<User> {
    const organizationId = TenantContext.requireOrganizationId();
    const passwordHash = await hashPassword(password);

    return this.prisma.tenantTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          name: data.name,
          role: data.role,
          phoneNumber: data.phoneNumber,
          status: UserStatus.ACTIVE,
        },
      });

      await tx.account.create({
        data: {
          userId: user.id,
          accountId: user.id,
          providerId: "credential",
          password: passwordHash,
        },
      });

      await tx.member.create({
        data: {
          userId: user.id,
          organizationId,
          role: memberRoleFor(data.role),
        },
      });

      return user;
    });
  }

  /**
   * Create a user (with login credentials) inside the current organization
   */
  async createUser(data: CreateUserData): Promise<UserWithoutPassword> {
    return this.createMemberWithCredentials(data, data.password);
  }

  /**
   * Create a user from the admin screen
   */
  async createUserFromDto(
    createUserDto: CreateUserDto,
    actor?: Actor
  ): Promise<UserResponseDto> {
    this.assertRoleChangeAllowed(actor, createUserDto.role);

    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
      select: { id: true },
    });
    if (existingUser) {
      // Same message whether the account belongs to this DSP or another one
      throw new ConflictException("User with this email already exists");
    }

    const user = await this.createMemberWithCredentials(
      {
        email: createUserDto.email,
        name: createUserDto.name,
        role: createUserDto.role,
        phoneNumber: createUserDto.phoneNumber,
      },
      createUserDto.password
    );

    return this.mapToUserResponse(user);
  }

  /**
   * List users of the current organization with filters and pagination
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

    const where: Prisma.UserWhereInput = { ...this.memberOfCurrentOrganization() };

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

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const safePage = Math.max(Number(page) || 1, 1);
    const orderBy: Prisma.UserOrderByWithRelationInput = {
      [SORTABLE_FIELDS.has(sortBy) ? sortBy : "createdAt"]: sortOrder === "asc" ? "asc" : "desc",
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((user) => this.mapToUserResponse(user)),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  /**
   * Update a user of the current organization
   */
  async updateUser(
    id: string,
    updateUserDto: UpdateUserDto,
    actor?: Actor
  ): Promise<UserResponseDto> {
    const existingUser = await this.findInOrganizationOrThrow(id);
    this.assertCanManage(actor, existingUser);
    this.assertRoleChangeAllowed(actor, updateUserDto.role);

    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
        select: { id: true },
      });
      if (emailConflict) {
        throw new ConflictException("User with this email already exists");
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });

    if (updateUserDto.role) {
      await this.prisma.member.updateMany({
        where: { userId: id },
        data: { role: memberRoleFor(updateUserDto.role) },
      });
    }

    return this.mapToUserResponse(updatedUser);
  }

  /**
   * Update the profile of the logged-in user (no role/status changes)
   */
  async updateOwnProfile(
    userId: string,
    data: { name?: string; phoneNumber?: string; avatar?: string }
  ): Promise<UserResponseDto> {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.mapToUserResponse(updatedUser);
  }

  /**
   * Set a new password for a user of the current organization
   */
  async updatePassword(id: string, newPassword: string, actor?: Actor): Promise<void> {
    const user = await this.findInOrganizationOrThrow(id);
    this.assertCanManage(actor, user);

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.account.updateMany({
      where: { userId: id, providerId: "credential" },
      data: { password: passwordHash },
    });
  }

  /**
   * Update the status of a user of the current organization
   */
  async updateStatus(id: string, status: UserStatus, actor?: Actor): Promise<UserResponseDto> {
    const existingUser = await this.findInOrganizationOrThrow(id);
    this.assertCanManage(actor, existingUser);

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { status },
    });
    return this.mapToUserResponse(updatedUser);
  }

  /**
   * Remove a user from the current organization.
   * If the user belongs to no other DSP, the account is also deactivated.
   */
  async softDeleteUser(id: string, actor?: Actor): Promise<void> {
    const organizationId = TenantContext.requireOrganizationId();
    const user = await this.findInOrganizationOrThrow(id);
    this.assertCanManage(actor, user);

    if (actor?.id === id) {
      throw new BadRequestException("You cannot remove your own account");
    }

    if (user.role === UserRole.DIRECTOR || user.role === UserRole.OWNER) {
      const leaders = await this.prisma.user.count({
        where: {
          ...this.memberOfCurrentOrganization(),
          role: { in: [UserRole.DIRECTOR, UserRole.OWNER] },
          status: { not: UserStatus.INACTIVE },
        },
      });
      if (leaders <= 1) {
        throw new BadRequestException("Cannot remove the last active director");
      }
    }

    await this.prisma.member.deleteMany({ where: { userId: id, organizationId } });

    const otherMemberships = await TenantContext.runAsSystem(
      async () => await this.prisma.member.count({ where: { userId: id } })
    );
    if (otherMemberships === 0) {
      await this.prisma.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE },
      });
    }
  }

  /**
   * User statistics for the current organization
   */
  async getUserStats(): Promise<UserStatsResponseDto> {
    const scope = this.memberOfCurrentOrganization();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalUsers, activeUsers, inactiveUsers, pendingUsers, roleCounts, newUsersThisMonth] =
      await Promise.all([
        this.prisma.user.count({ where: scope }),
        this.prisma.user.count({ where: { ...scope, status: UserStatus.ACTIVE } }),
        this.prisma.user.count({ where: { ...scope, status: UserStatus.INACTIVE } }),
        this.prisma.user.count({ where: { ...scope, status: UserStatus.PENDING } }),
        this.prisma.user.groupBy({ by: ["role"], where: scope, _count: { role: true } }),
        this.prisma.user.count({ where: { ...scope, createdAt: { gte: startOfMonth } } }),
      ]);

    const usersByRole = Object.fromEntries(
      Object.values(UserRole).map((role) => [role, 0])
    ) as Record<UserRole, number>;
    roleCounts.forEach((item) => {
      usersByRole[item.role] = item._count.role;
    });

    return { totalUsers, activeUsers, inactiveUsers, pendingUsers, usersByRole, newUsersThisMonth };
  }

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
      twoFactorEnabled: false,
    };
  }
}
