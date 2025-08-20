import { IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class UpdatePasswordDto {
  @ApiProperty({
    description: "New password for the user",
    example: "NewSecurePassword123!",
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  readonly newPassword: string;
}
