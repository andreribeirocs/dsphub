import { Module } from "@nestjs/common";
import { RecruitmentService } from "./recruitment.service";
import { RecruitmentController } from "./recruitment.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { WhatsAppService } from "../shared/services/twilio.service";

@Module({
  imports: [PrismaModule],
  controllers: [RecruitmentController],
  providers: [RecruitmentService, WhatsAppService],
})
export class RecruitmentModule {}
