import { IsOptional, IsString, IsEnum, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { VanStatus, VanCondition } from "@prisma/client";
import { Transform } from "class-transformer";

export class GetVansDto {
  @ApiPropertyOptional({
    enum: VanStatus,
    description: "Filter by van status",
    example: "AVAILABLE",
  })
  @IsOptional()
  @IsEnum(VanStatus)
  readonly status?: VanStatus;

  @ApiPropertyOptional({
    enum: VanCondition,
    description: "Filter by van condition",
    example: "GOOD",
  })
  @IsOptional()
  @IsEnum(VanCondition)
  readonly condition?: VanCondition;

  @ApiPropertyOptional({
    description: "Filter by depot",
    example: "DP01",
  })
  @IsOptional()
  @IsString()
  readonly depot?: string;

  @ApiPropertyOptional({ description: "Filter by depot id" })
  @IsOptional()
  @IsString()
  readonly depotId?: string;

  @ApiPropertyOptional({
    description: "Filter by contract name",
    example: "Amazon",
  })
  @IsOptional()
  @IsString()
  readonly contract?: string;

  @ApiPropertyOptional({
    description: "Search by van number, registration, or make/model",
    example: "03",
  })
  @IsOptional()
  @IsString()
  readonly search?: string;

  @ApiPropertyOptional({
    description: "Show only vans with expiring MOT (within 30 days)",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  readonly expiringMot?: boolean;

  @ApiPropertyOptional({
    description: "Show only vans requiring maintenance attention",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  readonly maintenanceAlerts?: boolean;

  @ApiPropertyOptional({
    description: "Filter by vehicle make",
    example: "Mercedes",
  })
  @IsOptional()
  @IsString()
  readonly make?: string;
}
