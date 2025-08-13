import {
  IsEnum,
  IsNotEmpty,
  IsDateString,
  IsDecimal,
  IsOptional,
  IsString,
  IsBoolean,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RouteType } from "@prisma/client";
import { Transform } from "class-transformer";

export class CreateDriverPaymentDto {
  @ApiProperty({
    description: "Driver ID",
    example: "uuid-string",
  })
  @IsUUID()
  @IsNotEmpty()
  readonly driverId!: string;

  @ApiProperty({
    description: "Work date (YYYY-MM-DD)",
    example: "2024-07-20",
  })
  @IsDateString()
  @IsNotEmpty()
  readonly workDate!: string;

  @ApiProperty({
    enum: RouteType,
    description: "Type of route worked",
    example: "FULL_ROUTE",
  })
  @IsEnum(RouteType)
  @IsNotEmpty()
  readonly routeType!: RouteType;

  @ApiProperty({
    description: "Daily rate in GBP",
    example: "25.00",
    type: "string",
  })
  @IsDecimal({ decimal_digits: "2" })
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value).toFixed(2))
  readonly dailyRate!: string;

  @ApiPropertyOptional({
    description: "Hours worked (optional)",
    example: "8.5",
    type: "string",
  })
  @IsOptional()
  @IsDecimal({ decimal_digits: "2" })
  @Transform(({ value }) => (value ? parseFloat(value).toFixed(2) : undefined))
  readonly hoursWorked?: string;

  @ApiProperty({
    description: "Total amount paid in GBP",
    example: "25.00",
    type: "string",
  })
  @IsDecimal({ decimal_digits: "2" })
  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value).toFixed(2))
  readonly totalPaid!: string;

  @ApiPropertyOptional({
    description: "Additional notes",
    example: "Worked overtime due to traffic delays",
  })
  @IsOptional()
  @IsString()
  readonly notes?: string;
}

export class UpdateDriverPaymentDto {
  @ApiPropertyOptional({
    description: "Whether the payment has been processed",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  readonly isPaid?: boolean;

  @ApiPropertyOptional({
    description: "Date when payment was processed (ISO string)",
    example: "2024-07-20T14:30:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  readonly paidDate?: string;

  @ApiPropertyOptional({
    description: "Additional notes",
    example: "Payment processed via bank transfer",
  })
  @IsOptional()
  @IsString()
  readonly notes?: string;
}

export class GetDriverPaymentsDto {
  @ApiPropertyOptional({
    description: "Driver ID to filter by",
    example: "uuid-string",
  })
  @IsOptional()
  @IsUUID()
  readonly driverId?: string;

  @ApiPropertyOptional({
    enum: RouteType,
    description: "Filter by route type",
    example: "FULL_ROUTE",
  })
  @IsOptional()
  @IsEnum(RouteType)
  readonly routeType?: RouteType;

  @ApiPropertyOptional({
    description: "Start date for filtering (YYYY-MM-DD)",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsDateString()
  readonly startDate?: string;

  @ApiPropertyOptional({
    description: "End date for filtering (YYYY-MM-DD)",
    example: "2024-12-31",
  })
  @IsOptional()
  @IsDateString()
  readonly endDate?: string;

  @ApiPropertyOptional({
    description: "Filter by payment status",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === "true")
  readonly isPaid?: boolean;
}
