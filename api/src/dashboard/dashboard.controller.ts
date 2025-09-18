import { Controller, Get, UseGuards } from "@nestjs/common";
import { DashboardService } from "../dashboard/dashboard.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
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
