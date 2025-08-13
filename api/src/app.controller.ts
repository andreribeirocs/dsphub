import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { PrismaService } from "./prisma/prisma.service";
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger";

@ApiTags("health")
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  @ApiOperation({ summary: "Get application info" })
  @ApiResponse({ status: 200, description: "Application information" })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get("health")
  @ApiOperation({ summary: "Health check endpoint" })
  @ApiResponse({ status: 200, description: "Application health status" })
  async getHealth() {
    const dbHealth = await this.prisma.getHealthInfo();

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "unknown",
      database: dbHealth,
    };
  }

  @Get("health/db")
  @ApiOperation({ summary: "Database health and performance stats" })
  @ApiResponse({ status: 200, description: "Database performance information" })
  async getDatabaseHealth() {
    const healthInfo = await this.prisma.getHealthInfo();
    const performanceStats = await this.prisma.getPerformanceStats();

    return {
      health: healthInfo,
      performance: performanceStats,
    };
  }
}
