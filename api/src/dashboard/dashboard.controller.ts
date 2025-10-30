import { Controller, Get, UseGuards } from "@nestjs/common";
import { DashboardService } from "../dashboard/dashboard.service";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("dashboard")
@UseGuards(BetterAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("recent-activities")
  async getRecentActivities() {
    return this.dashboardService.getRecentActivities();
  }

  @Get("stats")
  async getDashboardStats() {
    return this.dashboardService.getDashboardStats();
  }
}
