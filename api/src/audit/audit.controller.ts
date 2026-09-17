import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuditService } from "./audit.service";
import type { AuditQuery } from "./audit.service";

@ApiTags("audit")
@Controller("audit")
@UseGuards(BetterAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("logs")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR")
  @ApiOperation({ summary: "Audit trail of the current DSP (sign-ins and price changes)" })
  list(@Query() query: AuditQuery) {
    return this.auditService.list(query);
  }
}
