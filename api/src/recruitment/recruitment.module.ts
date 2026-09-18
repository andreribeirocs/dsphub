import { Module } from "@nestjs/common";
import { RecruitmentService } from "./recruitment.service";
import { RecruitmentController } from "./recruitment.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";
import { RecruitmentWorkflowController } from "./workflow/recruitment-workflow.controller";
import { RecruitmentWorkflowService } from "./workflow/recruitment-workflow.service";

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [RecruitmentController, RecruitmentWorkflowController],
  // MESSAGING_PROVIDER comes from the global MessagingModule
  providers: [RecruitmentService, RecruitmentWorkflowService],
})
export class RecruitmentModule {}
