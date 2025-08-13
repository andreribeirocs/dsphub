import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateRoutePriceDto } from "./dto/update-route-price.dto";
import { GetPaymentHistoryDto } from "./dto/get-payment-history.dto";
import {
  CreateDriverPaymentDto,
  UpdateDriverPaymentDto,
  GetDriverPaymentsDto,
} from "./dto/driver-payment.dto";
import { RouteType, Prisma } from "@prisma/client";
import {
  RoutePrice,
  PaymentHistoryItem,
  DashboardStats,
} from "./types/payment.types";
import {
  GetDailyPaymentsPrefillDto,
  SaveDailyPaymentsDto,
  DailyPaymentPrefillItemDto,
} from "./dto/daily-payment.dto";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all current route prices for the dashboard
   */
  async getAllRoutePrices(): Promise<RoutePrice[]> {
    try {
      const prices = await this.prisma.routePrice.findMany({
        include: {
          updatedByUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          routeType: "asc",
        },
      });

      return prices.map((price) => ({
        id: price.id,
        routeType: price.routeType,
        dailyRate: Number(price.dailyRate),
        lastUpdated: price.lastUpdated,
        updatedBy: price.updatedBy,
        updatedByUser: price.updatedByUser,
      }));
    } catch (error) {
      this.logger.error("Error fetching route prices:", error);
      throw new BadRequestException("Failed to fetch route prices");
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const [routePrices, priceHistoryCount] = await Promise.all([
        this.prisma.routePrice.findMany(),
        this.prisma.paymentHistory.count({
          where: {
            changeDate: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1), // This month
            },
          },
        }),
      ]);

      const dailyRevenuePotential = routePrices.reduce(
        (sum, price) => sum + Number(price.dailyRate),
        0
      );

      return {
        totalRoutes: routePrices.length,
        dailyRevenuePotential,
        priceChanges: priceHistoryCount,
      };
    } catch (error) {
      this.logger.error("Error fetching dashboard stats:", error);
      throw new BadRequestException("Failed to fetch dashboard statistics");
    }
  }

  /**
   * Update a route price (only for financial managers and directors)
   */
  async updateRoutePrice(
    updateData: UpdateRoutePriceDto,
    userId: string
  ): Promise<RoutePrice> {
    try {
      const { routeType, dailyRate, changeReason } = updateData;

      // Get current price for history tracking
      const currentPrice = await this.prisma.routePrice.findUnique({
        where: { routeType },
      });

      if (!currentPrice) {
        throw new NotFoundException(`Route price for ${routeType} not found`);
      }

      const newRate = new Prisma.Decimal(dailyRate);
      const oldRate = currentPrice.dailyRate;

      // Check if the rate is actually different
      if (oldRate.equals(newRate)) {
        throw new BadRequestException("New rate is the same as current rate");
      }

      // Update the route price and create history record in a transaction
      const updatedPrice = await this.prisma.$transaction(async (tx) => {
        // Update the route price
        const updated = await tx.routePrice.update({
          where: { routeType },
          data: {
            dailyRate: newRate,
            lastUpdated: new Date(),
            updatedBy: userId,
          },
          include: {
            updatedByUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        });

        // Create history record
        await tx.paymentHistory.create({
          data: {
            routePriceId: updated.id,
            routeType,
            oldRate,
            newRate,
            changeReason,
            changedBy: userId,
          },
        });

        return updated;
      });

      this.logger.log(
        `Route price updated: ${routeType} from £${oldRate} to £${newRate} by user ${userId}`
      );

      return {
        id: updatedPrice.id,
        routeType: updatedPrice.routeType,
        dailyRate: Number(updatedPrice.dailyRate),
        lastUpdated: updatedPrice.lastUpdated,
        updatedBy: updatedPrice.updatedBy,
        updatedByUser: updatedPrice.updatedByUser,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error("Error updating route price:", error);
      throw new BadRequestException("Failed to update route price");
    }
  }

  /**
   * Get payment history with filtering and pagination
   */
  async getPaymentHistory(filters: GetPaymentHistoryDto): Promise<{
    readonly items: PaymentHistoryItem[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
  }> {
    try {
      const { routeType, startDate, endDate, page = 1, limit = 20 } = filters;

      const whereClause: Prisma.PaymentHistoryWhereInput = {};

      if (routeType) {
        whereClause.routeType = routeType;
      }

      if (startDate || endDate) {
        whereClause.changeDate = {};
        if (startDate) {
          whereClause.changeDate.gte = new Date(startDate);
        }
        if (endDate) {
          whereClause.changeDate.lte = new Date(endDate);
        }
      }

      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        this.prisma.paymentHistory.findMany({
          where: whereClause,
          include: {
            changedByUser: {
              select: {
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            changeDate: "desc",
          },
          skip,
          take: limit,
        }),
        this.prisma.paymentHistory.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        items: items.map((item) => ({
          id: item.id,
          routeType: item.routeType,
          oldRate: item.oldRate ? Number(item.oldRate) : null,
          newRate: Number(item.newRate),
          changeReason: item.changeReason,
          changeDate: item.changeDate,
          changedByUser: item.changedByUser,
        })),
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      this.logger.error("Error fetching payment history:", error);
      throw new BadRequestException("Failed to fetch payment history");
    }
  }

  /**
   * Create a driver payment record
   */
  async createDriverPayment(
    paymentData: CreateDriverPaymentDto,
    userId: string
  ): Promise<any> {
    try {
      const {
        driverId,
        workDate,
        routeType,
        dailyRate,
        hoursWorked,
        totalPaid,
        notes,
      } = paymentData;

      // Check if driver exists
      const driver = await this.prisma.driver.findUnique({
        where: { id: driverId },
        select: { id: true, name: true, transporterId: true },
      });

      if (!driver) {
        throw new NotFoundException("Driver not found");
      }

      // Check if payment already exists for this driver and date
      const existingPayment = await this.prisma.driverPayment.findUnique({
        where: {
          driverId_workDate: {
            driverId,
            workDate: new Date(workDate),
          },
        },
      });

      if (existingPayment) {
        throw new BadRequestException(
          "Payment record already exists for this driver and date"
        );
      }

      const payment = await this.prisma.driverPayment.create({
        data: {
          driverId,
          workDate: new Date(workDate),
          routeType,
          dailyRate: new Prisma.Decimal(dailyRate),
          hoursWorked: hoursWorked ? new Prisma.Decimal(hoursWorked) : null,
          totalPaid: new Prisma.Decimal(totalPaid),
          notes,
        },
        include: {
          driver: {
            select: {
              name: true,
              transporterId: true,
            },
          },
        },
      });

      this.logger.log(
        `Driver payment created for ${driver.name} (${driver.transporterId}) on ${workDate}`
      );

      return {
        id: payment.id,
        driverId: payment.driverId,
        driver: payment.driver,
        workDate: payment.workDate,
        routeType: payment.routeType,
        dailyRate: Number(payment.dailyRate),
        hoursWorked: payment.hoursWorked ? Number(payment.hoursWorked) : null,
        totalPaid: Number(payment.totalPaid),
        isPaid: payment.isPaid,
        paidDate: payment.paidDate,
        notes: payment.notes,
        createdAt: payment.createdAt,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error("Error creating driver payment:", error);
      throw new BadRequestException("Failed to create driver payment");
    }
  }

  /**
   * Get driver payments with filtering
   */
  async getDriverPayments(filters: GetDriverPaymentsDto): Promise<any[]> {
    try {
      const { driverId, routeType, startDate, endDate, isPaid } = filters;

      const whereClause: Prisma.DriverPaymentWhereInput = {};

      if (driverId) {
        whereClause.driverId = driverId;
      }

      if (routeType) {
        whereClause.routeType = routeType;
      }

      if (startDate || endDate) {
        whereClause.workDate = {};
        if (startDate) {
          whereClause.workDate.gte = new Date(startDate);
        }
        if (endDate) {
          whereClause.workDate.lte = new Date(endDate);
        }
      }

      if (isPaid !== undefined) {
        whereClause.isPaid = isPaid;
      }

      const payments = await this.prisma.driverPayment.findMany({
        where: whereClause,
        include: {
          driver: {
            select: {
              name: true,
              transporterId: true,
              email: true,
            },
          },
          paidByUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      });

      return payments.map((payment) => ({
        id: payment.id,
        driverId: payment.driverId,
        driver: payment.driver,
        workDate: payment.workDate,
        routeType: payment.routeType,
        routeCode: payment.routeCode,
        dailyRate: Number(payment.dailyRate),
        hoursWorked: payment.hoursWorked ? Number(payment.hoursWorked) : null,
        extraAmount: payment.extraAmount ? Number(payment.extraAmount) : null,
        deductionAmount: payment.deductionAmount
          ? Number(payment.deductionAmount)
          : null,
        vanCharge: payment.vanCharge ? Number(payment.vanCharge) : null,
        totalPaid: Number(payment.totalPaid),
        isPaid: payment.isPaid,
        paidDate: payment.paidDate,
        paidBy: payment.paidBy,
        paidByUser: payment.paidByUser,
        sourceSheet: payment.sourceSheet,
        notes: payment.notes,
        createdAt: payment.createdAt,
      }));
    } catch (error) {
      this.logger.error("Error fetching driver payments:", error);
      throw new BadRequestException("Failed to fetch driver payments");
    }
  }

  /**
   * Update driver payment status (mark as paid)
   */
  async updateDriverPayment(
    paymentId: string,
    updateData: UpdateDriverPaymentDto,
    userId: string
  ): Promise<any> {
    try {
      const payment = await this.prisma.driverPayment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new NotFoundException("Payment record not found");
      }

      const updatedPayment = await this.prisma.driverPayment.update({
        where: { id: paymentId },
        data: {
          ...updateData,
          paidDate: updateData.isPaid
            ? new Date(updateData.paidDate || new Date())
            : null,
          paidBy: updateData.isPaid ? userId : null,
        },
        include: {
          driver: {
            select: {
              name: true,
              transporterId: true,
            },
          },
          paidByUser: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      this.logger.log(`Driver payment ${paymentId} updated by user ${userId}`);

      return {
        id: updatedPayment.id,
        driverId: updatedPayment.driverId,
        driver: updatedPayment.driver,
        workDate: updatedPayment.workDate,
        routeType: updatedPayment.routeType,
        dailyRate: Number(updatedPayment.dailyRate),
        hoursWorked: updatedPayment.hoursWorked
          ? Number(updatedPayment.hoursWorked)
          : null,
        totalPaid: Number(updatedPayment.totalPaid),
        isPaid: updatedPayment.isPaid,
        paidDate: updatedPayment.paidDate,
        paidByUser: updatedPayment.paidByUser,
        notes: updatedPayment.notes,
        updatedAt: updatedPayment.updatedAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error("Error updating driver payment:", error);
      throw new BadRequestException("Failed to update driver payment");
    }
  }

  /**
   * Prefill daily payments for a specific date using driver schedules and current route prices
   */
  async prefillDailyPayments(
    query: GetDailyPaymentsPrefillDto
  ): Promise<DailyPaymentPrefillItemDto[]> {
    const { date, includeExisting = true } = query;
    const targetDate = new Date(date);

    // Fetch active schedules for that day (only ACTIVE drivers)
    const allSchedules = await this.prisma.driverSchedule.findMany({
      where: {
        date: targetDate,
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
      include: {
        driver: {
          select: { id: true, name: true, transporterId: true, status: true },
        },
      },
      orderBy: { driver: { name: "asc" } },
    });

    // Filter out INACTIVE drivers in JavaScript since Prisma nested filter isn't working
    const schedules = allSchedules.filter((s) => s.driver.status === "ACTIVE");

    console.log(
      `Found ${allSchedules.length} total schedules, ${schedules.length} with ACTIVE drivers for ${date}:`,
      schedules.map((s) => ({
        name: s.driver.name,
        status: s.driver.status,
        scheduleStatus: s.status,
      }))
    );

    // Fetch route prices to suggest amounts
    const prices = await this.prisma.routePrice.findMany();
    const priceByType = new Map(
      prices.map((p) => [p.routeType, Number(p.dailyRate)])
    );

    // Get existing payments for that date (only ACTIVE drivers)
    const allExisting = await this.prisma.driverPayment.findMany({
      where: { workDate: targetDate },
      include: {
        driver: {
          select: { id: true, name: true, transporterId: true, status: true },
        },
      },
    });

    // Filter out INACTIVE drivers in JavaScript since Prisma nested filter isn't working
    const existing = allExisting.filter((e) => e.driver.status === "ACTIVE");

    console.log(
      `Found ${allExisting.length} total payments, ${existing.length} with ACTIVE drivers for ${date}:`,
      existing.map((e) => ({
        name: e.driver.name,
        status: e.driver.status,
      }))
    );
    const existingSet = new Set(existing.map((e) => e.driverId));

    const mapScheduleToRouteType = (status: string): RouteType => {
      switch (status) {
        case "FULL_ROUTE":
          return "FULL_ROUTE";
        case "TRAINING_DAY":
          return "TRAINING_DAY";
        case "SAME_DAY":
          return "SAME_DAY";
        case "NURSERY_ROUTE":
          return "NURSERY_ROUTE";
        case "RIDE_ALONG":
          // Schedule uses RIDE_ALONG; payments use HIDE_ALONG
          return "HIDE_ALONG";
        default:
          return "FULL_ROUTE";
      }
    };

    // Start with scheduled drivers
    const items: DailyPaymentPrefillItemDto[] = schedules
      .filter((s) => includeExisting || !existingSet.has(s.driverId))
      .map((s) => {
        const routeType = mapScheduleToRouteType(s.status);
        const dailyRate = priceByType.get(routeType) ?? 0;
        const base = Number(dailyRate);
        const extra = 0;
        const deduction = 0;
        const van = 0;
        return {
          driverId: s.driverId,
          driverName: s.driver.name,
          transporterId: s.driver.transporterId,
          workDate: date,
          routeType,
          routeCode: undefined,
          dailyRate: base,
          extraAmount: extra,
          deductionAmount: deduction,
          vanCharge: van,
          totalSuggested: base + extra - deduction - van,
          exists: existingSet.has(s.driverId),
        };
      });

    // Add existing payment records that don't have schedules (manually added drivers)
    if (includeExisting) {
      const scheduledDriverIds = new Set(schedules.map((s) => s.driverId));

      for (const payment of existing) {
        if (!scheduledDriverIds.has(payment.driverId)) {
          // This driver has a payment but no schedule - add them
          const base = Number(payment.dailyRate);
          const extra = Number(payment.extraAmount) || 0;
          const deduction = Number(payment.deductionAmount) || 0;
          const van = Number(payment.vanCharge) || 0;

          items.push({
            driverId: payment.driverId,
            driverName: payment.driver.name,
            transporterId: payment.driver.transporterId,
            workDate: date,
            routeType: payment.routeType,
            routeCode: payment.routeCode ?? undefined,
            dailyRate: base,
            extraAmount: extra,
            deductionAmount: deduction,
            vanCharge: van,
            totalSuggested: base + extra - deduction - van,
            exists: true, // This payment already exists
          });
        }
      }
    }

    return items;
  }

  /**
   * Save daily payments in bulk for a given date
   * This replaces all existing payments for the date with the new list
   */
  async saveDailyPayments(
    input: SaveDailyPaymentsDto,
    userId: string
  ): Promise<{ created: number; updated: number }> {
    const { date, items } = input;
    const workDate = new Date(date);

    let created = 0;
    let updated = 0;

    await this.prisma.$transaction(async (tx) => {
      // First, get all existing payments for this date
      const existingPayments = await tx.driverPayment.findMany({
        where: { workDate },
        select: { id: true, driverId: true },
      });

      // Get driver IDs that are being saved
      const newDriverIds = new Set(items.map((item) => item.driverId));

      // Delete payments for drivers that are no longer in the list
      const paymentsToDelete = existingPayments.filter(
        (payment) => !newDriverIds.has(payment.driverId)
      );

      if (paymentsToDelete.length > 0) {
        await tx.driverPayment.deleteMany({
          where: {
            id: { in: paymentsToDelete.map((p) => p.id) },
          },
        });
      }

      // Create or update payments for the new list
      for (const item of items) {
        const existing = existingPayments.find(
          (p) => p.driverId === item.driverId
        );

        const data: Prisma.DriverPaymentUncheckedCreateInput = {
          driverId: item.driverId,
          workDate,
          routeType: item.routeType,
          routeCode: item.routeCode ?? null,
          dailyRate: new Prisma.Decimal(item.dailyRate),
          hoursWorked: null,
          extraAmount: item.extraAmount
            ? new Prisma.Decimal(item.extraAmount)
            : null,
          deductionAmount: item.deductionAmount
            ? new Prisma.Decimal(item.deductionAmount)
            : null,
          vanCharge: item.vanCharge ? new Prisma.Decimal(item.vanCharge) : null,
          totalPaid: new Prisma.Decimal(
            (
              Number(item.dailyRate) +
              Number(item.extraAmount ?? 0) -
              Number(item.deductionAmount ?? 0) -
              Number(item.vanCharge ?? 0)
            ).toFixed(2)
          ),
          isPaid: false,
          paidDate: null,
          paidBy: null,
          sourceSheet: item.sourceSheet ?? null,
          notes: item.notes ?? null,
        };

        if (!existing) {
          await tx.driverPayment.create({ data });
          created += 1;
        } else {
          await tx.driverPayment.update({
            where: { id: existing.id },
            data: {
              routeType: data.routeType,
              routeCode: data.routeCode ?? undefined,
              dailyRate: data.dailyRate,
              extraAmount: data.extraAmount,
              deductionAmount: data.deductionAmount,
              vanCharge: data.vanCharge,
              totalPaid: data.totalPaid,
              sourceSheet: data.sourceSheet ?? undefined,
              notes: data.notes ?? undefined,
            },
          });
          updated += 1;
        }
      }

      // Sync route types back to driver schedules and handle deletions
      console.log("Syncing route types back to driver schedules...");

      // First, handle deleted drivers - set their schedules to OFF
      const deletedDriverIds = paymentsToDelete.map((p) => p.driverId);
      if (deletedDriverIds.length > 0) {
        console.log(
          `Setting schedules to OFF for deleted drivers: ${deletedDriverIds.join(", ")}`
        );
        for (const driverId of deletedDriverIds) {
          try {
            const existingSchedule = await tx.driverSchedule.findFirst({
              where: {
                driverId: driverId,
                date: workDate,
              },
            });

            if (existingSchedule) {
              console.log(
                `Setting schedule ${existingSchedule.id} to OFF for deleted driver ${driverId}`
              );
              await tx.driverSchedule.update({
                where: { id: existingSchedule.id },
                data: { status: "OFF" },
              });
            }
          } catch (error) {
            console.warn(
              `Failed to set schedule to OFF for deleted driver ${driverId}:`,
              error
            );
          }
        }
      }

      // Then, update route types for remaining drivers
      for (const item of items) {
        try {
          // Find matching driver schedule for this date/driver
          const existingSchedule = await tx.driverSchedule.findFirst({
            where: {
              driverId: item.driverId,
              date: workDate,
            },
          });

          if (existingSchedule && existingSchedule.status !== item.routeType) {
            console.log(
              `Updating schedule ${existingSchedule.id} from ${existingSchedule.status} to ${item.routeType}`
            );
            await tx.driverSchedule.update({
              where: { id: existingSchedule.id },
              data: { status: item.routeType as any },
            });
          }
        } catch (error) {
          console.warn(
            `Failed to sync schedule for driver ${item.driverId}:`,
            error
          );
          // Don't fail the payment save if schedule sync fails
        }
      }
    });

    return { created, updated };
  }
}
