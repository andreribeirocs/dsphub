import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import {
  ScheduleService,
  WeekSchedule,
  DriverWithSchedules,
  ScheduleStats,
  ScheduleWithDriver,
} from "./schedule.service";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";
import { BulkScheduleDto } from "./dto/bulk-schedule.dto";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { DriverSchedule } from "@prisma/client";

@ApiTags("schedule")
@Controller("drivers/schedule")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, RolesGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  /**
   * Get week schedule structure
   * @param weekStart - Week start date in YYYY-MM-DD format
   * @returns Week schedule with days
   */
  @Get("week")
  @ApiOperation({
    summary: "Get week schedule structure",
    description:
      "Get the structure of a week with all days and their basic information",
  })
  @ApiQuery({
    name: "weekStart",
    description: "Week start date in YYYY-MM-DD format",
    example: "2024-01-01",
  })
  @ApiResponse({
    status: 200,
    description: "Week schedule structure retrieved successfully",
    schema: {
      type: "object",
      properties: {
        weekStart: { type: "string", format: "date" },
        weekEnd: { type: "string", format: "date" },
        days: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string", format: "date" },
              dayName: { type: "string" },
              dayNumber: { type: "number" },
              isToday: { type: "boolean" },
              schedules: { type: "array", items: {} },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  getWeekSchedule(@Query("weekStart") weekStart: string): WeekSchedule {
    return this.scheduleService.getWeekSchedule(weekStart);
  }

  /**
   * Get drivers with their schedules for a week
   * @param weekStart - Week start date in YYYY-MM-DD format
   * @returns Array of drivers with schedules
   */
  @Get("drivers")
  @ApiOperation({
    summary: "Get drivers with their schedules for a week",
    description:
      "Get all active drivers and their schedules for a specific week",
  })
  @ApiQuery({
    name: "weekStart",
    description: "Week start date in YYYY-MM-DD format",
    example: "2024-01-01",
  })
  @ApiResponse({
    status: 200,
    description: "Drivers with schedules retrieved successfully",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          status: { type: "string" },
          schedules: {
            type: "object",
            additionalProperties: {
              type: "object",
              properties: {
                driverId: { type: "string" },
                date: { type: "string" },
                status: { type: "string" },
                startTime: { type: "string", nullable: true },
                endTime: { type: "string", nullable: true },
                notes: { type: "string", nullable: true },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getDriversWithSchedules(
    @Query("weekStart") weekStart: string
  ): Promise<DriverWithSchedules[]> {
    return this.scheduleService.getDriversWithSchedules(weekStart);
  }

  /**
   * Get schedule statistics for a week
   * @param weekStart - Week start date in YYYY-MM-DD format
   * @returns Array of schedule statistics
   */
  @Get("stats")
  @ApiOperation({
    summary: "Get schedule statistics for a week",
    description:
      "Get statistical information about schedules for a specific week",
  })
  @ApiQuery({
    name: "weekStart",
    description: "Week start date in YYYY-MM-DD format",
    example: "2024-01-01",
  })
  @ApiResponse({
    status: 200,
    description: "Schedule statistics retrieved successfully",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string", format: "date" },
          totalScheduled: { type: "number" },
          completedCount: { type: "number" },
          pendingCount: { type: "number" },
          cancelledCount: { type: "number" },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getScheduleStats(
    @Query("weekStart") weekStart: string
  ): Promise<ScheduleStats[]> {
    return this.scheduleService.getScheduleStats(weekStart);
  }

  /**
   * Get schedules by date range
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @param driverId - Optional driver ID filter
   * @returns Array of schedules with driver information
   */
  @Get("range")
  @ApiOperation({
    summary: "Get schedules by date range",
    description:
      "Get all schedules within a specific date range with optional driver filter",
  })
  @ApiQuery({
    name: "startDate",
    description: "Start date in YYYY-MM-DD format",
    example: "2024-01-01",
  })
  @ApiQuery({
    name: "endDate",
    description: "End date in YYYY-MM-DD format",
    example: "2024-01-07",
  })
  @ApiQuery({
    name: "driverId",
    required: false,
    description: "Optional driver ID filter",
  })
  @ApiResponse({
    status: 200,
    description: "Schedules retrieved successfully",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          driverId: { type: "string" },
          date: { type: "string", format: "date" },
          status: { type: "string" },
          startTime: { type: "string", nullable: true },
          endTime: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          driver: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              status: { type: "string" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getSchedulesByDateRange(
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
    @Query("driverId") driverId?: string
  ): Promise<ScheduleWithDriver[]> {
    return this.scheduleService.getSchedulesByDateRange(
      startDate,
      endDate,
      driverId
    );
  }

  /**
   * Create a new schedule
   * @param createScheduleDto - Schedule creation data
   * @returns Created schedule with driver information
   */
  @Post()
  @ApiOperation({
    summary: "Create a new schedule",
    description: "Create a new schedule for a driver on a specific date",
  })
  @ApiBody({ type: CreateScheduleDto })
  @ApiResponse({
    status: 201,
    description: "Schedule created successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        driverId: { type: "string" },
        date: { type: "string", format: "date" },
        status: { type: "string" },
        startTime: { type: "string", nullable: true },
        endTime: { type: "string", nullable: true },
        notes: { type: "string", nullable: true },
        driver: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            status: { type: "string" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request - Invalid data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Driver not found" })
  @ApiResponse({
    status: 409,
    description: "Schedule already exists for this driver and date",
  })
  async createSchedule(
    @Body(ValidationPipe) createScheduleDto: CreateScheduleDto
  ): Promise<ScheduleWithDriver> {
    return this.scheduleService.createSchedule(createScheduleDto);
  }

  /**
   * Bulk update schedules
   * @param bulkScheduleDto - Bulk schedule update data
   * @returns Array of updated schedules
   */
  @Post("bulk")
  @ApiOperation({
    summary: "Bulk create schedules",
    description: "Create multiple schedules at once",
  })
  @ApiBody({ type: BulkScheduleDto })
  @ApiResponse({
    status: 201,
    description: "Schedules created successfully",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          driverId: { type: "string" },
          date: { type: "string", format: "date" },
          status: { type: "string" },
          startTime: { type: "string", nullable: true },
          endTime: { type: "string", nullable: true },
          notes: { type: "string", nullable: true },
          driver: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              status: { type: "string" },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request - Invalid data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async bulkUpdateSchedule(
    @Body(ValidationPipe) bulkScheduleDto: BulkScheduleDto
  ): Promise<ScheduleWithDriver[]> {
    return this.scheduleService.bulkUpdateSchedule(bulkScheduleDto);
  }

  /**
   * Update an existing schedule
   * @param id - Schedule ID
   * @param updateScheduleDto - Schedule update data
   * @returns Updated schedule with driver information
   */
  @Put(":id")
  @ApiOperation({
    summary: "Update an existing schedule",
    description: "Update a schedule by its ID",
  })
  @ApiParam({ name: "id", description: "Schedule ID" })
  @ApiBody({ type: UpdateScheduleDto })
  @ApiResponse({
    status: 200,
    description: "Schedule updated successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        driverId: { type: "string" },
        date: { type: "string", format: "date" },
        status: { type: "string" },
        startTime: { type: "string", nullable: true },
        endTime: { type: "string", nullable: true },
        notes: { type: "string", nullable: true },
        driver: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            status: { type: "string" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request - Invalid data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Schedule not found" })
  async updateSchedule(
    @Param("id") id: string,
    @Body(ValidationPipe) updateScheduleDto: UpdateScheduleDto
  ): Promise<ScheduleWithDriver> {
    return this.scheduleService.updateSchedule(id, updateScheduleDto);
  }

  /**
   * Delete a schedule
   * @param driverId - Driver ID
   * @param date - Schedule date
   * @returns Deleted schedule
   */
  @Delete(":driverId/:date")
  @ApiOperation({
    summary: "Delete a schedule",
    description: "Delete a schedule for a specific driver and date",
  })
  @ApiParam({ name: "driverId", description: "Driver ID" })
  @ApiParam({ name: "date", description: "Schedule date in YYYY-MM-DD format" })
  @ApiResponse({
    status: 200,
    description: "Schedule deleted successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        driverId: { type: "string" },
        date: { type: "string", format: "date" },
        status: { type: "string" },
        startTime: { type: "string", nullable: true },
        endTime: { type: "string", nullable: true },
        notes: { type: "string", nullable: true },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Schedule not found" })
  async deleteSchedule(
    @Param("driverId") driverId: string,
    @Param("date") date: string
  ): Promise<DriverSchedule> {
    return this.scheduleService.deleteSchedule(driverId, date);
  }
}
