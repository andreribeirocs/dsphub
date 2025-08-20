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
  DailyPaymentUpsertItemDto,
  ImportXlsxPaymentsDto,
} from "./dto/daily-payment.dto";
import * as XLSX from "xlsx";

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
   * Prefill daily payments for a specific date - INDEPENDENT from driver schedules
   * Only loads existing payment records. New drivers must be added manually or via XLSX import
   */
  async prefillDailyPayments(
    query: GetDailyPaymentsPrefillDto
  ): Promise<DailyPaymentPrefillItemDto[]> {
    const { date, includeExisting = true } = query;
    const targetDate = new Date(date);

    if (!includeExisting) {
      return [];
    }

    // Get existing payments for that date (only ACTIVE drivers)
    const allExisting = await this.prisma.driverPayment.findMany({
      where: { workDate: targetDate },
      include: {
        driver: {
          select: { id: true, name: true, transporterId: true, status: true },
        },
      },
      orderBy: { driver: { name: "asc" } },
    });

    // Filter out INACTIVE drivers
    const existing = allExisting.filter((e) => e.driver.status === "ACTIVE");

    // Convert existing payments to the required format
    const items: DailyPaymentPrefillItemDto[] = existing.map((payment) => {
      const base = Number(payment.dailyRate);
      const extra = Number(payment.extraAmount) || 0;
      const deduction = Number(payment.deductionAmount) || 0;
      const van = Number(payment.vanCharge) || 0;

      return {
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
        exists: true, // All items are existing payments
      };
    });

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

      // Daily Payment is now independent - no sync with driver schedules
      console.log("Daily payments saved successfully (independent mode)");
    });

    return { created, updated };
  }

  /**
   * Import daily payments from XLSX file (FUTURE IMPLEMENTATION)
   * Will parse Amazon-provided Excel sheets and create payment records
   */
  async importFromXlsx(
    input: ImportXlsxPaymentsDto
  ): Promise<{ created: number; updated: number; errors: string[] }> {
    const { date, sourceSheet, fileContent } = input;
    const errors: string[] = [];

    try {
      // 1. Parse Base64 file content
      const buffer = Buffer.from(fileContent, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer" });

      // Get the first worksheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new BadRequestException("No worksheets found in the Excel file");
      }

      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // 2. Extract payment data from Excel
      const paymentItems: DailyPaymentUpsertItemDto[] = [];

      // Debug: Log the Excel structure
      this.logger.debug(`Excel file has ${jsonData.length} rows`);
      if (jsonData.length > 0) {
        this.logger.debug(`Header row: ${JSON.stringify(jsonData[0])}`);
      }
      if (jsonData.length > 1) {
        this.logger.debug(`First data row: ${JSON.stringify(jsonData[1])}`);
      }

      // Skip header row(s) and process data rows
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];

        // Skip empty rows
        if (!row || row.length === 0 || !row[0]) continue;

        try {
          // Amazon XLSX format based on image:
          // Column A: Route code (e.g., CA_A221)
          // Column B: DSP
          // Column C: Transporter ID
          // Column D: Driver name
          // Column E: Route progress
          // Column F: Delivery service type
          // Columns G+: Other data (duration, stops, etc.)

          const routeCode = String(row[0] || "").trim(); // Column A
          const dsp = String(row[1] || "").trim(); // Column B (not used but available)
          const transporterIds = String(row[2] || "").trim(); // Column C - may contain multiple IDs
          const driverNames = String(row[3] || "").trim(); // Column D - may contain multiple names
          const routeProgress = String(row[4] || "").trim(); // Column E (not used but available)
          const deliveryServiceType = String(row[5] || "").trim(); // Column F

          // Debug: Log what we found in this row
          this.logger.debug(
            `Row ${i + 1}: Route=${routeCode}, TransporterIDs=${transporterIds}, Drivers=${driverNames}, ServiceType=${deliveryServiceType}`
          );

          // For manual amounts, we'll set defaults since Amazon doesn't provide these
          const dailyRateStr = "0"; // Will be filled manually
          const extraAmountStr = "0"; // Will be filled manually
          const deductionAmountStr = "0"; // Will be filled manually
          const vanChargeStr = "0"; // Will be filled manually

          // Skip empty rows
          if (!driverNames || !deliveryServiceType) {
            this.logger.debug(`Row ${i + 1}: Skipping empty row`);
            continue;
          }

          // Handle multiple drivers (separated by |)
          const transporterIdList = transporterIds
            .split("|")
            .map((id) => id.trim())
            .filter((id) => id);
          const driverNameList = driverNames
            .split("|")
            .map((name) => name.trim())
            .filter((name) => name);

          this.logger.debug(
            `Row ${i + 1}: Found ${driverNameList.length} driver(s): ${driverNameList.join(", ")}`
          );

          // Validate delivery service type (map to route type) - same for all drivers on this route
          const routeType = this.validateRouteType(deliveryServiceType);
          if (!routeType) {
            this.logger.debug(
              `Invalid delivery service type: "${deliveryServiceType}"`
            );
            errors.push(
              `Row ${i + 1}: Invalid delivery service type "${deliveryServiceType}"`
            );
            continue;
          }
          this.logger.debug(
            `Route type mapped: ${deliveryServiceType} -> ${routeType}`
          );

          // Process each driver
          for (
            let driverIndex = 0;
            driverIndex < driverNameList.length;
            driverIndex++
          ) {
            const driverName = driverNameList[driverIndex];
            const transporterId = transporterIdList[driverIndex] || ""; // May not have corresponding ID

            this.logger.debug(
              `Row ${i + 1}, Driver ${driverIndex + 1}: Processing "${driverName}" (TransporterID: "${transporterId}")`
            );

            // Find driver by transporter ID first, then fallback to name
            const driver = await this.findDriverByTransporterIdOrName(
              transporterId,
              driverName
            );
            if (!driver) {
              this.logger.debug(
                `Driver not found by TransporterID "${transporterId}" or Name "${driverName}"`
              );
              errors.push(
                `Row ${i + 1}: Driver "${driverName}" (TransporterID: ${transporterId}) not found`
              );
              continue; // Skip this driver, but continue with others
            }
            this.logger.debug(
              `Driver found: ${driver.name} (ID: ${driver.id}, TransporterID: ${driver.transporterId})`
            );

            // Parse amounts
            const dailyRate = this.parseAmount(dailyRateStr);
            const extraAmount = this.parseAmount(extraAmountStr);
            const deductionAmount = this.parseAmount(deductionAmountStr);
            const vanCharge = this.parseAmount(vanChargeStr);

            // Create a plain object that matches the DTO structure for this driver
            const item = {
              driverId: driver.id,
              routeType,
              routeCode: routeCode || undefined,
              dailyRate: dailyRate.toFixed(2),
              extraAmount: extraAmount > 0 ? extraAmount.toFixed(2) : undefined,
              deductionAmount:
                deductionAmount > 0 ? deductionAmount.toFixed(2) : undefined,
              vanCharge: vanCharge > 0 ? vanCharge.toFixed(2) : undefined,
              sourceSheet:
                sourceSheet ||
                `Import_${new Date().toISOString().slice(0, 10)}`,
              notes:
                driverNameList.length > 1
                  ? `Shared route with: ${driverNameList.filter((_, idx) => idx !== driverIndex).join(", ")}`
                  : undefined,
            };

            paymentItems.push(item as DailyPaymentUpsertItemDto);
          }
        } catch (rowError) {
          errors.push(`Row ${i + 1}: ${rowError.message}`);
        }
      }

      if (paymentItems.length === 0) {
        throw new BadRequestException(
          "No valid payment records found in the Excel file"
        );
      }

      // 4. Create payment records using a special XLSX import method
      const result = await this.saveXlsxPayments(
        date,
        paymentItems,
        sourceSheet
      );

      this.logger.log(
        `XLSX import completed: ${result.created} created, ${result.updated} updated, ${errors.length} errors`
      );

      return {
        created: result.created,
        updated: result.updated,
        errors,
      };
    } catch (error) {
      this.logger.error("XLSX import failed:", error);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to process Excel file: ${error.message}`
      );
    }
  }

  /**
   * Special method for XLSX imports that handles multiple records per driver
   * and potential conflicts with existing records
   */
  private async saveXlsxPayments(
    date: string,
    paymentItems: DailyPaymentUpsertItemDto[],
    sourceSheet?: string
  ): Promise<{ created: number; updated: number }> {
    const workDate = new Date(date);
    let created = 0;
    let updated = 0;

    return await this.prisma.$transaction(async (tx) => {
      // Group items by driver to handle multiple routes per driver
      const itemsByDriver = new Map<string, DailyPaymentUpsertItemDto[]>();

      for (const item of paymentItems) {
        if (!itemsByDriver.has(item.driverId)) {
          itemsByDriver.set(item.driverId, []);
        }
        itemsByDriver.get(item.driverId)!.push(item);
      }

      for (const [driverId, driverItems] of itemsByDriver) {
        // Check if driver already has payment record for this date
        const existingPayment = await tx.driverPayment.findUnique({
          where: {
            driverId_workDate: {
              driverId: driverId,
              workDate: workDate,
            },
          },
        });

        if (driverItems.length === 1) {
          // Single record for this driver - normal case
          const item = driverItems[0];
          const data = {
            driverId: item.driverId,
            workDate: workDate,
            routeType: item.routeType,
            routeCode: item.routeCode ?? null,
            dailyRate: new Prisma.Decimal(item.dailyRate),
            extraAmount: item.extraAmount
              ? new Prisma.Decimal(item.extraAmount)
              : null,
            deductionAmount: item.deductionAmount
              ? new Prisma.Decimal(item.deductionAmount)
              : null,
            vanCharge: item.vanCharge
              ? new Prisma.Decimal(item.vanCharge)
              : null,
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

          if (!existingPayment) {
            await tx.driverPayment.create({ data });
            created += 1;
          } else {
            await tx.driverPayment.update({
              where: { id: existingPayment.id },
              data: {
                routeType: data.routeType,
                routeCode: data.routeCode,
                dailyRate: data.dailyRate,
                extraAmount: data.extraAmount,
                deductionAmount: data.deductionAmount,
                vanCharge: data.vanCharge,
                totalPaid: data.totalPaid,
                sourceSheet: data.sourceSheet,
                notes: data.notes,
              },
            });
            updated += 1;
          }
        } else {
          // Multiple records for same driver (shared routes)
          // Combine them into a single payment record with combined notes
          const combinedRoutes = driverItems
            .map((item) => item.routeCode)
            .filter(Boolean)
            .join(", ");
          const combinedNotes = driverItems
            .map((item) => item.notes)
            .filter(Boolean)
            .join("; ");

          // Use the first item as base, but combine route information
          const firstItem = driverItems[0];
          const data = {
            driverId: firstItem.driverId,
            workDate: workDate,
            routeType: firstItem.routeType,
            routeCode: combinedRoutes || null,
            dailyRate: new Prisma.Decimal(firstItem.dailyRate),
            extraAmount: firstItem.extraAmount
              ? new Prisma.Decimal(firstItem.extraAmount)
              : null,
            deductionAmount: firstItem.deductionAmount
              ? new Prisma.Decimal(firstItem.deductionAmount)
              : null,
            vanCharge: firstItem.vanCharge
              ? new Prisma.Decimal(firstItem.vanCharge)
              : null,
            totalPaid: new Prisma.Decimal(
              (
                Number(firstItem.dailyRate) +
                Number(firstItem.extraAmount ?? 0) -
                Number(firstItem.deductionAmount ?? 0) -
                Number(firstItem.vanCharge ?? 0)
              ).toFixed(2)
            ),
            isPaid: false,
            paidDate: null,
            paidBy: null,
            sourceSheet: sourceSheet || firstItem.sourceSheet || null,
            notes: combinedNotes || `Multiple routes: ${combinedRoutes}`,
          };

          if (!existingPayment) {
            await tx.driverPayment.create({ data });
            created += 1;
          } else {
            await tx.driverPayment.update({
              where: { id: existingPayment.id },
              data: {
                routeType: data.routeType,
                routeCode: data.routeCode,
                dailyRate: data.dailyRate,
                extraAmount: data.extraAmount,
                deductionAmount: data.deductionAmount,
                vanCharge: data.vanCharge,
                totalPaid: data.totalPaid,
                sourceSheet: data.sourceSheet,
                notes: data.notes,
              },
            });
            updated += 1;
          }
        }
      }

      return { created, updated };
    });
  }

  private async findDriverByTransporterIdOrName(
    transporterId: string,
    name: string
  ): Promise<{ id: string; name: string; transporterId: string } | null> {
    // Priority 1: Try exact match by transporter ID (most reliable)
    if (transporterId) {
      // Clean the transporter ID: remove spaces and extra characters
      const cleanTransporterId = transporterId.replace(/\s+/g, "").trim();

      const driver = await this.prisma.driver.findFirst({
        where: {
          transporterId: { equals: cleanTransporterId, mode: "insensitive" },
          status: "ACTIVE",
        },
        select: { id: true, name: true, transporterId: true },
      });

      if (driver) {
        this.logger.debug(
          `Driver found by TransporterID: ${transporterId} (cleaned: ${cleanTransporterId}) -> ${driver.name}`
        );
        return driver;
      }
    }

    // Priority 2: Try exact match by name (case insensitive)
    let driver = await this.prisma.driver.findFirst({
      where: {
        name: { equals: name, mode: "insensitive" },
        status: "ACTIVE",
      },
      select: { id: true, name: true, transporterId: true },
    });

    if (driver) {
      this.logger.debug(
        `Driver found by exact name: ${name} -> ${driver.name}`
      );
      return driver;
    }

    // Priority 3: Try fuzzy matching by name (remove extra spaces, case insensitive)
    const normalizedName = name.toLowerCase().replace(/\s+/g, " ").trim();
    driver = await this.prisma.driver.findFirst({
      where: {
        name: { contains: normalizedName, mode: "insensitive" },
        status: "ACTIVE",
      },
      select: { id: true, name: true, transporterId: true },
    });

    if (driver) {
      this.logger.debug(
        `Driver found by fuzzy name: ${name} -> ${driver.name}`
      );
      return driver;
    }

    return null;
  }

  private validateRouteType(routeTypeStr: string): RouteType | null {
    const validRouteTypes: RouteType[] = [
      "FULL_ROUTE",
      "TRAINING_DAY",
      "HIDE_ALONG",
      "SAME_DAY",
      "NURSERY_ROUTE",
      "EXTRAS",
      "ORDT_EXTRA_LARGE_CARGO_VAN",
      "STANDARD_PARCEL_MEDIUM_VAN",
      "NURSERY_ROUTE_LEVEL_1",
    ];

    const normalized = routeTypeStr.toUpperCase().replace(/\s+/g, "_");

    // Direct match
    if (validRouteTypes.includes(normalized as RouteType)) {
      return normalized as RouteType;
    }

    // Amazon delivery service type mappings
    const deliveryServiceMappings: Record<string, RouteType> = {
      ORDT_EXTRA_LARGE_CARGO_VAN: "ORDT_EXTRA_LARGE_CARGO_VAN",
      STANDARD_PARCEL_MEDIUM_VAN: "STANDARD_PARCEL_MEDIUM_VAN",
      NURSERY_ROUTE_LEVEL_1: "NURSERY_ROUTE_LEVEL_1",
      // Handle variations
      ORDT_EXTRA_LARGE: "ORDT_EXTRA_LARGE_CARGO_VAN",
      STANDARD_PARCEL: "STANDARD_PARCEL_MEDIUM_VAN",
      NURSERY_LEVEL_1: "NURSERY_ROUTE_LEVEL_1",
      NURSERY_LEVEL: "NURSERY_ROUTE_LEVEL_1",
    };

    // Check delivery service mappings first
    if (deliveryServiceMappings[normalized]) {
      return deliveryServiceMappings[normalized];
    }

    // Legacy aliases for backward compatibility
    const legacyAliases: Record<string, RouteType> = {
      FULL: "FULL_ROUTE",
      TRAINING: "TRAINING_DAY",
      RIDE: "HIDE_ALONG",
      HIDE: "HIDE_ALONG",
      SAME: "SAME_DAY",
      NURSERY: "NURSERY_ROUTE",
      EXTRA: "EXTRAS",
    };

    return legacyAliases[normalized] || null;
  }

  private parseAmount(amountStr: string): number {
    if (!amountStr) return 0;

    // Remove currency symbols and whitespace
    const cleaned = amountStr.replace(/[£$€,\s]/g, "");
    const amount = parseFloat(cleaned);

    return isNaN(amount) ? 0 : Math.max(0, amount);
  }
}
