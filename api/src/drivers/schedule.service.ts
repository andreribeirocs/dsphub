import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateScheduleDto } from "./dto/create-schedule.dto";
import { UpdateScheduleDto } from "./dto/update-schedule.dto";
import { BulkScheduleDto } from "./dto/bulk-schedule.dto";
import { Prisma, DriverSchedule } from "@prisma/client";

// Constants
const DAYS_IN_WEEK = 7;
const HOURS_PER_DAY = 8;

export interface WeekDay {
  readonly date: string;
  readonly dayName: string;
  readonly dayNumber: number;
  readonly isToday: boolean;
  readonly schedules: DriverSchedule[];
}

export interface WeekSchedule {
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly days: WeekDay[];
}

export interface DriverWithSchedules {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly schedules: Record<string, ScheduleData>;
}

export interface ScheduleData {
  readonly driverId: string;
  readonly date: string;
  readonly status: string;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly notes: string | null;
}

export interface ScheduleStats {
  readonly title: string;
  readonly value: string;
  readonly change: string;
  readonly icon: string;
  readonly color: string;
  readonly bgColor: string;
}

export type ScheduleWithDriver = DriverSchedule & {
  driver: {
    id: string;
    name: string;
    status: string;
  };
};

@Injectable()
export class ScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new schedule for a driver
   * @param createScheduleDto - Schedule creation data
   * @returns Created schedule with driver information
   * @throws NotFoundException if driver not found
   * @throws ConflictException if schedule already exists
   */
  async createSchedule(
    createScheduleDto: CreateScheduleDto
  ): Promise<ScheduleWithDriver> {
    const { driverId, date, ...scheduleData } = createScheduleDto;

    // Check if driver exists
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException(`Driver with ID ${driverId} not found`);
    }

    // Check if schedule already exists for this driver and date
    const existingSchedule = await this.prisma.driverSchedule.findUnique({
      where: {
        driverId_date: {
          driverId,
          date: new Date(date),
        },
      },
    });

    if (existingSchedule) {
      throw new ConflictException(
        `Schedule already exists for driver ${driverId} on ${date}`
      );
    }

    return this.prisma.driverSchedule.create({
      data: {
        driverId,
        date: new Date(date),
        ...scheduleData,
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Update an existing schedule
   * @param id - Schedule ID
   * @param updateScheduleDto - Schedule update data
   * @returns Updated schedule with driver information
   * @throws NotFoundException if schedule not found
   */
  async updateSchedule(
    id: string,
    updateScheduleDto: UpdateScheduleDto
  ): Promise<ScheduleWithDriver> {
    const schedule = await this.prisma.driverSchedule.findUnique({
      where: { id },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${id} not found`);
    }

    const { date, ...updateData } = updateScheduleDto;

    return this.prisma.driverSchedule.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...updateData,
      },
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Delete a schedule for a specific driver and date
   * @param driverId - Driver ID
   * @param date - Schedule date
   * @returns Deleted schedule
   * @throws NotFoundException if schedule not found
   */
  async deleteSchedule(
    driverId: string,
    date: string
  ): Promise<DriverSchedule> {
    const schedule = await this.prisma.driverSchedule.findUnique({
      where: {
        driverId_date: {
          driverId,
          date: new Date(date),
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException(
        `Schedule not found for driver ${driverId} on ${date}`
      );
    }

    return this.prisma.driverSchedule.delete({
      where: { id: schedule.id },
    });
  }

  /**
   * Get week schedule structure with days
   * @param weekStart - Week start date in YYYY-MM-DD format
   * @returns Week schedule structure
   */
  getWeekSchedule(weekStart: string): WeekSchedule {
    // Parse the date string explicitly to avoid timezone issues
    const [year, month, day] = weekStart.split("-").map(Number);
    const startDate = new Date(year, month - 1, day); // month is 0-indexed
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // Generate all days of the week
    const days: WeekDay[] = [];
    const today = new Date();

    for (let i = 0; i < DAYS_IN_WEEK; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);

      days.push({
        date: date.toISOString().split("T")[0],
        dayName: date.toLocaleDateString("en-US", { weekday: "short" }),
        dayNumber: date.getDate(),
        isToday: date.toDateString() === today.toDateString(),
        schedules: [],
      });
    }

    return {
      weekStart: startDate.toISOString().split("T")[0],
      weekEnd: endDate.toISOString().split("T")[0],
      days,
    };
  }

  /**
   * Get drivers with their schedules for a specific week
   * @param weekStart - Week start date in YYYY-MM-DD format
   * @returns Array of drivers with their schedules
   */
  async getDriversWithSchedules(
    weekStart: string
  ): Promise<DriverWithSchedules[]> {
    // Parse the date string explicitly to avoid timezone issues
    const [year, month, day] = weekStart.split("-").map(Number);
    const startDate = new Date(year, month - 1, day); // month is 0-indexed
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const drivers = await this.prisma.driver.findMany({
      where: {
        status: "ACTIVE",
      },
      include: {
        schedules: {
          where: {
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      status: driver.status,
      schedules: driver.schedules.reduce(
        (acc, schedule) => {
          const dateKey = schedule.date.toISOString().split("T")[0];
          acc[dateKey] = {
            driverId: schedule.driverId,
            date: dateKey,
            status: schedule.status,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            notes: schedule.notes,
          };
          return acc;
        },
        {} as Record<string, ScheduleData>
      ),
    }));
  }

  /**
   * Get schedule statistics for a specific week
   * @param weekStart - Week start date in YYYY-MM-DD format
   * @returns Array of schedule statistics
   */
  async getScheduleStats(weekStart: string): Promise<ScheduleStats[]> {
    // Parse the date string explicitly to avoid timezone issues
    const [year, month, day] = weekStart.split("-").map(Number);
    const startDate = new Date(year, month - 1, day); // month is 0-indexed
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    const [totalScheduled, activeDrivers, workingHours] = await Promise.all([
      this.prisma.driverSchedule.count({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
      }),
      this.prisma.driver.count({
        where: { status: "ACTIVE" },
      }),
      this.prisma.driverSchedule.count({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
          status: {
            in: [
              "FULL_ROUTE",
              "TRAINING_DAY",
              "SAME_DAY",
              "NURSERY_ROUTE",
              "RIDE_ALONG",
            ],
          },
        },
      }),
    ]);

    const utilization =
      activeDrivers > 0
        ? Math.round((workingHours / (activeDrivers * DAYS_IN_WEEK)) * 100)
        : 0;

    return [
      {
        title: "Total Scheduled",
        value: `${totalScheduled * HOURS_PER_DAY}h`, // Assuming 8 hours per full day
        change: "+12% from last week",
        icon: "calendar",
        color: "text-blue-600",
        bgColor: "bg-blue-100",
      },
      {
        title: "Active Drivers",
        value: activeDrivers.toString(),
        change: "5 new this week",
        icon: "users",
        color: "text-green-600",
        bgColor: "bg-green-100",
      },
      {
        title: "Working Hours",
        value: `${workingHours * HOURS_PER_DAY}h`, // Assuming 8 hours per working day
        change: "This week",
        icon: "clock",
        color: "text-purple-600",
        bgColor: "bg-purple-100",
      },
      {
        title: "Utilization",
        value: `${utilization}%`,
        change: "+3% improvement",
        icon: "trending-up",
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
      },
    ];
  }

  /**
   * Bulk update or create schedules
   * @param bulkScheduleDto - Bulk schedule data
   * @returns Array of created/updated schedules
   */
  async bulkUpdateSchedule(
    bulkScheduleDto: BulkScheduleDto
  ): Promise<ScheduleWithDriver[]> {
    const { schedules } = bulkScheduleDto;
    const results: ScheduleWithDriver[] = [];

    // Use transaction for bulk operations
    await this.prisma.$transaction(async (prisma) => {
      for (const scheduleDto of schedules) {
        const { driverId, date, ...scheduleData } = scheduleDto;

        // Upsert: create if doesn't exist, update if exists
        const result = await prisma.driverSchedule.upsert({
          where: {
            driverId_date: {
              driverId,
              date: new Date(date),
            },
          },
          create: {
            driverId,
            date: new Date(date),
            ...scheduleData,
          },
          update: {
            ...scheduleData,
          },
          include: {
            driver: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
        });

        results.push(result);
      }
    });

    return results;
  }

  /**
   * Get schedules by date range with optional driver filter
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @param driverId - Optional driver ID filter
   * @returns Array of schedules with driver information
   */
  async getSchedulesByDateRange(
    startDate: string,
    endDate: string,
    driverId?: string
  ): Promise<ScheduleWithDriver[]> {
    const where: Prisma.DriverScheduleWhereInput = {
      date: {
        gte: new Date(startDate),
        lte: new Date(endDate),
      },
    };

    if (driverId) {
      where.driverId = driverId;
    }

    return this.prisma.driverSchedule.findMany({
      where,
      include: {
        driver: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { driver: { name: "asc" } }],
    });
  }
}
