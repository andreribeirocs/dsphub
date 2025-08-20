import { ApiProperty } from "@nestjs/swagger";
import { UserRole, UserStatus } from "@prisma/client";

export class UserResponseDto {
  @ApiProperty({
    description: "User's unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  readonly id: string;

  @ApiProperty({
    description: "User's email address",
    example: "john.doe@example.com",
  })
  readonly email: string;

  @ApiProperty({
    description: "User's full name",
    example: "John Doe",
  })
  readonly name: string;

  @ApiProperty({
    description: "User's role in the system",
    enum: UserRole,
    example: UserRole.MANAGER_FLEET,
  })
  readonly role: UserRole;

  @ApiProperty({
    description: "User's current status",
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  readonly status: UserStatus;

  @ApiProperty({
    description: "User's phone number",
    example: "+44 7700 900123",
    nullable: true,
  })
  readonly phoneNumber: string | null;

  @ApiProperty({
    description: "Date of user's last login",
    example: "2024-01-15T10:30:00Z",
    nullable: true,
  })
  readonly lastLogin: Date | null;

  @ApiProperty({
    description: "Date when user was created",
    example: "2024-01-01T09:00:00Z",
  })
  readonly createdAt: Date;

  @ApiProperty({
    description: "Date when user was last updated",
    example: "2024-01-15T14:30:00Z",
  })
  readonly updatedAt: Date;

  @ApiProperty({
    description: "Whether two-factor authentication is enabled",
    example: false,
  })
  readonly twoFactorEnabled: boolean;
}

export class PaginatedUsersResponseDto {
  @ApiProperty({
    description: "Array of users",
    type: [UserResponseDto],
  })
  readonly data: UserResponseDto[];

  @ApiProperty({
    description: "Pagination metadata",
  })
  readonly pagination: {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
  };
}

export class UserStatsResponseDto {
  @ApiProperty({
    description: "Total number of users",
    example: 150,
  })
  readonly totalUsers: number;

  @ApiProperty({
    description: "Number of active users",
    example: 120,
  })
  readonly activeUsers: number;

  @ApiProperty({
    description: "Number of inactive users",
    example: 25,
  })
  readonly inactiveUsers: number;

  @ApiProperty({
    description: "Number of pending users",
    example: 5,
  })
  readonly pendingUsers: number;

  @ApiProperty({
    description: "Users by role breakdown",
  })
  readonly usersByRole: Record<UserRole, number>;

  @ApiProperty({
    description: "Number of users created this month",
    example: 8,
  })
  readonly newUsersThisMonth: number;
}
