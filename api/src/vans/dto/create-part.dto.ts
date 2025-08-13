import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsDecimal,
  IsInt,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class CreatePartDto {
  @ApiProperty({
    description: "Part name/description",
    example: "UPPER MIRROR GLASS N/S",
  })
  @IsString()
  @IsNotEmpty()
  readonly name!: string;

  @ApiPropertyOptional({
    description: "Part category",
    example: "Mirror",
  })
  @IsOptional()
  @IsString()
  readonly category?: string;

  @ApiPropertyOptional({
    description: "Price for Ford vehicles",
    example: "34.00",
    type: "string",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "2" })
  @Transform(({ value }) => (value ? parseFloat(value).toFixed(2) : undefined))
  readonly fordPrice?: string;

  @ApiPropertyOptional({
    description: "Price for Mercedes vehicles",
    example: "38.00",
    type: "string",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "2" })
  @Transform(({ value }) => (value ? parseFloat(value).toFixed(2) : undefined))
  readonly mercedesPrice?: string;

  @ApiPropertyOptional({
    description: "Price for Peugeot vehicles",
    example: "32.00",
    type: "string",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "2" })
  @Transform(({ value }) => (value ? parseFloat(value).toFixed(2) : undefined))
  readonly peugeotPrice?: string;

  @ApiPropertyOptional({
    description: "Part number",
    example: "MG-001-NS",
  })
  @IsOptional()
  @IsString()
  readonly partNumber?: string;

  @ApiPropertyOptional({
    description: "Supplier name",
    example: "Euro Car Parts",
  })
  @IsOptional()
  @IsString()
  readonly supplier?: string;

  @ApiPropertyOptional({
    description: "Detailed part description",
    example: "Upper wing mirror glass for near side (driver side)",
  })
  @IsOptional()
  @IsString()
  readonly description?: string;

  @ApiPropertyOptional({
    description: "Current stock level",
    example: 10,
  })
  @IsOptional()
  @IsInt()
  readonly stockLevel?: number;

  @ApiPropertyOptional({
    description: "Minimum stock level for reorder alerts",
    example: 2,
  })
  @IsOptional()
  @IsInt()
  readonly minStockLevel?: number;

  @ApiPropertyOptional({
    description: "Maximum stock level",
    example: 50,
  })
  @IsOptional()
  @IsInt()
  readonly maxStockLevel?: number;

  @ApiPropertyOptional({
    description: "Part weight in kg",
    example: "0.150",
    type: "string",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "3" })
  @Transform(({ value }) => (value ? parseFloat(value).toFixed(3) : undefined))
  readonly weight?: string;

  @ApiPropertyOptional({
    description: "Part dimensions (L x W x H)",
    example: "15cm x 10cm x 2cm",
  })
  @IsOptional()
  @IsString()
  readonly dimensions?: string;

  @ApiPropertyOptional({
    description: "Warranty period in days",
    example: 365,
  })
  @IsOptional()
  @IsInt()
  readonly warrantyDays?: number;

  @ApiPropertyOptional({
    description: "Part is active and available",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  readonly isActive?: boolean;
}
