import { IsEmail, IsString, Length, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { TrimWhitespace, NormalizeEmail, NoXSS, NoSqlInjection } from "../../shared/validation/custom-validators";

export class LoginDto {
  @ApiProperty({ example: "user@example.com", description: "User email" })
  @TrimWhitespace()
  @NormalizeEmail()
  @IsEmail({}, { message: "Please provide a valid email address" })
  @NoXSS()
  @NoSqlInjection()
  @Length(5, 254, { message: "Email must be between 5 and 254 characters" })
  @IsNotEmpty({ message: "Email is required" })
  email: string;

  @ApiProperty({ example: "password123", description: "User password" })
  @IsString({ message: "Password must be a string" })
  @Length(1, 255, { message: "Password must be between 1 and 255 characters" })
  @IsNotEmpty({ message: "Password is required" })
  @NoXSS()
  @NoSqlInjection()
  password: string;
}
