import { Module } from "@nestjs/common";
import { DriversController } from "./drivers.controller";
import { DriversService } from "./drivers.service";
import { ScheduleController } from "./schedule.controller";
import { ScheduleService } from "./schedule.service";
import { PrismaService } from "../prisma/prisma.service";

@Module({
  controllers: [DriversController, ScheduleController],
  providers: [DriversService, ScheduleService, PrismaService],
  exports: [DriversService, ScheduleService],
})
export class DriversModule {}
