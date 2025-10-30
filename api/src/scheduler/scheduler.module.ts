import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { SchedulerService } from "../scheduler/scheduler.service";
import { InvoicesModule } from "../invoices/invoices.module";
import { UsersModule } from "../users/users.module";

@Module({
  imports: [ScheduleModule.forRoot(), InvoicesModule, UsersModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
