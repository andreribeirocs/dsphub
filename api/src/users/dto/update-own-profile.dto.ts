import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

/** Fields a user may change on their own profile (no email, role or status) */
export class UpdateOwnProfileDto {
  @ApiProperty({ required: false, example: "Jane Smith" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  readonly name?: string;

  @ApiProperty({ required: false, example: "+44 7700 900123" })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  readonly phoneNumber?: string;
}
