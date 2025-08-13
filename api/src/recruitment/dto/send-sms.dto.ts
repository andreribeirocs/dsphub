import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class SendSmsDto {
  @ApiProperty({ example: "12345", description: "The ID of the candidate" })
  @IsString()
  @IsNotEmpty()
  candidateId: string;
}
