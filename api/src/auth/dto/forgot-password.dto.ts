import { IsEmail } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ForgotPasswordDto {
  @ApiProperty({
    description: "Email address to send password reset link to",
    example: "user@example.com",
  })
  @IsEmail({}, { message: "Please provide a valid email address" })
  readonly email: string;
}
