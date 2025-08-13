import { IsOptional, IsString, IsEnum, IsBoolean } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { MaintenanceStatus, MaintenancePriority } from "@prisma/client";
import { Transform } from "class-transformer";

export class GetMaintenanceDto {
  @ApiPropertyOptional({
    description: "Filter by van ID",
  })
  @IsOptional()
  @IsString()
  readonly vanId?: string;

  @ApiPropertyOptional({
    enum: MaintenanceStatus,
    description: "Filter by maintenance status",
    example: "SCHEDULED",
  })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  readonly status?: MaintenanceStatus;

  @ApiPropertyOptional({
    enum: MaintenancePriority,
    description: "Filter by priority",
    example: "HIGH",
  })
  @IsOptional()
  @IsEnum(MaintenancePriority)
  readonly priority?: MaintenancePriority;

  @ApiPropertyOptional({
    description: "Filter by maintenance type",
    example: "MOT",
  })
  @IsOptional()
  @IsString()
  readonly type?: string;

  @ApiPropertyOptional({
    description: "Show only overdue maintenance",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  readonly overdueOnly?: boolean;

  @ApiPropertyOptional({
    description: "Show only upcoming maintenance (next 30 days)",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  readonly upcomingOnly?: boolean;
}
