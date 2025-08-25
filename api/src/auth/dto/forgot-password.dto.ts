import { IsString, IsNotEmpty, Matches } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ForgotPasswordDto {
  @ApiProperty({
    description: "Phone number to send password reset link via WhatsApp",
    example: "+1234567890",
  })
  @IsString({ message: "Phone number must be a string" })
  @IsNotEmpty({ message: "Phone number is required" })
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Please provide a valid phone number in international format",
  })
  readonly phoneNumber: string;
}
