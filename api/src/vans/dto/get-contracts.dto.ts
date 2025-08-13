import { IsOptional, IsString, IsEnum } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { ContractStatus } from "@prisma/client";

export class GetContractsDto {
  @ApiPropertyOptional({
    enum: ContractStatus,
    description: "Filter by contract status",
    example: "ACTIVE",
  })
  @IsOptional()
  @IsEnum(ContractStatus)
  readonly status?: ContractStatus;

  @ApiPropertyOptional({
    description: "Filter by depot",
    example: "DP01",
  })
  @IsOptional()
  @IsString()
  readonly depot?: string;

  @ApiPropertyOptional({
    description: "Filter by supplier",
    example: "Enterprise",
  })
  @IsOptional()
  @IsString()
  readonly supplier?: string;

  @ApiPropertyOptional({
    description: "Search by contract name or hire name",
    example: "Amazon",
  })
  @IsOptional()
  @IsString()
  readonly search?: string;
}
