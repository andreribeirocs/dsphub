import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { InvoicesService } from "../invoices/invoices.service";

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly isAutoGenerateEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly invoicesService: InvoicesService
  ) {
    this.isAutoGenerateEnabled =
      this.configService.get<string>("INVOICE_AUTO_GENERATE") === "true";

    if (this.isAutoGenerateEnabled) {
      this.logger.log("Automatic weekly invoice generation is enabled");
    } else {
      this.logger.log(
        "Automatic weekly invoice generation is disabled. Set INVOICE_AUTO_GENERATE=true to enable."
      );
    }
  }

  /**
   * Generate weekly invoices every Sunday at midnight
   * Cron pattern: 0 0 * * 0 (minute hour day month dayOfWeek)
   * Week: Sunday (start) to Saturday (end)
   */
  @Cron("0 0 * * 0", {
    name: "generate-weekly-invoices",
    timeZone: "Europe/London",
  })
  async generateWeeklyInvoices(): Promise<void> {
    if (!this.isAutoGenerateEnabled) {
      return;
    }

    this.logger.log("Starting automatic weekly invoice generation...");

    try {
      // Calculate previous week (Sunday to Saturday)
      const today = new Date();
      const daysSinceSunday = today.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const lastSunday = new Date(today);
      lastSunday.setDate(today.getDate() - daysSinceSunday - 7); // Go back to last week's Sunday
      lastSunday.setHours(0, 0, 0, 0);

      const weekStartDate = lastSunday.toISOString().split("T")[0];

      this.logger.log(
        `Generating invoices for week starting: ${weekStartDate}`
      );

      const result = await this.invoicesService.generateWeeklyInvoices({
        weekStartDate,
      });

      this.logger.log(
        `Automatic invoice generation completed: ${result.generated} generated, ${result.skipped} skipped, ${result.errors} errors`
      );

      if (result.errors > 0 && result.errorDetails) {
        this.logger.error(
          `Errors encountered during automatic generation:`,
          JSON.stringify(result.errorDetails, null, 2)
        );
      }
    } catch (error) {
      this.logger.error(
        "Failed to automatically generate weekly invoices:",
        error
      );
    }
  }

  /**
   * Manual trigger for testing (can be called from a controller if needed)
   */
  async triggerManualGeneration(weekStartDate: string): Promise<any> {
    this.logger.log(`Manual trigger for invoice generation: ${weekStartDate}`);
    return this.invoicesService.generateWeeklyInvoices({ weekStartDate });
  }
}
