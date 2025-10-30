import {
  IsEmail,
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

export class UpdateUserDto {
  @ApiProperty({
    description: "User's email address",
    example: "john.doe@example.com",
    required: false,
  })
  @IsOptional()
  @IsEmail({}, { message: "Please provide a valid email address" })
  readonly email?: string;

  @ApiProperty({
    description: "User's full name",
    example: "John Doe",
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  @MaxLength(100, { message: "Name cannot exceed 100 characters" })
  readonly name?: string;

  @ApiProperty({
    description: "User's role in the system",
    enum: UserRole,
    example: UserRole.MANAGER_FLEET,
    required: false,
  })
  @IsOptional()
  @IsEnum(UserRole, { message: "Please provide a valid user role" })
  readonly role?: UserRole;

  @ApiProperty({
    description: "User's phone number",
    example: "+44 7700 900123",
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly phoneNumber?: string;

  @ApiProperty({
    description: "User's avatar URL",
    example: "/uploads/avatars/avatar-1234567890.jpg",
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly avatar?: string;
}
