import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";

// Services
import { VansService } from "./vans.service";
import { ContractsService } from "./contracts.service";
import { MaintenanceService } from "./maintenance.service";
import { PartsService } from "./parts.service";

// Controllers
import { VansController } from "./vans.controller";
import { ContractsController } from "./contracts.controller";
import { MaintenanceController } from "./maintenance.controller";
import { PartsController } from "./parts.controller";

@Module({
  imports: [PrismaModule],
  controllers: [
    VansController,
    ContractsController,
    MaintenanceController,
    PartsController,
  ],
  providers: [VansService, ContractsService, MaintenanceService, PartsService],
  exports: [VansService, ContractsService, MaintenanceService, PartsService],
})
export class VansModule {}
