import {
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsNumber,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";

export enum InvoiceStatusFilter {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  SENT = "SENT",
  CANCELLED = "CANCELLED",
}

export class GetInvoicesDto {
  @ApiPropertyOptional({ description: "Filter by driver ID" })
  @IsOptional()
  @IsString()
  readonly driverId?: string;

  @ApiPropertyOptional({
    description: "Filter by status",
    enum: InvoiceStatusFilter,
  })
  @IsOptional()
  @IsEnum(InvoiceStatusFilter)
  readonly status?: InvoiceStatusFilter;

  @ApiPropertyOptional({ description: "Filter by week start date (from)" })
  @IsOptional()
  @IsDateString()
  readonly weekStartFrom?: string;

  @ApiPropertyOptional({ description: "Filter by week start date (to)" })
  @IsOptional()
  @IsDateString()
  readonly weekStartTo?: string;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  readonly page?: number;

  @ApiPropertyOptional({ description: "Items per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  readonly limit?: number;
}
