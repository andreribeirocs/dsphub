import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { DepotsService } from "./depots.service";
import { CreateDepotDto, SetMemberDepotsDto, UpdateDepotDto } from "./dto/depot.dto";

const LEADERS = ["SUPER_ADMIN", "OWNER", "DIRECTOR"];

@ApiTags("depots")
@Controller("depots")
@UseGuards(BetterAuthGuard, RolesGuard)
export class DepotsController {
  constructor(private readonly depotsService: DepotsService) {}

  @Get()
  @ApiOperation({ summary: "Depots of the current DSP visible to the user" })
  findAll(@Query("includeInactive") includeInactive?: string) {
    return this.depotsService.findAll(includeInactive === "true");
  }

  @Post()
  @Roles(...LEADERS)
  @ApiOperation({ summary: "Create a depot" })
  create(@Body() dto: CreateDepotDto) {
    return this.depotsService.create(dto);
  }

  @Get("members/:userId")
  @Roles(...LEADERS)
  @ApiOperation({ summary: "Depots a user is limited to" })
  getMemberDepots(@Param("userId") userId: string) {
    return this.depotsService.getMemberDepots(userId);
  }

  @Put("members/:userId")
  @Roles(...LEADERS)
  @ApiOperation({ summary: "Limit a user to some depots (empty = every depot)" })
  setMemberDepots(@Param("userId") userId: string, @Body() dto: SetMemberDepotsDto) {
    return this.depotsService.setMemberDepots(userId, dto.depotIds);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.depotsService.findOne(id);
  }

  @Patch(":id")
  @Roles(...LEADERS)
  @ApiOperation({ summary: "Update or deactivate a depot" })
  update(@Param("id") id: string, @Body() dto: UpdateDepotDto) {
    return this.depotsService.update(id, dto);
  }
}
