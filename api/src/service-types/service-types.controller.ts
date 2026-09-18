import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ServiceTypesService } from "./service-types.service";
import {
  CreateServiceTypeDto,
  UpdateServiceTypeDto,
} from "./dto/service-type.dto";

const LEADERS = ["SUPER_ADMIN", "OWNER", "DIRECTOR"];

@ApiTags("service-types")
@Controller("service-types")
@UseGuards(BetterAuthGuard, RolesGuard)
export class ServiceTypesController {
  constructor(private readonly serviceTypesService: ServiceTypesService) {}

  @Get()
  @ApiOperation({ summary: "Service types of the current DSP" })
  findAll(@Query("includeInactive") includeInactive?: string) {
    return this.serviceTypesService.findAll(includeInactive === "true");
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.serviceTypesService.findOne(id);
  }

  @Post()
  @Roles(...LEADERS)
  @ApiOperation({ summary: "Create a service type for this DSP" })
  create(@Body() dto: CreateServiceTypeDto) {
    return this.serviceTypesService.create(dto);
  }

  @Patch(":id")
  @Roles(...LEADERS)
  @ApiOperation({ summary: "Rename, set hours, reorder or reactivate" })
  update(@Param("id") id: string, @Body() dto: UpdateServiceTypeDto) {
    return this.serviceTypesService.update(id, dto);
  }

  @Delete(":id")
  @Roles(...LEADERS)
  @ApiOperation({ summary: "Deactivate a service type (history is kept)" })
  deactivate(@Param("id") id: string) {
    return this.serviceTypesService.deactivate(id);
  }
}
