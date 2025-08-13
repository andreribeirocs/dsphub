import { IsOptional, IsString, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";

export class GetPartsDto {
  @ApiPropertyOptional({
    description: "Filter by category",
    example: "Mirror",
  })
  @IsOptional()
  @IsString()
  readonly category?: string;

  @ApiPropertyOptional({
    description: "Search by part name or description",
    example: "mirror",
  })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({
    description: "Filter by supplier",
    example: "Euro Car Parts",
  })
  @IsOptional()
  @IsString()
  readonly supplier?: string;

  @ApiPropertyOptional({
    description: "Show only active parts",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  readonly activeOnly?: boolean;

  @ApiPropertyOptional({
    description: "Show only parts with low stock (below minimum)",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  readonly lowStockOnly?: boolean;

  @ApiPropertyOptional({
    description: "Filter by vehicle make compatibility",
    example: "Mercedes",
  })
  @IsOptional()
  @IsString()
  readonly vehicleMake?: string;
}
