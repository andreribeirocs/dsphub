import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsInt,
  Min,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { RouteType } from "@prisma/client";
import { Transform } from "class-transformer";

export class GetPaymentHistoryDto {
  @ApiPropertyOptional({
    enum: RouteType,
    description: "Filter by route type",
    example: "FULL_ROUTE",
  })
  @IsOptional()
  @IsEnum(RouteType)
  readonly routeType?: RouteType;

  @ApiPropertyOptional({
    description: "Start date for filtering (ISO string)",
    example: "2024-01-01T00:00:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  readonly startDate?: string;

  @ApiPropertyOptional({
    description: "End date for filtering (ISO string)",
    example: "2024-12-31T23:59:59.999Z",
  })
  @IsOptional()
  @IsDateString()
  readonly endDate?: string;

  @ApiPropertyOptional({
    description: "Page number for pagination",
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  readonly page?: number = 1;

  @ApiPropertyOptional({
    description: "Number of items per page",
    example: 20,
    minimum: 1,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  readonly limit?: number = 20;
}
