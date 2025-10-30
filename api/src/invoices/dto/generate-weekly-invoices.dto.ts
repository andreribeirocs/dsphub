import { IsDateString, IsOptional, IsArray } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class GenerateWeeklyInvoicesDto {
  @ApiProperty({
    description: "Week start date (Sunday)",
    example: "2025-01-05",
  })
  @IsDateString()
  readonly weekStartDate: string;

  @ApiPropertyOptional({
    description:
      "Optional array of driver IDs to generate invoices for. If not provided, generates for all active drivers.",
  })
  @IsOptional()
  @IsArray()
  readonly driverIds?: string[];
}

export interface GenerateWeeklyInvoicesResult {
  readonly generated: number;
  readonly skipped: number;
  readonly errors: number;
  readonly invoices: Array<{
    readonly invoiceId: string;
    readonly driverId: string;
    readonly driverName: string;
    readonly invoiceNumber: string;
    readonly totalAmount: number;
  }>;
  readonly errorDetails?: Array<{
    readonly driverId: string;
    readonly driverName: string;
    readonly error: string;
  }>;
}
