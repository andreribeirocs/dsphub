import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  output,
  signal,
} from "@angular/core";
import { DatePipe, DecimalPipe } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpErrorResponse } from "@angular/common/http";
import { EMPTY, Observable, expand, reduce } from "rxjs";

import { AlertService } from "../../shared/services/alert.service";
import { downloadCsv, today } from "../../shared/utils/csv";
import { apiErrorMessage } from "../../shared/utils/api-error";
import { PaymentService } from "./payment.service";
import {
  PaymentHistoryFilters,
  PaymentHistoryItem,
  PaymentHistoryResponse,
  ROUTE_TYPE_COLORS,
  ROUTE_TYPE_LABELS,
  RouteType,
} from "./payment.model";

const PAGE_SIZE = 20;
/** Page size used when collecting every row for the CSV export */
const EXPORT_PAGE_SIZE = 500;

@Component({
  selector: "app-payment-history-modal",
  standalone: true,
  imports: [FormsModule, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto p-4"
      (click)="onBackdropClick($event)"
      (keydown.escape)="close.emit()"
      tabindex="-1"
    >
      <div
        class="bg-white rounded-xl w-full max-w-5xl my-8 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-modal-title"
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h3 id="history-modal-title" class="text-lg font-semibold text-gray-900">
              Full Price History
            </h3>
            <p class="text-sm text-gray-600 mt-1">
              Every route price change, newest first
            </p>
          </div>
          <div class="flex items-center space-x-3">
            <button
              type="button"
              (click)="exportCsv()"
              [disabled]="exporting() || total() === 0"
              class="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ exporting() ? "Exporting..." : "Export CSV" }}
            </button>
            <button
              type="button"
              (click)="close.emit()"
              class="text-gray-400 hover:text-gray-600"
              aria-label="Close"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Filters -->
        <div class="flex flex-wrap items-end gap-4 px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div class="min-w-56 flex-1">
            <label for="historyRouteType" class="block text-xs font-medium text-gray-600 mb-1">Route type</label>
            <select
              id="historyRouteType"
              [ngModel]="routeType()"
              (ngModelChange)="routeType.set($event); applyFilters()"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All route types</option>
              @for (type of routeTypes; track type) {
              <option [value]="type">{{ label(type) }}</option>
              }
            </select>
          </div>
          <div>
            <label for="historyFrom" class="block text-xs font-medium text-gray-600 mb-1">From</label>
            <input
              id="historyFrom"
              type="date"
              [ngModel]="startDate()"
              (ngModelChange)="startDate.set($event); applyFilters()"
              class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label for="historyTo" class="block text-xs font-medium text-gray-600 mb-1">To</label>
            <input
              id="historyTo"
              type="date"
              [ngModel]="endDate()"
              (ngModelChange)="endDate.set($event); applyFilters()"
              class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          @if (routeType() || startDate() || endDate()) {
          <button
            type="button"
            (click)="clearFilters()"
            class="px-3 py-2 text-sm text-blue-600 hover:text-blue-800"
          >
            Clear
          </button>
          }
        </div>

        <!-- Table -->
        <div class="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50 sticky top-0">
              <tr>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route type</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Old rate</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">New rate</th>
                <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Change</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Changed by</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @if (loading()) {
              <tr>
                <td colspan="7" class="px-4 py-12">
                  <div class="flex justify-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                </td>
              </tr>
              } @else if (error()) {
              <tr>
                <td colspan="7" class="px-4 py-12 text-center">
                  <p class="text-red-600 text-sm">{{ error() }}</p>
                  <button type="button" (click)="load()" class="mt-2 text-sm text-blue-600 hover:text-blue-800">
                    Try again
                  </button>
                </td>
              </tr>
              } @else {
              @for (item of items(); track item.id) {
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {{ item.changeDate | date : "d/M/yyyy HH:mm" }}
                </td>
                <td class="px-4 py-3 text-sm">
                  <span [class]="color(item.routeType)" class="px-2 py-1 rounded-full text-xs font-medium">
                    {{ label(item.routeType) }}
                  </span>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                  @if (item.oldRate !== null) { £{{ item.oldRate | number : "1.2-2" }} } @else { - }
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                  £{{ item.newRate | number : "1.2-2" }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-right">
                  @if (item.oldRate !== null) {
                  @if (item.newRate >= item.oldRate) {
                  <span class="text-green-600 font-medium">+£{{ item.newRate - item.oldRate | number : "1.2-2" }}</span>
                  } @else {
                  <span class="text-red-600 font-medium">-£{{ item.oldRate - item.newRate | number : "1.2-2" }}</span>
                  }
                  } @else {
                  <span class="text-gray-500">Initial</span>
                  }
                </td>
                <td class="px-4 py-3 text-sm text-gray-600 max-w-xs">
                  {{ item.changeReason || "-" }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {{ item.changedByUser.name }}
                </td>
              </tr>
              } @empty {
              <tr>
                <td colspan="7" class="px-4 py-12 text-center text-sm text-gray-500">
                  No price changes found
                </td>
              </tr>
              }
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-gray-200">
          <p class="text-sm text-gray-600">
            @if (total() > 0) {
            Showing {{ rangeStart() }}-{{ rangeEnd() }} of {{ total() }} changes
            } @else { 0 changes }
          </p>
          <div class="flex items-center space-x-2">
            <button
              type="button"
              (click)="goToPage(page() - 1)"
              [disabled]="loading() || page() <= 1"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span class="text-sm text-gray-600">
              Page {{ page() }} of {{ totalPages() || 1 }}
            </span>
            <button
              type="button"
              (click)="goToPage(page() + 1)"
              [disabled]="loading() || page() >= totalPages()"
              class="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PaymentHistoryModalComponent implements OnInit {
  private readonly paymentService = inject(PaymentService);
  private readonly alertService = inject(AlertService);

  readonly close = output<void>();

  readonly routeTypes = Object.values(RouteType);

  readonly routeType = signal<RouteType | "">("");
  readonly startDate = signal("");
  readonly endDate = signal("");

  readonly items = signal<PaymentHistoryItem[]>([]);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly exporting = signal(false);

  ngOnInit(): void {
    this.load();
  }

  rangeStart(): number {
    return (this.page() - 1) * PAGE_SIZE + 1;
  }

  rangeEnd(): number {
    return Math.min(this.page() * PAGE_SIZE, this.total());
  }

  label(type: RouteType): string {
    return ROUTE_TYPE_LABELS[type] ?? type;
  }

  color(type: RouteType): string {
    return ROUTE_TYPE_COLORS[type] ?? "bg-gray-100 text-gray-800";
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  applyFilters(): void {
    const start = this.startDate();
    const end = this.endDate();
    if (start && end && start > end) {
      this.alertService.showError("Invalid date range", '"From" must be before "To"');
      return;
    }
    this.page.set(1);
    this.load();
  }

  clearFilters(): void {
    this.routeType.set("");
    this.startDate.set("");
    this.endDate.set("");
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || (this.totalPages() > 0 && page > this.totalPages())) {
      return;
    }
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set("");
    this.fetchPage(this.page(), PAGE_SIZE).subscribe({
      next: (response) => {
        this.items.set(response.items);
        this.total.set(response.total);
        this.totalPages.set(response.totalPages);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(apiErrorMessage(err, "Failed to load price history"));
        this.loading.set(false);
      },
    });
  }

  exportCsv(): void {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(true);

    // Walk every page with the current filters and collect the rows
    this.fetchPage(1, EXPORT_PAGE_SIZE)
      .pipe(
        expand((response) =>
          response.page < response.totalPages
            ? this.fetchPage(response.page + 1, EXPORT_PAGE_SIZE)
            : EMPTY
        ),
        reduce((all, response) => all.concat(response.items), [] as PaymentHistoryItem[])
      )
      .subscribe({
        next: (rows) => {
          this.exporting.set(false);
          if (rows.length === 0) {
            this.alertService.showError("No price changes to export");
            return;
          }
          downloadCsv<PaymentHistoryItem>(`price-history-${today()}`, rows, [
            { header: "Date", value: (r) => r.changeDate },
            { header: "Route type", value: (r) => this.label(r.routeType) },
            { header: "Route type code", value: (r) => r.routeType },
            { header: "Old rate (GBP)", value: (r) => (r.oldRate !== null ? r.oldRate.toFixed(2) : "") },
            { header: "New rate (GBP)", value: (r) => r.newRate.toFixed(2) },
            {
              header: "Change (GBP)",
              value: (r) => (r.oldRate !== null ? (r.newRate - r.oldRate).toFixed(2) : ""),
            },
            { header: "Reason", value: (r) => r.changeReason ?? "" },
            { header: "Changed by", value: (r) => r.changedByUser.name },
            { header: "Changed by email", value: (r) => r.changedByUser.email },
          ]);
          this.alertService.showSuccess(`Exported ${rows.length} price changes`);
        },
        error: (err: HttpErrorResponse) => {
          this.exporting.set(false);
          this.alertService.showError(
            "Failed to export price history",
            apiErrorMessage(err, "Please try again")
          );
        },
      });
  }

  private fetchPage(page: number, limit: number): Observable<PaymentHistoryResponse> {
    const filters: PaymentHistoryFilters = {
      page,
      limit,
      routeType: this.routeType() || undefined,
      // Whole days: from 00:00 of the first day to the end of the last day
      startDate: this.startDate() ? `${this.startDate()}T00:00:00.000Z` : undefined,
      endDate: this.endDate() ? `${this.endDate()}T23:59:59.999Z` : undefined,
    };
    return this.paymentService.getPaymentHistory(filters);
  }
}
