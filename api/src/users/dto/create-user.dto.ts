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

export class CreateUserDto {
  @ApiProperty({
    description: "User's email address",
    example: "john.doe@example.com",
  })
  @IsEmail({}, { message: "Please provide a valid email address" })
  readonly email: string;

  @ApiProperty({
    description: "User's full name",
    example: "John Doe",
  })
  @IsString()
  @MinLength(2, { message: "Name must be at least 2 characters long" })
  @MaxLength(100, { message: "Name cannot exceed 100 characters" })
  readonly name: string;

  @ApiProperty({
    description: "User's password",
    example: "SecurePassword123!",
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  readonly password: string;

  @ApiProperty({
    description: "User's role in the system",
    enum: UserRole,
    example: UserRole.MANAGER_FLEET,
  })
  @IsEnum(UserRole, { message: "Please provide a valid user role" })
  readonly role: UserRole;

  @ApiProperty({
    description: "User's phone number",
    example: "+44 7700 900123",
    required: false,
  })
  @IsOptional()
  @IsString()
  readonly phoneNumber?: string;
}
