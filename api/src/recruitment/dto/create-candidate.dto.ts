import { IsString, IsNotEmpty, IsPhoneNumber } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateCandidateDto {
  @ApiProperty({
    example: "John Doe",
    description: "The name of the candidate",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: "+447123456789",
    description: "The phone number of the candidate",
  })
  @IsPhoneNumber()
  @IsNotEmpty()
  phoneNumber: string;
}
