import {
  IsOptional,
  IsEnum,
  IsString,
  IsNumberString,
  Min,
  Max,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserRole, UserStatus } from "@prisma/client";
import { Transform } from "class-transformer";

export class GetUsersDto {
  @ApiProperty({
    description: "Search term for name or email",
    example: "john",
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiProperty({
    description: "Filter by user role",
    enum: UserRole,
    example: UserRole.MANAGER_FLEET,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: "Please provide a valid user role" })
  readonly role?: UserRole;

  @ApiProperty({
    description: "Filter by user status",
    enum: UserStatus,
    example: UserStatus.ACTIVE,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserStatus, { message: "Please provide a valid user status" })
  readonly status?: UserStatus;

  @ApiProperty({
    description: "Page number for pagination (starting from 1)",
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @Min(1, { message: "Page must be at least 1" })
  readonly page?: number = 1;

  @ApiProperty({
    description: "Number of items per page",
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @Min(1, { message: "Limit must be at least 1" })
  @Max(100, { message: "Limit cannot exceed 100" })
  readonly limit?: number = 10;

  @ApiProperty({
    description: "Sort field",
    example: "name",
    enum: ["name", "email", "role", "status", "createdAt", "lastLogin"],
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly sortBy?:
    | "name"
    | "email"
    | "role"
    | "status"
    | "createdAt"
    | "lastLogin" = "createdAt";

  @ApiProperty({
    description: "Sort order",
    example: "desc",
    enum: ["asc", "desc"],
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly sortOrder?: "asc" | "desc" = "desc";
}
