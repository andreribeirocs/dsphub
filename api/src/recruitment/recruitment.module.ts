import { Module } from "@nestjs/common";
import { RecruitmentService } from "./recruitment.service";
import { RecruitmentController } from "./recruitment.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [RecruitmentController],
  // MESSAGING_PROVIDER comes from the global MessagingModule
  providers: [RecruitmentService],
})
export class RecruitmentModule {}
