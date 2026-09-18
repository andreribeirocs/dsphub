import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from "class-validator";

export class CreateServiceTypeDto {
  @ApiProperty({
    description:
      "Stable key, upper snake case. Cannot be changed after creation.",
    example: "STANDARD_PARCEL_9H",
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 60)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: "code must be upper snake case, e.g. STANDARD_PARCEL_9H",
  })
  code!: string;

  @ApiProperty({ description: "Label shown in the screens", example: "Standard Parcel 9h" })
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ description: "Nominal paid hours", example: 9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  hours?: number;

  @ApiPropertyOptional({ description: "Order in the lists", example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

/** `code` is intentionally absent: it is the bridge back to the RouteType enum */
export class UpdateServiceTypeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
