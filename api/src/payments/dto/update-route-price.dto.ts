import {
  IsEnum,
  IsNotEmpty,
  IsDecimal,
  IsOptional,
  IsString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { RouteType } from "@prisma/client";
import { Transform } from "class-transformer";

export class UpdateRoutePriceDto {
  @ApiProperty({
    enum: RouteType,
    description: "Type of route",
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
    description: "Reason for the price change",
    example: "Annual rate adjustment",
  })
  @IsOptional()
  @IsString()
  readonly changeReason?: string;
}
