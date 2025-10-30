import {
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RouteType } from "@prisma/client";

export class CreateInvoiceItemDto {
  @ApiProperty({ description: "Work date" })
  @IsDateString()
  readonly date: string;

  @ApiProperty({ description: "Description of work performed" })
  @IsString()
  readonly description: string;

  @ApiProperty({ description: "Route type", enum: RouteType })
  @IsEnum(RouteType)
  readonly routeType: RouteType;

  @ApiPropertyOptional({ description: "Route code" })
  @IsOptional()
  @IsString()
  readonly routeCode?: string;

  @ApiProperty({ description: "Amount for this item" })
  @IsNumber()
  readonly amount: number;

  @ApiPropertyOptional({ description: "Reference to driver payment ID" })
  @IsOptional()
  @IsString()
  readonly paymentId?: string;
}

export class CreateInvoiceDto {
  @ApiProperty({ description: "Driver ID" })
  @IsString()
  readonly driverId: string;

  @ApiProperty({ description: "Week start date" })
  @IsDateString()
  readonly weekStartDate: string;

  @ApiProperty({ description: "Week end date" })
  @IsDateString()
  readonly weekEndDate: string;

  @ApiProperty({ description: "Total amount", type: Number })
  @IsNumber()
  readonly totalAmount: number;

  @ApiPropertyOptional({ description: "Currency code", default: "GBP" })
  @IsOptional()
  @IsString()
  readonly currency?: string;

  @ApiPropertyOptional({ description: "Invoice notes" })
  @IsOptional()
  @IsString()
  readonly notes?: string;

  @ApiProperty({ description: "Invoice items", type: [CreateInvoiceItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  readonly items: CreateInvoiceItemDto[];
}
