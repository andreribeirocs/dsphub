import { Component, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { InvoicesService } from "./invoices.service";
import type { GenerateWeeklyInvoicesResponse } from "./invoices.model";
import { AlertService } from "../../shared/services/alert.service";

@Component({
  selector: "app-invoice-generation",
  imports: [CommonModule, FormsModule],
  templateUrl: "./invoice-generation.component.html",
  styleUrls: [],
})
export class InvoiceGenerationComponent {
  private readonly invoicesService = inject(InvoicesService);
  private readonly router = inject(Router);
  private readonly alertService = inject(AlertService);

  weekStartDate = "";
  generating = signal(false);
  result = signal<GenerateWeeklyInvoicesResponse | null>(null);

  generateInvoices(): void {
    if (!this.weekStartDate) {
      this.alertService.showError("Please select a week start date");
      return;
    }

    this.generating.set(true);
    this.result.set(null);

    this.invoicesService
      .generateWeeklyInvoices({ weekStartDate: this.weekStartDate })
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.generating.set(false);

          if (result.generated > 0) {
            this.alertService.showSuccess(
              `Generated ${result.generated} invoice(s)`
            );
          }
          if (result.skipped > 0) {
            this.alertService.showInfo(
              `Skipped ${result.skipped} invoice(s) (already exist)`
            );
          }
          if (result.errors > 0) {
            this.alertService.showError(
              `Failed to generate ${result.errors} invoice(s). Check details below.`
            );
          }
        },
        error: (error) => {
          console.error("Error generating invoices:", error);
          this.alertService.showError("Failed to generate invoices");
          this.generating.set(false);
        },
      });
  }

  resetAndGenerate(): void {
    this.result.set(null);
    this.weekStartDate = "";
  }

  viewInvoice(invoiceId: string): void {
    this.router.navigate(["/invoices", invoiceId]);
  }

  goToInvoices(): void {
    this.router.navigate(["/invoices"]);
  }

  goBack(): void {
    this.router.navigate(["/invoices"]);
  }
}
