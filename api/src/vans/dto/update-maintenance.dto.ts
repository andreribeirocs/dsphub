import { IsOptional, IsDecimal, IsDateString, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { PartialType } from "@nestjs/swagger";
import { CreateMaintenanceDto } from "./create-maintenance.dto";

export class UpdateMaintenanceDto extends PartialType(CreateMaintenanceDto) {
  @ApiPropertyOptional({
    description: "Completed date",
    example: "2024-09-01",
  })
  @IsOptional()
  @IsDateString()
  readonly completedDate?: string;

  @ApiPropertyOptional({
    description: "Actual cost",
    example: "175.50",
    type: "string",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "2" })
  @Transform(({ value }) => (value ? parseFloat(value).toFixed(2) : undefined))
  readonly actualCost?: string;

  @ApiPropertyOptional({
    description: "Labor hours",
    example: "3.5",
    type: "string",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "2" })
  @Transform(({ value }) => (value ? parseFloat(value).toFixed(2) : undefined))
  readonly laborHours?: string;

  @ApiPropertyOptional({
    description: "Invoice number",
    example: "INV-2024-001",
  })
  @IsOptional()
  @IsString()
  readonly invoiceNumber?: string;

  @ApiPropertyOptional({
    description: "Warranty expiry date",
    example: "2025-09-01",
  })
  @IsOptional()
  @IsDateString()
  readonly warrantyUntil?: string;
}
