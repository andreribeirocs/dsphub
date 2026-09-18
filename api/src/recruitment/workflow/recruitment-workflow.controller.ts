import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { BetterAuthGuard } from "../../auth/guards/better-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { ThrottleStrict } from "../../auth/decorators/throttle.decorator";
import {
  BulkContactDto,
  ImportLeadsDto,
  ReplaceDocumentDto,
  ReviewBackgroundDto,
  ReviewDocumentDto,
  ScheduleClassroomDto,
  ScheduleRideAlongDto,
  WorkflowQueryDto,
} from "../dto/workflow.dto";
import { RecruitmentWorkflowService } from "./recruitment-workflow.service";

const recruiterRoles = [
  "SUPER_ADMIN",
  "OWNER",
  "DIRECTOR",
  "MANAGER_RECRUITMENT",
];

@Controller("recruitment/workflow")
@UseGuards(BetterAuthGuard, RolesGuard)
export class RecruitmentWorkflowController {
  constructor(private readonly workflow: RecruitmentWorkflowService) {}

  @Get("summary")
  @Roles(...recruiterRoles)
  summary() {
    return this.workflow.summary();
  }

  @Get("candidates")
  @Roles(...recruiterRoles)
  list(@Query() query: WorkflowQueryDto) {
    return this.workflow.list(query);
  }

  @Post("import")
  @Roles(...recruiterRoles)
  importLeads(
    @Body() dto: ImportLeadsDto,
    @CurrentUser() user: { id: string }
  ) {
    return this.workflow.importLeads(dto, user.id);
  }

  @Post("contact")
  @Roles(...recruiterRoles)
  @ThrottleStrict()
  contact(@Body() dto: BulkContactDto, @CurrentUser() user: { id: string }) {
    return this.workflow.contact(dto, user.id);
  }

  @Patch(":id/documents")
  @Roles(...recruiterRoles)
  documents(
    @Param("id") id: string,
    @Body() dto: ReviewDocumentDto,
    @CurrentUser() user: { id: string }
  ) {
    return this.workflow.reviewDocument(id, dto, user.id);
  }

  @Patch(":id/background")
  @Roles(...recruiterRoles)
  background(
    @Param("id") id: string,
    @Body() dto: ReviewBackgroundDto,
    @CurrentUser() user: { id: string }
  ) {
    return this.workflow.reviewBackground(id, dto, user.id);
  }

  @Patch(":id/documents/replace")
  @Roles(...recruiterRoles)
  replaceDocument(
    @Param("id") id: string,
    @Body() dto: ReplaceDocumentDto,
    @CurrentUser() user: { id: string }
  ) {
    return this.workflow.replaceDocument(id, dto, user.id);
  }

  @Post(":id/classroom")
  @Roles(...recruiterRoles)
  classroom(
    @Param("id") id: string,
    @Body() dto: ScheduleClassroomDto,
    @CurrentUser() user: { id: string }
  ) {
    return this.workflow.scheduleClassroom(id, dto.date, user.id);
  }

  @Post(":id/classroom/complete")
  @Roles(...recruiterRoles)
  completeClassroom(
    @Param("id") id: string,
    @CurrentUser() user: { id: string }
  ) {
    return this.workflow.completeClassroom(id, user.id);
  }

  @Post(":id/ride-along")
  @Roles(...recruiterRoles)
  rideAlong(
    @Param("id") id: string,
    @Body() dto: ScheduleRideAlongDto,
    @CurrentUser() user: { id: string }
  ) {
    return this.workflow.scheduleRideAlong(id, dto, user.id);
  }
}
