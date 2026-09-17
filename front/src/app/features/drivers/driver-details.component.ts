import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { CurrencyPipe, DatePipe } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { AlertService } from "../../shared/services/alert.service";
import { DriverEditModalComponent } from "./driver-edit-modal.component";
import { DriverService } from "./drivers.service";
import {
  Depot,
  DocumentStatus,
  DriverDetails,
  DriverPayment,
  apiErrorMessage,
  documentStatus,
  documentStatusClass,
  driverStatusClass,
} from "./drivers.model";

interface ComplianceRow {
  readonly label: string;
  readonly date: string | null;
  readonly status: DocumentStatus;
}

const PAYMENTS_SHOWN = 20;

@Component({
  selector: "app-driver-details",
  standalone: true,
  imports: [DatePipe, CurrencyPipe, DriverEditModalComponent],
  templateUrl: "./driver-details.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);
  private readonly alertService = inject(AlertService);

  private readonly driverId = this.route.snapshot.paramMap.get("id") ?? "";

  readonly driver = signal<DriverDetails | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly payments = signal<DriverPayment[]>([]);
  readonly paymentsLoading = signal(true);
  readonly paymentsError = signal<string | null>(null);

  readonly depots = signal<Depot[]>([]);
  readonly editing = signal(false);
  readonly deactivating = signal(false);

  readonly compliance = computed<ComplianceRow[]>(() => {
    const driver = this.driver();
    if (!driver) {
      return [];
    }
    return [
      { label: "Passport / visa", date: driver.passportExpiry },
      { label: "Driving licence", date: driver.licenseExpiry },
      { label: "Right to work", date: driver.rtwExpiry },
    ].map((row) => ({ ...row, status: documentStatus(row.date) }));
  });

  readonly recentPayments = computed(() => this.payments().slice(0, PAYMENTS_SHOWN));

  readonly paymentTotals = computed(() => {
    let paid = 0;
    let unpaid = 0;
    for (const payment of this.payments()) {
      if (payment.isPaid) {
        paid += payment.totalPaid;
      } else {
        unpaid += payment.totalPaid;
      }
    }
    return { paid, unpaid, count: this.payments().length };
  });

  constructor() {
    if (!this.driverId) {
      this.loading.set(false);
      this.loadError.set("Driver not found.");
      return;
    }
    this.loadDriver();
    this.loadPayments();
    this.driverService.getDepots().subscribe({
      next: (depots) => this.depots.set(depots),
      error: () => this.depots.set([]),
    });
  }

  loadDriver(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.driverService.getDriver(this.driverId).subscribe({
      next: (driver) => {
        this.driver.set(driver);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(apiErrorMessage(err, "Could not load driver."));
      },
    });
  }

  private loadPayments(): void {
    this.paymentsLoading.set(true);
    this.paymentsError.set(null);
    this.driverService.getDriverPayments(this.driverId).subscribe({
      next: (payments) => {
        this.payments.set(payments);
        this.paymentsLoading.set(false);
      },
      error: (err: unknown) => {
        this.paymentsLoading.set(false);
        this.paymentsError.set(apiErrorMessage(err, "Could not load payments."));
      },
    });
  }

  goBack(): void {
    this.router.navigate(["/drivers"]);
  }

  editDriver(): void {
    this.editing.set(true);
  }

  onSaved(): void {
    this.editing.set(false);
    this.loadDriver();
  }

  deactivateDriver(): void {
    const driver = this.driver();
    if (!driver || driver.status === "INACTIVE") {
      return;
    }
    const confirmed = confirm(
      `Deactivate ${driver.name}?\n\nThe driver is not deleted: status becomes INACTIVE and payment history is kept.`
    );
    if (!confirmed) {
      return;
    }
    this.deactivating.set(true);
    this.driverService.deactivateDriver(driver.id).subscribe({
      next: () => {
        this.deactivating.set(false);
        this.alertService.showSuccess("Driver deactivated", driver.name);
        this.loadDriver();
      },
      error: (err: unknown) => {
        this.deactivating.set(false);
        this.alertService.showError("Could not deactivate driver", apiErrorMessage(err, "Please try again."));
      },
    });
  }

  getInitials(name: string): string {
    return (name ?? "")
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  statusBadgeClass(status: string): string {
    return driverStatusClass(status);
  }

  docStatusClass(status: DocumentStatus): string {
    return documentStatusClass(status);
  }

  formatLabel(value: string): string {
    return value
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
}
