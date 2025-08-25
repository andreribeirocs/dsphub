import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from "@angular/forms";
import { PaymentService } from "./payment.service";
import { AuthService } from "../../../core/services/auth.service";
import { AlertService } from "../../shared/services/alert.service";
import {
  PaymentDashboard,
  PaymentHistoryResponse,
  RoutePrice,
  RouteType,
  UpdateRoutePriceRequest,
  ROUTE_TYPE_LABELS,
  ROUTE_TYPE_COLORS,
} from "./payment.model";

interface RouteTypeOption {
  value: RouteType;
  label: string;
}

@Component({
  selector: "app-payment-dashboard",
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./payment-dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDashboardComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly formBuilder = inject(FormBuilder);

  // 🚀 Angular 20: Using signals for reactive state management
  protected readonly dashboard = signal<PaymentDashboard | null>(null);
  protected readonly paymentHistory = signal<PaymentHistoryResponse | null>(
    null
  );
  protected readonly isLoading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showUpdatePriceModal = signal<boolean>(false);
  protected readonly isUpdatingPrice = signal<boolean>(false);
  protected readonly selectedPrice = signal<RoutePrice | null>(null);

  // 🚀 Angular 20: Computed properties for derived state
  protected readonly currentUser = computed(() =>
    this.authService.currentUserValue()
  );
  protected readonly canUpdatePrices = computed(() => {
    const user = this.currentUser();
    return user?.role === "DIRECTOR" || user?.role === "MANAGER_FINANCIAL";
  });

  protected readonly currentDate = new Date();

  // Form for updating route prices
  protected updatePriceForm: FormGroup;

  // Route type options for dropdown
  protected readonly routeTypes: RouteTypeOption[] = [
    {
      value: RouteType.FULL_ROUTE,
      label: ROUTE_TYPE_LABELS[RouteType.FULL_ROUTE],
    },
    {
      value: RouteType.HIDE_ALONG,
      label: ROUTE_TYPE_LABELS[RouteType.HIDE_ALONG],
    },
    {
      value: RouteType.TRAINING_DAY,
      label: ROUTE_TYPE_LABELS[RouteType.TRAINING_DAY],
    },
    { value: RouteType.SAME_DAY, label: ROUTE_TYPE_LABELS[RouteType.SAME_DAY] },
    {
      value: RouteType.NURSERY_ROUTE,
      label: ROUTE_TYPE_LABELS[RouteType.NURSERY_ROUTE],
    },
    { value: RouteType.EXTRAS, label: ROUTE_TYPE_LABELS[RouteType.EXTRAS] },
    {
      value: RouteType.ORDT_EXTRA_LARGE_CARGO_VAN,
      label: ROUTE_TYPE_LABELS[RouteType.ORDT_EXTRA_LARGE_CARGO_VAN],
    },
    {
      value: RouteType.STANDARD_PARCEL_MEDIUM_VAN,
      label: ROUTE_TYPE_LABELS[RouteType.STANDARD_PARCEL_MEDIUM_VAN],
    },
    {
      value: RouteType.NURSERY_ROUTE_LEVEL_1,
      label: ROUTE_TYPE_LABELS[RouteType.NURSERY_ROUTE_LEVEL_1],
    },
    {
      value: RouteType.NURSERY_ROUTE_LEVEL_2,
      label: ROUTE_TYPE_LABELS[RouteType.NURSERY_ROUTE_LEVEL_2],
    },
    {
      value: RouteType.NURSERY_ROUTE_LEVEL_3,
      label: ROUTE_TYPE_LABELS[RouteType.NURSERY_ROUTE_LEVEL_3],
    },
    {
      value: RouteType.NURSERY_ROUTE_LEVEL_4,
      label: ROUTE_TYPE_LABELS[RouteType.NURSERY_ROUTE_LEVEL_4],
    },
    {
      value: RouteType.STANDARD_PARCEL,
      label: ROUTE_TYPE_LABELS[RouteType.STANDARD_PARCEL],
    },
    {
      value: RouteType.STANDARD_PARCEL_LOW_EMISSION_VEHICLE_LARGE,
      label:
        ROUTE_TYPE_LABELS[RouteType.STANDARD_PARCEL_LOW_EMISSION_VEHICLE_LARGE],
    },
    {
      value: RouteType.STANDARD_PARCEL_WITH_HELPER,
      label: ROUTE_TYPE_LABELS[RouteType.STANDARD_PARCEL_WITH_HELPER],
    },
    {
      value: RouteType.STANDARD_PARCEL_RIDE_ALONG_IRONHIDE_MEDIUM_VAN,
      label:
        ROUTE_TYPE_LABELS[
          RouteType.STANDARD_PARCEL_RIDE_ALONG_IRONHIDE_MEDIUM_VAN
        ],
    },
    {
      value: RouteType.STANDARD_PARCEL_RIDE_ALONG_MENTEE_IRONHIDE_MEDIUM_VAN,
      label:
        ROUTE_TYPE_LABELS[
          RouteType.STANDARD_PARCEL_RIDE_ALONG_MENTEE_IRONHIDE_MEDIUM_VAN
        ],
    },
  ];

  constructor() {
    this.updatePriceForm = this.formBuilder.group({
      routeType: ["", [Validators.required]],
      dailyRate: ["", [Validators.required, Validators.min(0)]],
      changeReason: [""],
    });
  }

  ngOnInit(): void {
    this.loadDashboard();
    this.loadPaymentHistory();
  }

  /**
   * Load dashboard data
   */
  loadDashboard(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.paymentService.getDashboard().subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.isLoading.set(false);
        console.log("🚀 Dashboard loaded successfully:", data);
      },
      error: (error) => {
        console.error("❌ Error loading dashboard:", error);
        this.error.set("Failed to load dashboard data. Please try again.");
        this.isLoading.set(false);
        this.alertService.showError("Failed to load dashboard data");
      },
    });
  }

  /**
   * Load payment history
   */
  loadPaymentHistory(): void {
    this.paymentService.getPaymentHistory({ page: 1, limit: 10 }).subscribe({
      next: (data) => {
        this.paymentHistory.set(data);
        console.log("📊 Payment history loaded:", data);
      },
      error: (error) => {
        console.error("❌ Error loading payment history:", error);
        this.alertService.showError("Failed to load payment history");
      },
    });
  }

  /**
   * Open update price modal
   */
  openUpdatePriceModal(price?: RoutePrice): void {
    if (!this.canUpdatePrices()) {
      this.alertService.showError(
        "You do not have permission to update prices"
      );
      return;
    }

    this.selectedPrice.set(price || null);
    this.showUpdatePriceModal.set(true);

    if (price) {
      // Pre-fill form with existing price data
      this.updatePriceForm.patchValue({
        routeType: price.routeType,
        dailyRate: price.dailyRate.toFixed(2),
        changeReason: "",
      });
    } else {
      // Reset form for new price
      this.updatePriceForm.reset();
    }
  }

  /**
   * Close update price modal
   */
  closeUpdatePriceModal(): void {
    this.showUpdatePriceModal.set(false);
    this.selectedPrice.set(null);
    this.updatePriceForm.reset();
  }

  /**
   * Update route price
   */
  updateRoutePrice(): void {
    if (
      this.updatePriceForm.invalid ||
      this.isUpdatingPrice() ||
      !this.canUpdatePrices()
    ) {
      return;
    }

    this.isUpdatingPrice.set(true);

    const formValue = this.updatePriceForm.value;
    const request: UpdateRoutePriceRequest = {
      routeType: formValue.routeType,
      dailyRate: parseFloat(formValue.dailyRate).toFixed(2),
      changeReason: formValue.changeReason || undefined,
    };

    this.paymentService.updateRoutePrice(request).subscribe({
      next: (updatedPrice) => {
        console.log("✅ Route price updated successfully:", updatedPrice);
        this.alertService.showSuccess(
          "Route price updated successfully",
          `${this.getRouteTypeLabel(
            updatedPrice.routeType
          )} price updated to £${updatedPrice.dailyRate.toFixed(2)}`
        );

        // Refresh dashboard data
        this.loadDashboard();
        this.loadPaymentHistory();

        // Close modal
        this.closeUpdatePriceModal();
        this.isUpdatingPrice.set(false);
      },
      error: (error) => {
        console.error("❌ Error updating route price:", error);
        this.alertService.showError(
          "Failed to update route price",
          error.error?.message || "Please try again"
        );
        this.isUpdatingPrice.set(false);
      },
    });
  }

  /**
   * Get route type label for display
   */
  getRouteTypeLabel(routeType: RouteType): string {
    return ROUTE_TYPE_LABELS[routeType] || routeType;
  }

  /**
   * Get route type color classes
   */
  getRouteTypeColor(routeType: RouteType): string {
    return ROUTE_TYPE_COLORS[routeType] || "bg-gray-100 text-gray-800";
  }

  /**
   * Format currency for display
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /**
   * Check if user has financial management permissions
   */
  hasFinancialPermissions(): boolean {
    return this.canUpdatePrices();
  }

  /**
   * Navigate to detailed payment history view
   */
  viewAllPaymentHistory(): void {
    // TODO: Implement navigation to dedicated payment history page
    console.log("Navigate to payment history page");
  }

  /**
   * Export dashboard data
   */
  exportDashboardData(): void {
    const dashboard = this.dashboard();
    if (!dashboard) {
      this.alertService.showError("No data available to export");
      return;
    }

    // Create CSV data
    const csvData = dashboard.routePrices.map((price) => ({
      "Route Type": this.getRouteTypeLabel(price.routeType),
      "Daily Rate": `£${price.dailyRate.toFixed(2)}`,
      "Last Updated": this.formatDate(price.lastUpdated),
      "Updated By": price.updatedByUser.name,
    }));

    // Convert to CSV string
    const headers = Object.keys(csvData[0]);
    const csvContent = [
      headers.join(","),
      ...csvData.map((row) =>
        headers
          .map((header) => `"${row[header as keyof typeof row]}"`)
          .join(",")
      ),
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payment-dashboard-${
      new Date().toISOString().split("T")[0]
    }.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    this.alertService.showSuccess("Dashboard data exported successfully");
  }
}
