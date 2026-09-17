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
import { downloadCsv, today } from "../../shared/utils/csv";
import { apiErrorMessage } from "../../shared/utils/api-error";
import { PaymentHistoryModalComponent } from "./payment-history-modal.component";
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
  imports: [CommonModule, ReactiveFormsModule, PaymentHistoryModalComponent],
  templateUrl: "./payment-dashboard.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDashboardComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly formBuilder = inject(FormBuilder);

  protected readonly dashboard = signal<PaymentDashboard | null>(null);
  protected readonly paymentHistory = signal<PaymentHistoryResponse | null>(
    null
  );
  protected readonly isLoading = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);
  protected readonly showUpdatePriceModal = signal<boolean>(false);
  protected readonly isUpdatingPrice = signal<boolean>(false);
  protected readonly selectedPrice = signal<RoutePrice | null>(null);
  protected readonly showHistoryModal = signal<boolean>(false);

  protected readonly currentUser = computed(() =>
    this.authService.currentUserValue()
  );
  protected readonly canUpdatePrices = computed(() => {
    const user = this.currentUser();
    return (
      user?.role === "SUPER_ADMIN" ||
      user?.role === "OWNER" ||
      user?.role === "DIRECTOR" ||
      user?.role === "MANAGER_FINANCIAL"
    );
  });

  protected readonly currentDate = new Date();

  // Form for updating route prices
  protected updatePriceForm: FormGroup;

  // Route type options for dropdown
  private readonly allRouteTypes: RouteTypeOption[] = [
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

  /** The API can only update route types that already have a price */
  protected readonly routeTypes = computed((): RouteTypeOption[] => {
    const priced = new Set(
      (this.dashboard()?.routePrices ?? []).map((price) => price.routeType)
    );
    return this.allRouteTypes.filter((option) => priced.has(option.value));
  });

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
      },
      error: (error: unknown) => {
        this.error.set(
          apiErrorMessage(error, "Failed to load dashboard data. Please try again.")
        );
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
      },
      error: (error: unknown) => {
        this.alertService.showError(
          "Failed to load payment history",
          apiErrorMessage(error, "Please try again")
        );
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

    const routeTypeControl = this.updatePriceForm.get("routeType");
    if (price) {
      // Pre-fill form with existing price data; the route type is fixed
      this.updatePriceForm.reset({
        routeType: price.routeType,
        dailyRate: price.dailyRate.toFixed(2),
        changeReason: "",
      });
      routeTypeControl?.disable();
    } else {
      this.updatePriceForm.reset({ routeType: "", dailyRate: "", changeReason: "" });
      routeTypeControl?.enable();
    }
  }

  /**
   * Close update price modal
   */
  closeUpdatePriceModal(): void {
    this.showUpdatePriceModal.set(false);
    this.selectedPrice.set(null);
    this.updatePriceForm.reset({ routeType: "", dailyRate: "", changeReason: "" });
    this.updatePriceForm.get("routeType")?.enable();
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

    // getRawValue includes the disabled route type control
    const formValue = this.updatePriceForm.getRawValue() as {
      routeType: RouteType;
      dailyRate: string | number;
      changeReason: string | null;
    };
    const changeReason = formValue.changeReason?.trim();
    const request: UpdateRoutePriceRequest = {
      routeType: formValue.routeType,
      dailyRate: Number(formValue.dailyRate).toFixed(2),
      ...(changeReason ? { changeReason } : {}),
    };

    this.paymentService.updateRoutePrice(request).subscribe({
      next: (updatedPrice) => {
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
      error: (error: unknown) => {
        this.alertService.showError(
          "Failed to update route price",
          apiErrorMessage(error, "Please try again")
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
   * Open the full price history (paginated, filterable, CSV export)
   */
  viewAllPaymentHistory(): void {
    this.showHistoryModal.set(true);
  }

  closePaymentHistory(): void {
    this.showHistoryModal.set(false);
  }

  /**
   * Export current route prices to CSV
   */
  exportDashboardData(): void {
    const dashboard = this.dashboard();
    if (!dashboard || dashboard.routePrices.length === 0) {
      this.alertService.showError("No data available to export");
      return;
    }

    downloadCsv<RoutePrice>(`route-prices-${today()}`, dashboard.routePrices, [
      { header: "Route type", value: (price) => this.getRouteTypeLabel(price.routeType) },
      { header: "Route type code", value: (price) => price.routeType },
      { header: "Daily rate (GBP)", value: (price) => price.dailyRate.toFixed(2) },
      { header: "Last updated", value: (price) => price.lastUpdated },
      { header: "Updated by", value: (price) => price.updatedByUser?.name ?? "" },
    ]);

    this.alertService.showSuccess("Route prices exported");
  }
}
