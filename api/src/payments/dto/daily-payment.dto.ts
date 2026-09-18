import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  MaxLength,
} from "class-validator";
import { Type, Transform } from "class-transformer";
import { RouteType } from "@prisma/client";

export class GetDailyPaymentsPrefillDto {
  @ApiProperty({
    description: "Target work date (YYYY-MM-DD)",
    example: "2025-07-13",
  })
  @IsDateString()
  @IsNotEmpty()
  readonly date!: string;

  @ApiPropertyOptional({
    description: "Include drivers that already have a saved payment",
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === undefined ? true : value === "true" || value === true
  )
  readonly includeExisting?: boolean = true;
}

export class DailyPaymentPrefillItemDto {
  @ApiProperty({ description: "Driver ID" })
  @IsUUID()
  readonly driverId!: string;

  @ApiProperty({ description: "Driver name" })
  @IsString()
  readonly driverName!: string;

  @ApiProperty({ description: "Transporter ID" })
  @IsString()
  /** Null while the driver is still in onboarding */
  readonly transporterId!: string | null;

  @ApiProperty({ description: "Work date (YYYY-MM-DD)" })
  @IsDateString()
  readonly workDate!: string;

  @ApiProperty({
    enum: RouteType,
    description: "Route type inferred from schedule",
  })
  @IsEnum(RouteType)
  readonly routeType!: RouteType;

  @ApiPropertyOptional({
    description: "Route code from Amazon sheet (e.g., CA_A270)",
    example: "CA_A270",
  })
  @IsOptional()
  @IsString()
  readonly routeCode?: string;

  @ApiProperty({ description: "Suggested daily rate in GBP", example: 125.0 })
  readonly dailyRate!: number;

  @ApiProperty({ description: "Suggested extra amount", example: 0 })
  readonly extraAmount!: number;

  @ApiProperty({ description: "Suggested deduction amount", example: 0 })
  readonly deductionAmount!: number;

  @ApiProperty({ description: "Suggested van charge", example: 0 })
  readonly vanCharge!: number;

  @ApiProperty({ description: "Suggested total to pay", example: 125.0 })
  readonly totalSuggested!: number;

  @ApiProperty({
    description: "Whether a payment record already exists for driver+date",
    example: false,
  })
  readonly exists!: boolean;

  @ApiPropertyOptional({
    description: "Whether this is a helper driver entry",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  readonly isHelper?: boolean;

  @ApiPropertyOptional({
    description: "ID of the primary driver if this is a helper",
    example: "uuid-string",
  })
  @IsOptional()
  @IsUUID()
  readonly helperFor?: string;
}

export class DailyPaymentUpsertItemDto {
  @ApiProperty({ description: "Driver ID" })
  @IsUUID()
  @IsNotEmpty()
  readonly driverId!: string;

  @ApiProperty({ enum: RouteType })
  @IsEnum(RouteType)
  readonly routeType!: RouteType;

  @ApiPropertyOptional({
    description: "Route code from Amazon sheet (e.g., CA_A270)",
  })
  @IsOptional()
  @IsString()
  readonly routeCode?: string;

  @ApiProperty({
    description: "Daily rate in GBP as string with 2 decimals",
    example: "125.00",
  })
  @IsString()
  @Transform(({ value }) => Number.parseFloat(value).toFixed(2))
  readonly dailyRate!: string;

  @ApiPropertyOptional({ description: "Extra amount in GBP", example: "0.00" })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value === undefined || value === null
      ? undefined
      : Number.parseFloat(value).toFixed(2)
  )
  readonly extraAmount?: string;

  @ApiPropertyOptional({
    description: "Deduction amount in GBP",
    example: "0.00",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value === undefined || value === null
      ? undefined
      : Number.parseFloat(value).toFixed(2)
  )
  readonly deductionAmount?: string;

  @ApiPropertyOptional({ description: "Van charge in GBP", example: "0.00" })
  @IsOptional()
  @IsString()
  @Transform(({ value }) =>
    value === undefined || value === null
      ? undefined
      : Number.parseFloat(value).toFixed(2)
  )
  readonly vanCharge?: string;

  @ApiPropertyOptional({ description: "Additional notes" })
  @IsOptional()
  @IsString()
  readonly notes?: string;

  @ApiPropertyOptional({
    description: "Source sheet name for traceability",
    example: "Thu 25-07-13",
  })
  @IsOptional()
  @IsString()
  readonly sourceSheet?: string;

  @ApiPropertyOptional({
    description: "Whether this is a helper driver entry",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  readonly isHelper?: boolean;

  @ApiPropertyOptional({
    description: "ID of the primary driver if this is a helper",
    example: "uuid-string",
  })
  @IsOptional()
  @IsUUID()
  readonly helperFor?: string;
}

export class SaveDailyPaymentsDto {
  @ApiProperty({
    description: "Target work date (YYYY-MM-DD)",
    example: "2025-07-13",
  })
  @IsDateString()
  @IsNotEmpty()
  readonly date!: string;

  @ApiProperty({ type: [DailyPaymentUpsertItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DailyPaymentUpsertItemDto)
  readonly items!: DailyPaymentUpsertItemDto[];
}

export class ImportXlsxPaymentsDto {
  @ApiProperty({
    description: "Target work date (YYYY-MM-DD)",
    example: "2025-08-18",
  })
  @IsDateString()
  @IsNotEmpty()
  readonly date!: string;

  @ApiPropertyOptional({
    description: "Source sheet identifier from XLSX",
    example: "Mon 25-08-18",
  })
  @IsOptional()
  @IsString()
  readonly sourceSheet?: string;

  @ApiProperty({
    description: "Base64 encoded XLSX file content",
    example:
      "UEsDBBQABgAIAAAAIQDfpNJsWgEAACAFAAATAAgCW0NvbnRlbnRfVHlwZXNdLnhtbCCiBAIooAACAAAAAA...",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50000000) // Allow up to ~50MB Base64 content (roughly 37MB actual file)
  readonly fileContent!: string;
}
