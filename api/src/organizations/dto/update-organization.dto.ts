import { PartialType } from "@nestjs/mapped-types";
import { CreateOrganizationDto } from "./create-organization.dto";
import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { OperatingModel } from "@prisma/client";

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  /** DSP_1_0 (van rented weekly, kept 24/7) or DSP_2_0 (van collected daily at the depot) */
  @IsEnum(OperatingModel)
  @IsOptional()
  operatingModel?: OperatingModel;
}
