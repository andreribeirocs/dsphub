import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsDecimal,
  IsDateString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MaintenanceStatus, MaintenancePriority } from "@prisma/client";
import { Transform } from "class-transformer";

export class CreateMaintenanceDto {
  @ApiProperty({
    description: "Van ID for maintenance",
  })
  @IsString()
  @IsNotEmpty()
  readonly vanId!: string;

  @ApiProperty({
    description: "Maintenance type",
    example: "MOT",
  })
  @IsString()
  @IsNotEmpty()
  readonly type!: string;

  @ApiProperty({
    description: "Maintenance description",
    example: "Annual MOT inspection required",
  })
  @IsString()
  @IsNotEmpty()
  readonly description!: string;

  @ApiProperty({
    description: "Scheduled date for maintenance",
    example: "2024-09-01",
  })
  @IsDateString()
  @IsNotEmpty()
  readonly scheduledDate!: string;

  @ApiPropertyOptional({
    enum: MaintenanceStatus,
    description: "Maintenance status",
    example: "SCHEDULED",
  })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  readonly status?: MaintenanceStatus;

  @ApiPropertyOptional({
    enum: MaintenancePriority,
    description: "Maintenance priority",
    example: "HIGH",
  })
  @IsOptional()
  @IsEnum(MaintenancePriority)
  readonly priority?: MaintenancePriority;

  @ApiPropertyOptional({
    description: "Estimated cost",
    example: "150.00",
    type: "string",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "2" })
  @Transform(({ value }) => (value ? parseFloat(value).toFixed(2) : undefined))
  readonly estimatedCost?: string;

  @ApiPropertyOptional({
    description: "Workshop/garage name",
    example: "City Motors",
  })
  @IsOptional()
  @IsString()
  readonly workshop?: string;

  @ApiPropertyOptional({
    description: "Workshop contact information",
    example: "+44 20 1234 5678",
  })
  @IsOptional()
  @IsString()
  readonly workshopContact?: string;

  @ApiPropertyOptional({
    description: "Additional notes",
    example: "Check indicator bulb issue",
  })
  @IsOptional()
  @IsString()
  readonly notes?: string;

  @ApiPropertyOptional({
    description: "Assigned technician or responsible person",
    example: "John Smith",
  })
  @IsOptional()
  @IsString()
  readonly assignedTo?: string;
}
