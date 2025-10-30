import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PdfService } from "../pdf/pdf.service";
import { EmailService } from "../email/email.service";
import { PaymentsService } from "../payments/payments.service";
import { Prisma, InvoiceStatus } from "@prisma/client";
import { writeFile } from "fs/promises";
import { join } from "path";
import type {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  GenerateWeeklyInvoicesDto,
  GenerateWeeklyInvoicesResult,
  SendInvoicesDto,
  SendInvoicesResult,
  GetInvoicesDto,
} from "./dto";

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService
  ) {}

  /**
   * Generate weekly invoices for all active drivers
   * Week runs from Sunday (start) to Saturday (end)
   */
  async generateWeeklyInvoices(
    dto: GenerateWeeklyInvoicesDto
  ): Promise<GenerateWeeklyInvoicesResult> {
    // Parse date string as YYYY-MM-DD and create Date objects at noon to avoid timezone issues
    const [year, month, day] = dto.weekStartDate.split("-").map(Number);
    const weekStartDate = new Date(year, month - 1, day, 12, 0, 0); // month is 0-indexed, set to noon
    const weekEndDate = new Date(year, month - 1, day + 6, 12, 0, 0); // Sunday + 6 days = Saturday, set to noon

    this.logger.log(`Received weekStartDate: ${dto.weekStartDate}`);
    this.logger.log(`Parsed weekStartDate: ${weekStartDate.toISOString()}`);
    this.logger.log(
      `Week start for DB (local): ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    );
    this.logger.log(
      `Week end for DB (local): ${year}-${String(month).padStart(2, "0")}-${String(day + 6).padStart(2, "0")}`
    );
    this.logger.log(
      `Generating invoices for week: ${weekStartDate.toISOString().split("T")[0]} (Sun) to ${weekEndDate.toISOString().split("T")[0]} (Sat)`
    );

    const invoices: GenerateWeeklyInvoicesResult["invoices"] = [];
    const errorDetails: GenerateWeeklyInvoicesResult["errorDetails"] = [];
    let generated = 0;
    let skipped = 0;
    let errors = 0;

    // Get all active drivers or specific drivers if provided
    const drivers = await this.prisma.driver.findMany({
      where: dto.driverIds
        ? { id: { in: dto.driverIds }, status: "ACTIVE" }
        : { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        transporterId: true,
        email: true,
        address: true,
        organizationId: true,
      },
    });

    this.logger.log(`Found ${drivers.length} active drivers to process`);

    for (const driver of drivers) {
      try {
        // Check if invoice already exists for this driver and week
        const existingInvoice = await this.prisma.driverInvoice.findFirst({
          where: {
            driverId: driver.id,
            weekStartDate,
            weekEndDate,
          },
        });

        if (existingInvoice) {
          this.logger.log(
            `Invoice already exists for driver ${driver.name} (${driver.transporterId}), skipping`
          );
          skipped++;
          continue;
        }

        // Get all payments for this driver in the week
        const payments = await this.prisma.driverPayment.findMany({
          where: {
            driverId: driver.id,
            workDate: {
              gte: weekStartDate,
              lte: weekEndDate,
            },
          },
          orderBy: { workDate: "asc" },
        });

        if (payments.length === 0) {
          this.logger.log(
            `No payments found for driver ${driver.name} (${driver.transporterId}), skipping`
          );
          skipped++;
          continue;
        }

        // Calculate totals
        const subtotal = payments.reduce(
          (sum, p) => sum + Number(p.dailyRate),
          0
        );
        const extras = payments.reduce(
          (sum, p) => sum + (Number(p.extraAmount) || 0),
          0
        );
        const deductions = payments.reduce(
          (sum, p) => sum + (Number(p.deductionAmount) || 0),
          0
        );
        const vanCharges = payments.reduce(
          (sum, p) => sum + (Number(p.vanCharge) || 0),
          0
        );
        const totalAmount = subtotal + extras - deductions - vanCharges;

        // Generate invoice number
        const year = weekStartDate.getFullYear();
        const weekNumber = this.getWeekNumber(weekStartDate);
        const shortDriverId = driver.transporterId.substring(0, 6);
        const invoiceNumber = `INV-${year}-W${weekNumber.toString().padStart(2, "0")}-${shortDriverId}`;

        // Create invoice with items
        const invoice = await this.prisma.driverInvoice.create({
          data: {
            organizationId: driver.organizationId,
            driverId: driver.id,
            invoiceNumber,
            weekStartDate,
            weekEndDate,
            totalAmount: new Prisma.Decimal(totalAmount.toFixed(2)),
            currency: "GBP",
            status: InvoiceStatus.DRAFT,
            items: {
              create: payments.map((payment) => ({
                paymentId: payment.id,
                date: payment.workDate,
                description: payment.routeCode
                  ? `Route: ${payment.routeCode} - ${payment.routeType}`
                  : payment.routeType,
                routeType: payment.routeType,
                routeCode: payment.routeCode,
                amount: payment.totalPaid,
              })),
            },
          },
        });

        invoices.push({
          invoiceId: invoice.id,
          driverId: driver.id,
          driverName: driver.name,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: Number(invoice.totalAmount),
        });

        generated++;
        this.logger.log(
          `Generated invoice ${invoiceNumber} for driver ${driver.name} (${driver.transporterId}): £${totalAmount.toFixed(2)}`
        );
      } catch (error) {
        errors++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to generate invoice for driver ${driver.name} (${driver.transporterId}):`,
          error
        );
        errorDetails.push({
          driverId: driver.id,
          driverName: driver.name,
          error: errorMessage,
        });
      }
    }

    this.logger.log(
      `Invoice generation complete: ${generated} generated, ${skipped} skipped, ${errors} errors`
    );

    return {
      generated,
      skipped,
      errors,
      invoices,
      errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
    };
  }

  /**
   * Get invoices with filtering and pagination
   */
  async getInvoices(filters: GetInvoicesDto): Promise<any> {
    const {
      driverId,
      status,
      weekStartFrom,
      weekStartTo,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.DriverInvoiceWhereInput = {};

    if (driverId) {
      where.driverId = driverId;
    }

    if (status) {
      where.status = status as InvoiceStatus;
    }

    if (weekStartFrom || weekStartTo) {
      where.weekStartDate = {};
      if (weekStartFrom) {
        where.weekStartDate.gte = new Date(weekStartFrom);
      }
      if (weekStartTo) {
        where.weekStartDate.lte = new Date(weekStartTo);
      }
    }

    const skip = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      this.prisma.driverInvoice.findMany({
        where,
        include: {
          driver: {
            select: {
              name: true,
              transporterId: true,
              email: true,
            },
          },
          sentByUser: {
            select: {
              name: true,
              email: true,
            },
          },
          _count: {
            select: { items: true },
          },
        },
        orderBy: [{ weekStartDate: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      this.prisma.driverInvoice.count({ where }),
    ]);

    return {
      items: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        driverId: inv.driverId,
        driver: inv.driver,
        weekStartDate: inv.weekStartDate,
        weekEndDate: inv.weekEndDate,
        status: inv.status,
        totalAmount: Number(inv.totalAmount),
        currency: inv.currency,
        pdfUrl: inv.pdfUrl,
        sentAt: inv.sentAt,
        sentBy: inv.sentByUser,
        itemCount: inv._count.items,
        createdAt: inv.createdAt,
        updatedAt: inv.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single invoice by ID
   */
  async getInvoice(id: string): Promise<any> {
    const invoice = await this.prisma.driverInvoice.findUnique({
      where: { id },
      include: {
        driver: {
          select: {
            name: true,
            transporterId: true,
            email: true,
            address: true,
          },
        },
        items: {
          orderBy: { date: "asc" },
        },
        sentByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      driverId: invoice.driverId,
      driver: invoice.driver,
      weekStartDate: invoice.weekStartDate,
      weekEndDate: invoice.weekEndDate,
      status: invoice.status,
      totalAmount: Number(invoice.totalAmount),
      currency: invoice.currency,
      notes: invoice.notes,
      pdfUrl: invoice.pdfUrl,
      sentAt: invoice.sentAt,
      sentBy: invoice.sentByUser,
      items: invoice.items.map((item) => ({
        id: item.id,
        date: item.date,
        description: item.description,
        routeType: item.routeType,
        routeCode: item.routeCode,
        amount: Number(item.amount),
      })),
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  /**
   * Update invoice
   */
  async updateInvoice(id: string, dto: UpdateInvoiceDto): Promise<any> {
    const invoice = await this.prisma.driverInvoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.SENT) {
      throw new BadRequestException(
        "Cannot update an invoice that has been sent"
      );
    }

    // If items are being updated, delete existing and create new
    if (dto.items) {
      await this.prisma.$transaction(async (tx) => {
        // Delete existing items
        await tx.invoiceItem.deleteMany({
          where: { invoiceId: id },
        });

        // Update invoice with new items
        await tx.driverInvoice.update({
          where: { id },
          data: {
            totalAmount: dto.totalAmount
              ? new Prisma.Decimal(dto.totalAmount)
              : undefined,
            notes: dto.notes,
            items: {
              create: dto.items!.map((item) => ({
                date: new Date(item.date),
                description: item.description,
                routeType: item.routeType,
                routeCode: item.routeCode,
                amount: new Prisma.Decimal(item.amount),
                paymentId: item.paymentId,
              })),
            },
          },
        });
      });
    } else {
      // Simple update without items
      await this.prisma.driverInvoice.update({
        where: { id },
        data: {
          totalAmount: dto.totalAmount
            ? new Prisma.Decimal(dto.totalAmount)
            : undefined,
          notes: dto.notes,
        },
      });
    }

    return this.getInvoice(id);
  }

  /**
   * Approve invoice (change status to APPROVED)
   */
  async approveInvoice(id: string): Promise<any> {
    const invoice = await this.prisma.driverInvoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.SENT) {
      throw new BadRequestException("Invoice has already been sent");
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException("Cannot approve a cancelled invoice");
    }

    // Generate PDF if it doesn't exist
    if (!invoice.pdfUrl) {
      await this.generatePdf(id);
    }

    await this.prisma.driverInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.APPROVED },
    });

    return this.getInvoice(id);
  }

  /**
   * Generate or regenerate PDF for invoice
   * Now uses the new 7 Days Services format
   */
  async generatePdf(id: string): Promise<string> {
    const invoiceData = await this.getInvoice(id);

    // Use new 7 Days PDF format
    return this.generateSevenDaysPdf(id, {
      driverId: invoiceData.driverId,
      weekStart: new Date(invoiceData.weekStartDate),
      weekEnd: new Date(invoiceData.weekEndDate),
      invoiceNumber: invoiceData.invoiceNumber,
    });
  }

  /**
   * Generate PDF using new 7 Days Services format
   * Uses PaymentsService to aggregate weekly data
   */
  private async generateSevenDaysPdf(
    id: string,
    invoiceData: any
  ): Promise<string> {
    const year = invoiceData.weekStart.getFullYear();
    const weekNumber = this.getWeekNumber(invoiceData.weekStart);

    // Use PaymentsService to generate comprehensive invoice data
    const weeklyData = await this.paymentsService.generateWeeklyInvoiceData(
      invoiceData.driverId,
      invoiceData.weekStart,
      invoiceData.weekEnd
    );

    // Generate PDF using new format
    const pdfBuffer =
      await this.pdfService.generateSevenDaysInvoice(weeklyData);

    // Save PDF to file system
    const invoiceDir = await this.pdfService.ensureInvoiceDirectory(
      year,
      weekNumber
    );
    const filename = `${invoiceData.invoiceNumber}.pdf`;
    const filepath = join(invoiceDir, filename);

    await writeFile(filepath, pdfBuffer);

    // Update invoice with PDF path
    const relativePath = `invoices/${year}/week-${weekNumber.toString().padStart(2, "0")}/${filename}`;
    await this.prisma.driverInvoice.update({
      where: { id },
      data: { pdfUrl: relativePath },
    });

    this.logger.log(
      `Generated 7 Days PDF for invoice ${invoiceData.invoiceNumber}: ${relativePath}`
    );

    return relativePath;
  }

  /**
   * Send invoices via email
   */
  async sendInvoices(
    dto: SendInvoicesDto,
    userId: string
  ): Promise<SendInvoicesResult> {
    const results: SendInvoicesResult["results"] = [];
    let sent = 0;
    let failed = 0;

    for (const invoiceId of dto.invoiceIds) {
      try {
        const invoice = await this.getInvoice(invoiceId);

        if (invoice.status !== InvoiceStatus.APPROVED) {
          results.push({
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            driverEmail: invoice.driver.email,
            success: false,
            error: "Invoice must be approved before sending",
          });
          failed++;
          continue;
        }

        if (!invoice.pdfUrl) {
          await this.generatePdf(invoiceId);
          const updatedInvoice = await this.getInvoice(invoiceId);
          invoice.pdfUrl = updatedInvoice.pdfUrl;
        }

        // Read PDF file
        const pdfPath = join(process.cwd(), "uploads", invoice.pdfUrl);
        const fs = require("fs");
        const pdfBuffer = fs.readFileSync(pdfPath);

        // Send email
        const emailResult = await this.emailService.sendInvoiceEmail(
          invoice.driver.email,
          invoice.driver.name,
          invoice.invoiceNumber,
          new Date(invoice.weekStartDate).toLocaleDateString("en-GB"),
          new Date(invoice.weekEndDate).toLocaleDateString("en-GB"),
          invoice.totalAmount.toFixed(2),
          invoice.currency,
          pdfBuffer
        );

        if (emailResult.success) {
          // Update invoice status
          await this.prisma.driverInvoice.update({
            where: { id: invoiceId },
            data: {
              status: InvoiceStatus.SENT,
              sentAt: new Date(),
              sentBy: userId,
            },
          });

          results.push({
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            driverEmail: invoice.driver.email,
            success: true,
          });
          sent++;
        } else {
          results.push({
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            driverEmail: invoice.driver.email,
            success: false,
            error: emailResult.error,
          });
          failed++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        results.push({
          invoiceId,
          invoiceNumber: "Unknown",
          driverEmail: "Unknown",
          success: false,
          error: errorMessage,
        });
        failed++;
        this.logger.error(`Failed to send invoice ${invoiceId}:`, error);
      }
    }

    this.logger.log(
      `Bulk send complete: ${sent} sent, ${failed} failed out of ${dto.invoiceIds.length} total`
    );

    return {
      total: dto.invoiceIds.length,
      sent,
      failed,
      results,
    };
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(id: string): Promise<any> {
    const invoice = await this.prisma.driverInvoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.SENT) {
      throw new BadRequestException(
        "Cannot cancel an invoice that has been sent"
      );
    }

    await this.prisma.driverInvoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
    });

    return this.getInvoice(id);
  }

  /**
   * Clear all invoices (TEMPORARY - for development only)
   */
  async clearAllInvoices(): Promise<any> {
    try {
      // Get all invoices with PDF URLs
      const invoices = await this.prisma.driverInvoice.findMany({
        select: {
          id: true,
          pdfUrl: true,
        },
      });

      let deletedPdfs = 0;
      const fs = require("fs");
      const path = require("path");

      // Delete PDF files
      for (const invoice of invoices) {
        if (invoice.pdfUrl) {
          const pdfPath = path.join(process.cwd(), "uploads", invoice.pdfUrl);
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath);
            deletedPdfs++;
          }
        }
      }

      // Delete all invoices (cascade will delete invoice items)
      const result = await this.prisma.driverInvoice.deleteMany({});

      this.logger.log(
        `Cleared ${result.count} invoices and ${deletedPdfs} PDF files`
      );

      return {
        success: true,
        deletedInvoices: result.count,
        deletedPdfs,
        message: `Successfully cleared ${result.count} invoices and ${deletedPdfs} PDF files`,
      };
    } catch (error) {
      this.logger.error("Error clearing invoices:", error);
      throw new BadRequestException("Failed to clear invoices");
    }
  }

  /**
   * Get ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
    );
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
