import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";

export class CreateDepotDto {
  @ApiProperty({ example: "DXW2", description: "Amazon station code, unique per DSP" })
  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  @Matches(/^[A-Za-z0-9-]+$/, { message: "Code must contain only letters, numbers or -" })
  code: string;

  @ApiProperty({ example: "Weybridge" })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 200)
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 12)
  postcode?: string;
}

export class UpdateDepotDto extends PartialType(CreateDepotDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetMemberDepotsDto {
  @ApiProperty({
    type: [String],
    description: "Depot ids the user is limited to. Empty = access to every depot.",
  })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  depotIds: string[];
}
