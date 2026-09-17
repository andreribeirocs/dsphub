import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsInt,
  IsDecimal,
  IsDateString,
  IsBoolean,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { VanStatus, VanCondition } from "@prisma/client";
import { Transform } from "class-transformer";

export class CreateVanDto {
  @ApiProperty({
    description: "Van number/ID (e.g., '03', '04')",
    example: "03",
  })
  @IsString()
  @IsNotEmpty()
  readonly vanNumber!: string;

  @ApiProperty({
    description: "Vehicle registration number",
    example: "KN70JYR",
  })
  @IsString()
  @IsNotEmpty()
  readonly registration!: string;

  @ApiProperty({
    description: "Vehicle make",
    example: "Mercedes",
  })
  @IsString()
  @IsNotEmpty()
  readonly make!: string;

  @ApiProperty({
    description: "Vehicle model",
    example: "eSPRINTER L2 20",
  })
  @IsString()
  @IsNotEmpty()
  readonly model!: string;

  @ApiPropertyOptional({
    description: "Vehicle year",
    example: 2022,
  })
  @IsOptional()
  @IsInt()
  readonly year?: number;

  @ApiPropertyOptional({
    enum: VanStatus,
    description: "Van status",
    example: "AVAILABLE",
  })
  @IsOptional()
  @IsEnum(VanStatus)
  readonly status?: VanStatus;

  @ApiPropertyOptional({
    enum: VanCondition,
    description: "Van condition",
    example: "GOOD",
  })
  @IsOptional()
  @IsEnum(VanCondition)
  readonly condition?: VanCondition;

  @ApiPropertyOptional({
    description: "MOT expiry date",
    example: "2026-09-01",
  })
  @IsOptional()
  @IsDateString()
  readonly motExpiry?: string;

  @ApiPropertyOptional({
    description: "Contract ID if assigned",
  })
  @IsOptional()
  @IsString()
  readonly contractId?: string;

  @ApiPropertyOptional({
    description: "Monthly rental amount",
    example: "399.00",
    type: "string",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "2" })
  @Transform(({ value }) => (value ? parseFloat(value).toFixed(2) : undefined))
  readonly monthlyRental?: string;

  @ApiPropertyOptional({
    description: "Vehicle VIN number",
    example: "WDB9066131R123456",
  })
  @IsOptional()
  @IsString()
  readonly vin?: string;

  @ApiPropertyOptional({
    description: "Engine number",
    example: "651925123456",
  })
  @IsOptional()
  @IsString()
  readonly engineNumber?: string;

  @ApiPropertyOptional({
    description: "Fuel type",
    example: "Electric",
  })
  @IsOptional()
  @IsString()
  readonly fuelType?: string;

  @ApiPropertyOptional({
    description: "Vehicle capacity",
    example: "L2 20",
  })
  @IsOptional()
  @IsString()
  readonly capacity?: string;

  @ApiPropertyOptional({
    description: "Depot location",
    example: "DP01",
  })
  @IsOptional()
  @IsString()
  readonly depot?: string;

  @ApiPropertyOptional({ description: "Depot id (preferred over the free-text depot)" })
  @IsOptional()
  @IsString()
  readonly depotId?: string;

  @ApiPropertyOptional({
    description: "Assigned driver name",
    example: "Marcos",
  })
  @IsOptional()
  @IsString()
  readonly assignedDriver?: string;

  @ApiPropertyOptional({
    description: "Current mileage",
    example: 15000,
  })
  @IsOptional()
  @IsInt()
  readonly mileage?: number;

  @ApiPropertyOptional({
    description: "Last service date",
    example: "2024-01-15",
  })
  @IsOptional()
  @IsDateString()
  readonly lastService?: string;

  @ApiPropertyOptional({
    description: "Next service date",
    example: "2024-07-15",
  })
  @IsOptional()
  @IsDateString()
  readonly nextService?: string;

  @ApiPropertyOptional({
    description: "Additional comments",
    example: "INDICATOR BULB NEVER WORKS",
  })
  @IsOptional()
  @IsString()
  readonly comments?: string;

  @ApiPropertyOptional({
    description: "MOT reminder enabled",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  readonly motReminder?: boolean;
}
