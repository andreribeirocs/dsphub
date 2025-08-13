import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  effect,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  debounceTime,
  distinctUntilChanged,
  switchMap,
  startWith,
} from "rxjs/operators";
import { Subject, of } from "rxjs";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { PaymentService } from "./payment.service";
import type {
  DailyPrefillItem,
  SaveDailyPaymentsRequest,
  DailyUpsertItem,
  RouteType,
} from "./payment.model";
import { AlertService } from "../../shared/services/alert.service";
import { DriverService } from "../drivers/drivers.service";
import type { Driver } from "../drivers/drivers.model";

@Component({
  selector: "app-daily-payment",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./daily-payment.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DailyPaymentComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);
  private readonly alert = inject(AlertService);
  private readonly driverService = inject(DriverService);

  // Signals
  readonly date = signal<string>(new Date().toISOString().slice(0, 10));
  readonly includeExisting = signal<boolean>(true);
  readonly loading = signal<boolean>(false);
  readonly items = signal<DailyPrefillItem[]>([]);
  readonly sourceSheet = signal<string>("");
  readonly driverSearch = signal<string>("");

  private readonly searchQuery$ = new Subject<string>();

  // Route type options (same as driver schedule)
  readonly routeTypeOptions = [
    { value: "FULL_ROUTE", label: "Full Route" },
    { value: "TRAINING_DAY", label: "Training Day" },
    { value: "RIDE_ALONG", label: "Ride Along" },
    { value: "SAME_DAY", label: "Same Day" },
    { value: "NURSERY_ROUTE", label: "Nursery Route" },
    { value: "HOLIDAY", label: "Holiday" },
    { value: "OFF", label: "Off" },
  ] as const;

  // Signal-based reactive search
  readonly searchResults = toSignal(
    this.searchQuery$.pipe(
      startWith(""),
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((query) => {
        if (query.trim().length < 2) {
          return of({ drivers: [], isSearching: false, query: "" });
        }

        return this.driverService.getDrivers().pipe(
          switchMap((drivers) => {
            const filtered = drivers.filter((d) => {
              // Only include ACTIVE drivers
              if (d.status !== "ACTIVE") {
                return false;
              }

              const searchFields = [
                d.name?.toLowerCase() || "",
                d.email?.toLowerCase() || "",
                d.transporterId?.toLowerCase() || "",
              ];

              return searchFields.some((field) =>
                field.includes(query.toLowerCase())
              );
            });

            return of({
              drivers: filtered.slice(0, 10),
              isSearching: false,
              query,
            });
          }),
          startWith({ drivers: [], isSearching: true, query })
        );
      })
    ),
    { initialValue: { drivers: [], isSearching: false, query: "" } }
  );

  // Computed signals derived from search
  readonly driverOptions = computed(() => this.searchResults().drivers);
  readonly isSearching = computed(() => this.searchResults().isSearching);

  // Derived totals
  readonly totalRows = computed(() => this.items().length);
  readonly totalAmount = computed(() =>
    this.items().reduce((sum, it) => sum + (it.totalSuggested || 0), 0)
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    console.log(
      "Loading daily payments for date:",
      this.date(),
      "includeExisting:",
      this.includeExisting()
    );
    this.loading.set(true);
    this.paymentService
      .prefillDaily(this.date(), this.includeExisting())
      .subscribe({
        next: (data) => {
          console.log("Load response data:", data);
          // Ensure numeric fields
          const normalized = data.map((d) => ({
            ...d,
            dailyRate: Number(d.dailyRate) || 0,
            extraAmount: Number(d.extraAmount) || 0,
            deductionAmount: Number(d.deductionAmount) || 0,
            vanCharge: Number(d.vanCharge) || 0,
            totalSuggested: Number(d.totalSuggested) || 0,
          }));
          console.log("Normalized data:", normalized);
          this.items.set(normalized);
          this.loading.set(false);
        },
        error: (err) => {
          console.error("Load error:", err);
          this.alert.showError(
            "Failed to load daily prefill",
            err?.error?.message || err?.message || "Unknown error"
          );
          this.loading.set(false);
        },
      });
  }

  refreshDriverOptions(query: string): void {
    this.driverSearch.set(query);
    this.searchQuery$.next(query);
  }

  selectDriverForNewRow(driver: Driver): void {
    console.log("Adding driver to row:", driver);
    const newRow: DailyPrefillItem = {
      driverId: driver.id,
      driverName: driver.name,
      transporterId: driver.transporterId || "",
      workDate: this.date(),
      routeType: "FULL_ROUTE" as RouteType,
      routeCode: "",
      dailyRate: 100, // Default rate for new entries
      extraAmount: 0,
      deductionAmount: 0,
      vanCharge: 0,
      totalSuggested: 100, // Matches dailyRate
      exists: false,
    };
    console.log("New row created:", newRow);
    const updatedItems = [newRow, ...this.items()];
    console.log("Updated items array:", updatedItems);
    this.items.set(updatedItems);

    // Clear search after selection
    this.driverSearch.set("");
    this.searchQuery$.next("");
  }

  onCellChange(
    index: number,
    field: keyof DailyPrefillItem,
    value: string | number
  ): void {
    const row = this.items()[index];
    if (!row) return;
    const updated = { ...row };

    if (typeof value === "string") {
      const n = Number(value);
      (updated as any)[field] = isNaN(n) ? value : n;
    } else {
      (updated as any)[field] = value;
    }

    // Recalculate total
    const base = Number(updated.dailyRate) || 0;
    const extra = Number(updated.extraAmount) || 0;
    const ded = Number(updated.deductionAmount) || 0;
    const van = Number(updated.vanCharge) || 0;
    (updated as any).totalSuggested = Number(
      (base + extra - ded - van).toFixed(2)
    );

    const clone = this.items().slice();
    clone[index] = updated;
    this.items.set(clone);
  }

  addEmptyRow(): void {
    const empty: DailyPrefillItem = {
      driverId: "",
      driverName: "",
      transporterId: "",
      workDate: this.date(),
      routeType: "FULL_ROUTE" as RouteType,
      routeCode: "",
      dailyRate: 0,
      extraAmount: 0,
      deductionAmount: 0,
      vanCharge: 0,
      totalSuggested: 0,
      exists: false,
    };
    this.items.set([empty, ...this.items()]);
  }

  removeRow(index: number): void {
    console.log("Removing row at index:", index);
    console.log("Items before removal:", this.items());
    const copy = this.items().slice();
    copy.splice(index, 1);
    console.log("Items after removal:", copy);
    this.items.set(copy);
  }

  // Route type styling helpers
  getRouteTypeClass(routeType: string): string {
    const classes = {
      FULL_ROUTE: "bg-blue-100 text-blue-800 border border-blue-200",
      TRAINING_DAY: "bg-green-100 text-green-800 border border-green-200",
      RIDE_ALONG: "bg-purple-100 text-purple-800 border border-purple-200",
      SAME_DAY: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      NURSERY_ROUTE: "bg-pink-100 text-pink-800 border border-pink-200",
      HOLIDAY: "bg-red-100 text-red-800 border border-red-200",
      OFF: "bg-gray-100 text-gray-800 border border-gray-200",
    };
    return (
      classes[routeType as keyof typeof classes] ||
      "bg-gray-100 text-gray-800 border border-gray-200"
    );
  }

  getRouteTypeLabel(routeType: string): string {
    const option = this.routeTypeOptions.find((opt) => opt.value === routeType);
    return option?.label || routeType;
  }

  updateItemRouteType(index: number, routeType: string): void {
    const copy = [...this.items()];
    copy[index] = { ...copy[index], routeType: routeType as any };
    this.items.set(copy);
  }

  save(): void {
    if (!this.items().length) {
      this.alert.showWarning("Nothing to save");
      return;
    }

    console.log("Saving daily payments for date:", this.date());
    console.log("Items to save:", this.items());

    // Note: In the future, we'll support multiple entries for the same driver
    // when one driver helps another. This will require:
    // 1. Removing the unique constraint check
    // 2. Adding a "helpedBy" or "assistedBy" field
    // 3. Modifying the backend to allow multiple records per driver/date

    // Filter out empty rows (no driverId)
    const validItems = this.items().filter(
      (i) => i.driverId && i.driverId.trim()
    );

    if (validItems.length === 0) {
      this.alert.showWarning(
        "No valid entries to save (missing driver information)"
      );
      return;
    }

    const body: SaveDailyPaymentsRequest = {
      date: this.date(),
      items: validItems.map<DailyUpsertItem>((i) => ({
        driverId: i.driverId,
        routeType: i.routeType,
        routeCode: i.routeCode || undefined,
        dailyRate: Number(i.dailyRate).toFixed(2),
        extraAmount:
          i.extraAmount !== undefined && i.extraAmount !== 0
            ? Number(i.extraAmount).toFixed(2)
            : undefined,
        deductionAmount:
          i.deductionAmount !== undefined && i.deductionAmount !== 0
            ? Number(i.deductionAmount).toFixed(2)
            : undefined,
        vanCharge:
          i.vanCharge !== undefined && i.vanCharge !== 0
            ? Number(i.vanCharge).toFixed(2)
            : undefined,
        notes: undefined,
        sourceSheet: this.sourceSheet() || undefined,
      })),
    };

    console.log("Save request body:", body);
    console.log("Number of valid items to save:", validItems.length);
    this.loading.set(true);

    this.paymentService.saveDaily(body).subscribe({
      next: (res) => {
        console.log("Save response:", res);
        console.log("Created:", res.created, "Updated:", res.updated);
        this.loading.set(false);
        this.alert.showSuccess(
          "Daily payments saved",
          `Created: ${res.created}, Updated: ${res.updated}`
        );
        console.log("Reloading data after save...");

        // Add a small delay to ensure backend has processed the save
        setTimeout(() => {
          this.load();
        }, 500);
      },
      error: (err) => {
        console.error("Save error:", err);
        console.error("Full error object:", JSON.stringify(err, null, 2));
        this.loading.set(false);
        this.alert.showError(
          "Failed to save daily payments",
          err?.error?.message || err?.message || "Unknown error"
        );
      },
    });
  }
}
