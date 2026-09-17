import { Component, signal, inject, ChangeDetectionStrategy, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "../../../../environments/environment";
import { AlertService } from "../../../shared/services/alert.service";
import { apiErrorMessage } from "../../../shared/utils/api-error";
import { downloadCsv, today } from "../../../shared/utils/csv";

type AuditCategory = "access" | "changes";

interface AuditEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  action: string;
  success: boolean;
  actorName: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
}

interface AuditResponse {
  data: AuditEntry[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: { signIns24h: number; failedSignIns24h: number; priceChanges7d: number };
}

@Component({
  selector: "app-audit-logs",
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto">
      <div class="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p class="text-gray-600 mt-1">Sign-ins on this DSP's domain and route price changes.</p>
          <p class="text-xs text-gray-400 mt-1">
            A full change history of drivers, vans and payments will be added in a later release.
          </p>
        </div>
        <button
          type="button"
          (click)="exportCsv()"
          [disabled]="entries().length === 0"
          class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Export CSV
        </button>
      </div>

      <!-- Summary -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p class="text-sm text-gray-600">Sign-ins (24h)</p>
          <p class="text-2xl font-semibold text-gray-900">{{ summary()?.signIns24h ?? "—" }}</p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p class="text-sm text-gray-600">Failed sign-ins (24h)</p>
          <p class="text-2xl font-semibold" [class.text-red-600]="(summary()?.failedSignIns24h ?? 0) > 0">
            {{ summary()?.failedSignIns24h ?? "—" }}
          </p>
        </div>
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <p class="text-sm text-gray-600">Price changes (7 days)</p>
          <p class="text-2xl font-semibold text-gray-900">{{ summary()?.priceChanges7d ?? "—" }}</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div class="md:col-span-2">
            <label for="audit-search" class="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input
              id="audit-search"
              type="text"
              [ngModel]="search()"
              (ngModelChange)="onSearch($event)"
              placeholder="Name, email or IP"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label for="audit-category" class="block text-xs font-medium text-gray-600 mb-1">Type</label>
            <select
              id="audit-category"
              [ngModel]="category()"
              (ngModelChange)="category.set($event); reload()"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="all">All</option>
              <option value="access">Sign-ins</option>
              <option value="changes">Price changes</option>
            </select>
          </div>
          <div>
            <label for="audit-status" class="block text-xs font-medium text-gray-600 mb-1">Result</label>
            <select
              id="audit-status"
              [ngModel]="status()"
              (ngModelChange)="status.set($event); reload()"
              class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">Any</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label for="audit-from" class="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                id="audit-from"
                type="date"
                [ngModel]="from()"
                (ngModelChange)="from.set($event); reload()"
                class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label for="audit-to" class="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                id="audit-to"
                type="date"
                [ngModel]="to()"
                (ngModelChange)="to.set($event); reload()"
                class="w-full px-2 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        @if (loading()) {
          <p class="p-6 text-sm text-gray-500">Loading...</p>
        } @else if (error()) {
          <div class="p-6">
            <p class="text-sm text-red-600">{{ error() }}</p>
            <button type="button" (click)="load()" class="mt-2 text-sm text-blue-600 hover:text-blue-800">Try again</button>
          </div>
        } @else if (entries().length === 0) {
          <p class="p-6 text-sm text-gray-500">No activity matches these filters.</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Who</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-100">
                @for (entry of entries(); track entry.id) {
                  <tr>
                    <td class="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                      {{ entry.timestamp | date: "dd/MM/yyyy HH:mm:ss" }}
                    </td>
                    <td class="px-4 py-3 text-sm">
                      <div class="text-gray-900">{{ entry.actorName || "Unknown account" }}</div>
                      <div class="text-gray-500 text-xs">{{ entry.actorEmail }}</div>
                    </td>
                    <td class="px-4 py-3 text-sm whitespace-nowrap">
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        [ngClass]="
                          !entry.success
                            ? 'bg-red-100 text-red-800'
                            : entry.category === 'access'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                        "
                      >
                        {{ entry.action }}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-600">
                      {{ entry.details || entry.userAgent || "" }}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{{ entry.ipAddress || "—" }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p class="text-sm text-gray-600">
              Page {{ page() }} of {{ totalPages() || 1 }} · {{ total() }} records
            </p>
            <div class="space-x-2">
              <button
                type="button"
                (click)="goToPage(page() - 1)"
                [disabled]="page() <= 1"
                class="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                (click)="goToPage(page() + 1)"
                [disabled]="page() >= totalPages()"
                class="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class AuditLogsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly alertService = inject(AlertService);
  private readonly apiUrl = `${environment.apiUrl}/audit/logs`;
  private searchTimer?: ReturnType<typeof setTimeout>;

  readonly entries = signal<AuditEntry[]>([]);
  readonly summary = signal<AuditResponse["summary"] | null>(null);
  readonly loading = signal(true);
  readonly error = signal("");

  readonly search = signal("");
  readonly category = signal<"all" | AuditCategory>("all");
  readonly status = signal<"" | "success" | "failed">("");
  readonly from = signal("");
  readonly to = signal("");

  readonly page = signal(1);
  readonly limit = 25;
  readonly total = signal(0);
  readonly totalPages = signal(0);

  ngOnInit(): void {
    this.load();
  }

  onSearch(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.reload(), 350);
  }

  reload(): void {
    this.page.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || (this.totalPages() && page > this.totalPages())) {
      return;
    }
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set("");
    this.http.get<AuditResponse>(this.apiUrl, { params: this.buildParams(this.page(), this.limit) }).subscribe({
      next: (response) => {
        this.entries.set(response.data);
        this.summary.set(response.summary);
        this.total.set(response.pagination.total);
        this.totalPages.set(response.pagination.totalPages);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.error.set(apiErrorMessage(err, "Could not load audit logs."));
        this.loading.set(false);
      },
    });
  }

  /** Exports up to 100 records matching the current filters */
  exportCsv(): void {
    this.http.get<AuditResponse>(this.apiUrl, { params: this.buildParams(1, 100) }).subscribe({
      next: (response) => {
        downloadCsv<AuditEntry>(`audit-logs-${today()}`, response.data, [
          { header: "When", value: (entry) => entry.timestamp },
          { header: "Type", value: (entry) => (entry.category === "access" ? "Sign-in" : "Price change") },
          { header: "Action", value: (entry) => entry.action },
          { header: "Result", value: (entry) => (entry.success ? "Success" : "Failed") },
          { header: "Name", value: (entry) => entry.actorName },
          { header: "Email", value: (entry) => entry.actorEmail },
          { header: "IP", value: (entry) => entry.ipAddress },
          { header: "Device", value: (entry) => entry.userAgent },
          { header: "Details", value: (entry) => entry.details },
        ]);
        if (response.pagination.total > response.data.length) {
          this.alertService.showWarning(
            "Export limited to 100 records",
            "Narrow the dates to export older activity."
          );
        }
      },
      error: (err: unknown) => {
        this.alertService.showError("Export failed", apiErrorMessage(err, "Please try again."));
      },
    });
  }

  private buildParams(page: number, limit: number): HttpParams {
    let params = new HttpParams().set("page", page).set("limit", limit).set("category", this.category());
    if (this.search().trim()) params = params.set("search", this.search().trim());
    if (this.status()) params = params.set("status", this.status());
    if (this.from()) params = params.set("from", new Date(`${this.from()}T00:00:00`).toISOString());
    if (this.to()) params = params.set("to", new Date(`${this.to()}T23:59:59.999`).toISOString());
    return params;
  }
}
