import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
  effect,
  HostListener,
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
  ImportXlsxRequest,
  ImportXlsxResponse,
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
  readonly originalItems = signal<DailyPrefillItem[]>([]); // Track original state for change detection
  readonly sourceSheet = signal<string>("");
  readonly driverSearch = signal<string>("");

  // XLSX Import signals
  readonly showImportModal = signal<boolean>(false);
  readonly importing = signal<boolean>(false);
  readonly importResult = signal<ImportXlsxResponse | null>(null);

  // Route dropdown state
  readonly openRouteDropdown = signal<number | null>(null);

  private readonly searchQuery$ = new Subject<string>();

  // Route type options for payment records
  readonly routeTypeOptions = [
    { value: "FULL_ROUTE", label: "Full Route", shortKey: "F" },
    { value: "TRAINING_DAY", label: "Training Day", shortKey: "T" },
    { value: "HIDE_ALONG", label: "Ride Along", shortKey: "R" },
    { value: "SAME_DAY", label: "Same Day", shortKey: "S" },
    { value: "NURSERY_ROUTE", label: "Nursery Route", shortKey: "N" },
    { value: "EXTRAS", label: "Extras", shortKey: "E" },
    {
      value: "ORDT_EXTRA_LARGE_CARGO_VAN",
      label: "ORDT Extra Large Cargo Van",
      shortKey: "O",
    },
    {
      value: "STANDARD_PARCEL_MEDIUM_VAN",
      label: "Standard Parcel Medium Van",
      shortKey: "P",
    },
    {
      value: "NURSERY_ROUTE_LEVEL_1",
      label: "Nursery Route Level 1",
      shortKey: "L1",
    },
    {
      value: "NURSERY_ROUTE_LEVEL_2",
      label: "Nursery Route Level 2",
      shortKey: "L2",
    },
    {
      value: "NURSERY_ROUTE_LEVEL_3",
      label: "Nursery Route Level 3",
      shortKey: "L3",
    },
    {
      value: "NURSERY_ROUTE_LEVEL_4",
      label: "Nursery Route Level 4",
      shortKey: "L4",
    },
    {
      value: "STANDARD_PARCEL",
      label: "Standard Parcel",
      shortKey: "SP",
    },
    {
      value: "STANDARD_PARCEL_LOW_EMISSION_VEHICLE_LARGE",
      label: "Standard Parcel - Low Emission Vehicle (Large)",
      shortKey: "LE",
    },
    {
      value: "STANDARD_PARCEL_WITH_HELPER",
      label: "Standard Parcel with Helper",
      shortKey: "H",
    },
    {
      value: "STANDARD_PARCEL_RIDE_ALONG_IRONHIDE_MEDIUM_VAN",
      label: "Standard Parcel Ride Along (Ironhide) - Medium Van",
      shortKey: "RI",
    },
    {
      value: "STANDARD_PARCEL_RIDE_ALONG_MENTEE_IRONHIDE_MEDIUM_VAN",
      label: "Standard Parcel Ride Along: Mentee (Ironhide) - Medium Van",
      shortKey: "RM",
    },
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

  // Change detection - check if current items differ from original
  readonly hasChanges = computed(() => {
    const current = this.items();
    const original = this.originalItems();

    // Different lengths = changes
    if (current.length !== original.length) {
      return true;
    }

    // Check each item for changes
    return current.some((currentItem, index) => {
      const originalItem = original[index];
      if (!originalItem) return true;

      return (
        currentItem.driverId !== originalItem.driverId ||
        currentItem.routeType !== originalItem.routeType ||
        currentItem.routeCode !== originalItem.routeCode ||
        currentItem.dailyRate !== originalItem.dailyRate ||
        currentItem.extraAmount !== originalItem.extraAmount ||
        currentItem.deductionAmount !== originalItem.deductionAmount ||
        currentItem.vanCharge !== originalItem.vanCharge ||
        currentItem.totalSuggested !== originalItem.totalSuggested
      );
    });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.paymentService
      .prefillDaily(this.date(), this.includeExisting())
      .subscribe({
        next: (data) => {
          // Ensure numeric fields and sort alphabetically by driver name
          const normalized = data
            .map((d) => ({
              ...d,
              dailyRate: Number(d.dailyRate) || 0,
              extraAmount: Number(d.extraAmount) || 0,
              deductionAmount: Number(d.deductionAmount) || 0,
              vanCharge: Number(d.vanCharge) || 0,
              totalSuggested: Number(d.totalSuggested) || 0,
            }))
            .sort((a, b) => a.driverName.localeCompare(b.driverName));
          this.items.set(normalized);
          // Capture original state for change detection
          this.originalItems.set([...normalized]);
          this.loading.set(false);
        },
        error: (err) => {
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
    const updatedItems = [newRow, ...this.items()].sort((a, b) =>
      a.driverName.localeCompare(b.driverName)
    );
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
    const copy = this.items().slice();
    copy.splice(index, 1);
    this.items.set(copy);
  }

  // Route type styling helpers
  getRouteTypeClass(routeType: string): string {
    const classes = {
      FULL_ROUTE: "bg-blue-100 text-blue-800 border border-blue-200",
      TRAINING_DAY: "bg-green-100 text-green-800 border border-green-200",
      HIDE_ALONG: "bg-purple-100 text-purple-800 border border-purple-200",
      SAME_DAY: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      NURSERY_ROUTE: "bg-pink-100 text-pink-800 border border-pink-200",
      EXTRAS: "bg-gray-100 text-gray-800 border border-gray-200",
      ORDT_EXTRA_LARGE_CARGO_VAN:
        "bg-orange-100 text-orange-800 border border-orange-200",
      STANDARD_PARCEL_MEDIUM_VAN:
        "bg-indigo-100 text-indigo-800 border border-indigo-200",
      NURSERY_ROUTE_LEVEL_1: "bg-teal-100 text-teal-800 border border-teal-200",
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
    if (!this.hasChanges()) {
      this.alert.showWarning("No changes to save");
      return;
    }

    // Note: In the future, we'll support multiple entries for the same driver
    // when one driver helps another. This will require:
    // 1. Removing the unique constraint check
    // 2. Adding a "helpedBy" or "assistedBy" field
    // 3. Modifying the backend to allow multiple records per driver/date

    // Filter out empty rows (no driverId) - but allow empty list if deleting all
    const validItems = this.items().filter(
      (i) => i.driverId && i.driverId.trim()
    );

    // If no valid items but we have changes, it means we're deleting all records
    if (validItems.length === 0 && !this.hasChanges()) {
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

    this.loading.set(true);

    this.paymentService.saveDaily(body).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.alert.showSuccess(
          "Daily payments saved",
          `Created: ${res.created}, Updated: ${res.updated}`
        );

        // Add a small delay to ensure backend has processed the save
        setTimeout(() => {
          this.load();
        }, 500);
      },
      error: (err) => {
        this.loading.set(false);
        this.alert.showError(
          "Failed to save daily payments",
          err?.error?.message || err?.message || "Unknown error"
        );
      },
    });
  }

  // XLSX Import functionality
  openImportModal(): void {
    this.showImportModal.set(true);
    this.importResult.set(null);
  }

  closeImportModal(): void {
    this.showImportModal.set(false);
    this.importResult.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      this.alert.showError(
        "Invalid file type",
        "Please select an Excel file (.xlsx or .xls)"
      );
      return;
    }

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const fileContent = base64.split(",")[1]; // Remove data:application/... prefix

      this.importFromXlsx(fileContent);
    };
    reader.onerror = () => {
      this.alert.showError(
        "File read error",
        "Failed to read the selected file"
      );
    };
    reader.readAsDataURL(file);
  }

  private importFromXlsx(fileContent: string): void {
    const request: ImportXlsxRequest = {
      date: this.date(),
      sourceSheet: this.sourceSheet() || undefined,
      fileContent,
    };

    this.importing.set(true);

    this.paymentService.importXlsx(request).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.importResult.set(result);

        // Always refresh the data if any records were created or updated
        if (result.created > 0 || result.updated > 0) {
          this.load(); // Refresh the data to show changes
        }

        if (result.errors.length === 0) {
          this.alert.showSuccess(
            "Import completed successfully",
            `Created: ${result.created}, Updated: ${result.updated}`
          );
          this.closeImportModal();
        } else {
          this.alert.showWarning(
            "Import completed with errors",
            `Created: ${result.created}, Updated: ${result.updated}, Errors: ${result.errors.length}`
          );
        }
      },
      error: (err) => {
        this.importing.set(false);
        this.alert.showError(
          "Import failed",
          err?.error?.message || err?.message || "Unknown error"
        );
      },
    });
  }

  // Route dropdown methods
  toggleRouteDropdown(index: number): void {
    const currentlyOpen = this.openRouteDropdown();
    this.openRouteDropdown.set(currentlyOpen === index ? null : index);
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: Event): void {
    // Close dropdown when clicking outside
    const target = event.target as HTMLElement;
    if (!target.closest(".relative")) {
      this.openRouteDropdown.set(null);
    }
  }

  selectRouteType(index: number, routeType: string): void {
    this.onCellChange(index, "routeType", routeType);
    this.openRouteDropdown.set(null); // Close dropdown
  }

  getRouteTypeHoverClass(routeType: string): string {
    const hoverClasses = {
      FULL_ROUTE: "hover:bg-blue-50 hover:text-blue-600",
      TRAINING_DAY: "hover:bg-green-50 hover:text-green-600",
      HIDE_ALONG: "hover:bg-purple-50 hover:text-purple-600",
      SAME_DAY: "hover:bg-yellow-50 hover:text-yellow-600",
      NURSERY_ROUTE: "hover:bg-pink-50 hover:text-pink-600",
      EXTRAS: "hover:bg-gray-50 hover:text-gray-600",
      ORDT_EXTRA_LARGE_CARGO_VAN: "hover:bg-orange-50 hover:text-orange-600",
      STANDARD_PARCEL_MEDIUM_VAN: "hover:bg-indigo-50 hover:text-indigo-600",
      NURSERY_ROUTE_LEVEL_1: "hover:bg-teal-50 hover:text-teal-600",
    };
    return (
      hoverClasses[routeType as keyof typeof hoverClasses] ||
      "hover:bg-gray-50 hover:text-gray-600"
    );
  }
}
