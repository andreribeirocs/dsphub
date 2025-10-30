import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { CreateInvoiceItemDto } from "./create-invoice.dto";

export class UpdateInvoiceDto {
  @ApiPropertyOptional({ description: "Total amount", type: Number })
  @IsOptional()
  @IsNumber()
  readonly totalAmount?: number;

  @ApiPropertyOptional({ description: "Invoice notes" })
  @IsOptional()
  @IsString()
  readonly notes?: string;

  @ApiPropertyOptional({
    description: "Invoice items",
    type: [CreateInvoiceItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  readonly items?: CreateInvoiceItemDto[];
}
