import { Component, OnInit, signal, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { InvoicesService } from "./invoices.service";
import type { Invoice } from "./invoices.model";
import { AlertService } from "../../shared/services/alert.service";

@Component({
  selector: "app-invoice-details",
  imports: [CommonModule, FormsModule],
  templateUrl: "./invoice-details.component.html",
  styleUrls: [],
})
export class InvoiceDetailsComponent implements OnInit {
  private readonly invoicesService = inject(InvoicesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly alertService = inject(AlertService);

  invoice = signal<Invoice | null>(null);
  loading = signal(false);
  editing = signal(false);
  saving = signal(false);
  editableNotes = "";

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get("id");
    if (id) {
      this.loadInvoice(id);
    }
  }

  loadInvoice(id: string): void {
    this.loading.set(true);
    this.invoicesService.getInvoice(id).subscribe({
      next: (invoice) => {
        this.invoice.set(invoice);
        this.editableNotes = invoice.notes || "";
        this.loading.set(false);
      },
      error: (error) => {
        console.error("Error loading invoice:", error);
        this.alertService.showError("Failed to load invoice");
        this.loading.set(false);
        this.router.navigate(["/invoices"]);
      },
    });
  }

  startEdit(): void {
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.editableNotes = this.invoice()?.notes || "";
  }

  saveChanges(): void {
    if (!this.invoice()) return;

    this.saving.set(true);
    this.invoicesService
      .updateInvoice(this.invoice()!.id, {
        notes: this.editableNotes || undefined,
      })
      .subscribe({
        next: (updated) => {
          this.invoice.set(updated);
          this.editing.set(false);
          this.saving.set(false);
          this.alertService.showSuccess("Invoice updated successfully");
        },
        error: (error) => {
          console.error("Error updating invoice:", error);
          this.alertService.showError("Failed to update invoice");
          this.saving.set(false);
        },
      });
  }

  approveInvoice(): void {
    if (!this.invoice()) return;

    this.alertService.showWarning(
      "Approving invoice",
      "This will generate the PDF"
    );

    this.invoicesService.approveInvoice(this.invoice()!.id).subscribe({
      next: (updated) => {
        this.invoice.set(updated);
        this.alertService.showSuccess("Invoice approved successfully");
      },
      error: (error) => {
        console.error("Error approving invoice:", error);
        this.alertService.showError("Failed to approve invoice");
      },
    });
  }

  sendInvoice(): void {
    if (!this.invoice()) return;

    this.alertService.showWarning(
      "Sending invoice via email",
      `The invoice will be sent to ${this.invoice()!.driver.email}`
    );

    this.invoicesService
      .sendInvoices({ invoiceIds: [this.invoice()!.id] })
      .subscribe({
        next: (result) => {
          if (result.sent > 0) {
            this.alertService.showSuccess("Invoice sent successfully");
            this.loadInvoice(this.invoice()!.id);
          } else {
            this.alertService.showError("Failed to send invoice");
          }
        },
        error: (error) => {
          console.error("Error sending invoice:", error);
          this.alertService.showError("Failed to send invoice");
        },
      });
  }

  regeneratePdf(): void {
    if (!this.invoice()) return;

    this.alertService.showWarning(
      "Regenerating PDF",
      "This will create a new PDF file for this invoice"
    );

    this.invoicesService.regeneratePdf(this.invoice()!.id).subscribe({
      next: () => {
        this.alertService.showSuccess("PDF regenerated successfully");
        this.loadInvoice(this.invoice()!.id);
      },
      error: (error) => {
        console.error("Error regenerating PDF:", error);
        this.alertService.showError("Failed to regenerate PDF");
      },
    });
  }

  downloadPdf(): void {
    if (!this.invoice()) return;

    this.invoicesService.downloadPdf(this.invoice()!.id).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${this.invoice()!.invoiceNumber}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.alertService.showSuccess("PDF downloaded successfully");
      },
      error: (error) => {
        console.error("Error downloading PDF:", error);
        this.alertService.showError("Failed to download PDF");
      },
    });
  }

  cancelInvoice(): void {
    if (!this.invoice()) return;

    this.alertService.showWarning(
      "Cancelling invoice",
      "This action cannot be undone and the invoice cannot be sent"
    );

    this.invoicesService.cancelInvoice(this.invoice()!.id).subscribe({
      next: (updated) => {
        this.invoice.set(updated);
        this.alertService.showSuccess("Invoice cancelled");
      },
      error: (error) => {
        console.error("Error cancelling invoice:", error);
        this.alertService.showError("Failed to cancel invoice");
      },
    });
  }

  goBack(): void {
    this.router.navigate(["/invoices"]);
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return "N/A";
    // Parse the date and format it, avoiding timezone shifts
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: "Draft",
      PENDING_REVIEW: "Pending Review",
      APPROVED: "Approved",
      SENT: "Sent",
      CANCELLED: "Cancelled",
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const baseClass =
      "inline-flex rounded-full px-3 py-1 text-sm font-semibold";
    const statusClasses: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-800",
      PENDING_REVIEW: "bg-yellow-100 text-yellow-800",
      APPROVED: "bg-green-100 text-green-800",
      SENT: "bg-blue-100 text-blue-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return `${baseClass} ${
      statusClasses[status] || "bg-gray-100 text-gray-800"
    }`;
  }
}
