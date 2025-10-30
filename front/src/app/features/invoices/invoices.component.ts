import { Component, OnInit, signal, computed, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { InvoicesService } from "./invoices.service";
import type { Invoice, InvoiceStatus, InvoiceFilters } from "./invoices.model";
import { AlertService } from "../../shared/services/alert.service";

@Component({
  selector: "app-invoices",
  imports: [CommonModule, FormsModule],
  templateUrl: "./invoices.component.html",
  styleUrls: [],
})
export class InvoicesComponent implements OnInit {
  private readonly invoicesService = inject(InvoicesService);
  private readonly router = inject(Router);
  private readonly alertService = inject(AlertService);

  invoices = signal<Invoice[]>([]);
  loading = signal(false);
  selectedInvoiceIds = signal<Set<string>>(new Set());
  currentPage = signal(1);
  totalPages = signal(1);
  totalInvoices = signal(0);
  pageSize = 20;

  filters: InvoiceFilters = {
    page: 1,
    limit: this.pageSize,
  };

  selectedInvoices = computed(() =>
    this.invoices().filter((inv) => this.selectedInvoiceIds().has(inv.id))
  );

  allSelected = computed(
    () =>
      this.invoices().length > 0 &&
      this.invoices().every((inv) => this.selectedInvoiceIds().has(inv.id))
  );

  startItem = computed(() => (this.currentPage() - 1) * this.pageSize + 1);
  endItem = computed(() =>
    Math.min(this.currentPage() * this.pageSize, this.totalInvoices())
  );

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.loading.set(true);

    const filters: InvoiceFilters = {
      ...this.filters,
      page: this.currentPage(),
      limit: this.pageSize,
    };

    this.invoicesService.getInvoices(filters).subscribe({
      next: (response) => {
        this.invoices.set(response.items);
        this.totalPages.set(response.totalPages);
        this.totalInvoices.set(response.total);
        this.loading.set(false);
      },
      error: (error) => {
        console.error("Error loading invoices:", error);
        this.alertService.showError("Failed to load invoices");
        this.loading.set(false);
      },
    });
  }

  resetFilters(): void {
    this.filters = {
      page: 1,
      limit: this.pageSize,
    };
    this.currentPage.set(1);
    this.loadInvoices();
  }

  toggleSelection(invoiceId: string): void {
    const selected = new Set(this.selectedInvoiceIds());
    if (selected.has(invoiceId)) {
      selected.delete(invoiceId);
    } else {
      selected.add(invoiceId);
    }
    this.selectedInvoiceIds.set(selected);
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedInvoiceIds.set(new Set());
    } else {
      this.selectedInvoiceIds.set(
        new Set(this.invoices().map((inv) => inv.id))
      );
    }
  }

  clearSelection(): void {
    this.selectedInvoiceIds.set(new Set());
  }

  isSelected(invoiceId: string): boolean {
    return this.selectedInvoiceIds().has(invoiceId);
  }

  canBulkApprove(): boolean {
    return this.selectedInvoices().every(
      (inv) => inv.status === "DRAFT" || inv.status === "PENDING_REVIEW"
    );
  }

  canBulkSend(): boolean {
    return this.selectedInvoices().every((inv) => inv.status === "APPROVED");
  }

  bulkApprove(): void {
    const count = this.selectedInvoices().length;

    this.alertService.showWarning(
      `Approving ${count} invoice(s)`,
      "This will generate PDFs for all selected invoices"
    );

    let completed = 0;
    const total = this.selectedInvoices().length;

    this.selectedInvoices().forEach((invoice) => {
      this.invoicesService.approveInvoice(invoice.id).subscribe({
        next: () => {
          completed++;
          if (completed === total) {
            this.alertService.showSuccess(
              `Successfully approved ${total} invoice(s)`
            );
            this.clearSelection();
            this.loadInvoices();
          }
        },
        error: (error) => {
          console.error(`Error approving invoice ${invoice.id}:`, error);
          this.alertService.showError(
            `Failed to approve invoice ${invoice.invoiceNumber}`
          );
        },
      });
    });
  }

  bulkSend(): void {
    const count = this.selectedInvoices().length;

    this.alertService.showWarning(
      `Sending ${count} invoice(s) via email`,
      "Invoices will be sent to the respective drivers"
    );

    const invoiceIds = Array.from(this.selectedInvoiceIds());
    this.invoicesService.sendInvoices({ invoiceIds }).subscribe({
      next: (result) => {
        if (result.sent > 0) {
          this.alertService.showSuccess(
            `Successfully sent ${result.sent} invoice(s)`
          );
        }
        if (result.failed > 0) {
          this.alertService.showError(
            `Failed to send ${result.failed} invoice(s)`
          );
        }
        this.clearSelection();
        this.loadInvoices();
      },
      error: (error) => {
        console.error("Error sending invoices:", error);
        this.alertService.showError("Failed to send invoices");
      },
    });
  }

  approveInvoice(invoiceId: string): void {
    this.alertService.showWarning(
      "Approving invoice",
      "This will generate the PDF"
    );

    this.invoicesService.approveInvoice(invoiceId).subscribe({
      next: () => {
        this.alertService.showSuccess("Invoice approved successfully");
        this.loadInvoices();
      },
      error: (error) => {
        console.error("Error approving invoice:", error);
        this.alertService.showError("Failed to approve invoice");
      },
    });
  }

  sendSingle(invoiceId: string): void {
    this.alertService.showWarning(
      "Sending invoice via email",
      "The invoice will be sent to the driver"
    );

    this.invoicesService.sendInvoices({ invoiceIds: [invoiceId] }).subscribe({
      next: (result) => {
        if (result.sent > 0) {
          this.alertService.showSuccess("Invoice sent successfully");
          this.loadInvoices();
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

  downloadPdf(invoiceId: string): void {
    this.invoicesService.downloadPdf(invoiceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `invoice-${invoiceId}.pdf`;
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

  viewInvoice(invoiceId: string): void {
    this.router.navigate(["/invoices", invoiceId]);
  }

  navigateToGeneration(): void {
    this.router.navigate(["/invoices/generate"]);
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update((p) => p - 1);
      this.loadInvoices();
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update((p) => p + 1);
      this.loadInvoices();
    }
  }

  formatDate(dateString: string): string {
    // Parse the date and format it, avoiding timezone shifts
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  }

  getStatusLabel(status: InvoiceStatus): string {
    const labels: Record<InvoiceStatus, string> = {
      DRAFT: "Draft",
      PENDING_REVIEW: "Pending Review",
      APPROVED: "Approved",
      SENT: "Sent",
      CANCELLED: "Cancelled",
    };
    return labels[status] || status;
  }

  getStatusClass(status: InvoiceStatus): string {
    const baseClass =
      "inline-flex rounded-full px-2 py-1 text-xs font-semibold";
    const statusClasses: Record<InvoiceStatus, string> = {
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

  clearAllInvoices(): void {
    if (
      !confirm(
        "⚠️ WARNING: This will permanently delete ALL invoices and their PDF files. This action cannot be undone. Are you sure?"
      )
    ) {
      return;
    }

    this.loading.set(true);

    this.invoicesService.clearAllInvoices().subscribe({
      next: (result) => {
        this.alertService.showSuccess(
          "All invoices cleared",
          `Deleted ${result.deletedInvoices} invoices and ${result.deletedPdfs} PDF files`
        );
        this.loadInvoices();
      },
      error: (error) => {
        console.error("Error clearing invoices:", error);
        this.alertService.showError("Failed to clear invoices");
        this.loading.set(false);
      },
    });
  }
}
