import {
  Component,
  signal,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

interface AuditLog {
  id: string;
  timestamp: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
  action: string;
  resource: string;
  resourceId?: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

@Component({
  selector: "app-audit-logs",
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p class="text-gray-600 mt-1">
          Track all system activities and user actions
        </p>
      </div>

      <!-- Filters -->
      <div
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6"
      >
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >Search</label
            >
            <input
              type="text"
              placeholder="Search logs..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              [(ngModel)]="searchTerm"
              (input)="applyFilters()"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >Action</label
            >
            <select
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              [(ngModel)]="actionFilter"
              (change)="applyFilters()"
            >
              <option value="">All Actions</option>
              <option value="LOGIN">Login</option>
              <option value="LOGOUT">Logout</option>
              <option value="CREATE">Create</option>
              <option value="UPDATE">Update</option>
              <option value="DELETE">Delete</option>
              <option value="VIEW">View</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >Severity</label
            >
            <select
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              [(ngModel)]="severityFilter"
              (change)="applyFilters()"
            >
              <option value="">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >Date Range</label
            >
            <select
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              [(ngModel)]="dateFilter"
              (change)="applyFilters()"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
          </div>
        </div>
        <div class="mt-4 flex justify-between items-center">
          <button
            class="text-sm text-blue-600 hover:text-blue-800"
            (click)="clearFilters()"
          >
            Clear Filters
          </button>
          <button
            class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors"
            (click)="exportLogs()"
          >
            <svg
              class="w-4 h-4 inline mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export Logs
          </button>
        </div>
      </div>

      <!-- Logs Table -->
      <div
        class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Timestamp
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  User
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Action
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Resource
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Severity
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Details
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @for (log of filteredLogs(); track log.id) {
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ log.timestamp | date : "medium" }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="text-sm font-medium text-gray-900">
                    {{ log.user.name }}
                  </div>
                  <div class="text-sm text-gray-500">{{ log.user.email }}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    [ngClass]="getActionBadgeClasses(log.action)"
                  >
                    {{ log.action }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {{ log.resource }}
                  @if (log.resourceId) {
                  <div class="text-xs text-gray-500">
                    ID: {{ log.resourceId }}
                  </div>
                  }
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    [ngClass]="getSeverityBadgeClasses(log.severity)"
                  >
                    {{ log.severity }}
                  </span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
                  <div class="truncate" [title]="log.details">
                    {{ log.details }}
                  </div>
                  <div class="text-xs text-gray-500 mt-1">
                    IP: {{ log.ipAddress }}
                  </div>
                </td>
              </tr>
              } @empty {
              <tr>
                <td colspan="6" class="px-6 py-12 text-center text-gray-500">
                  @if (loading()) {
                  <div class="flex justify-center">
                    <div
                      class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                    ></div>
                  </div>
                  } @else { No audit logs found matching your criteria }
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div
          class="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200"
        >
          <div class="flex-1 flex justify-between sm:hidden">
            <button
              class="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              class="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              Next
            </button>
          </div>
          <div
            class="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between"
          >
            <div>
              <p class="text-sm text-gray-700">
                Showing <span class="font-medium">1</span> to
                <span class="font-medium">{{ filteredLogs().length }}</span> of
                <span class="font-medium">{{ filteredLogs().length }}</span>
                results
              </p>
            </div>
            <div>
              <nav
                class="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
              >
                <button
                  class="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span class="sr-only">Previous</span>
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  class="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  1
                </button>
                <button
                  class="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                >
                  <span class="sr-only">Next</span>
                  <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fill-rule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clip-rule="evenodd"
                    />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AuditLogsComponent {
  readonly logs = signal<AuditLog[]>([]);
  readonly loading = signal(false);

  // Filter properties
  searchTerm = "";
  actionFilter = "";
  severityFilter = "";
  dateFilter = "24h";

  // Computed filtered logs
  readonly filteredLogs = computed(() => {
    const logs = this.logs();
    const search = this.searchTerm.toLowerCase();
    const action = this.actionFilter;
    const severity = this.severityFilter;

    return logs.filter((log) => {
      const matchesSearch =
        search === "" ||
        log.user.name.toLowerCase().includes(search) ||
        log.action.toLowerCase().includes(search) ||
        log.resource.toLowerCase().includes(search) ||
        log.details.toLowerCase().includes(search);

      const matchesAction = action === "" || log.action === action;
      const matchesSeverity = severity === "" || log.severity === severity;

      // TODO: Implement date filtering
      return matchesSearch && matchesAction && matchesSeverity;
    });
  });

  constructor() {
    this.loadMockData();
  }

  applyFilters(): void {
    // Filters are applied automatically through computed signal
  }

  clearFilters(): void {
    this.searchTerm = "";
    this.actionFilter = "";
    this.severityFilter = "";
    this.dateFilter = "24h";
  }

  exportLogs(): void {
    console.log("Exporting audit logs...");
    // TODO: Implement log export functionality
  }

  getActionBadgeClasses(action: string): string {
    const classes = {
      LOGIN: "bg-green-100 text-green-800",
      LOGOUT: "bg-gray-100 text-gray-800",
      CREATE: "bg-blue-100 text-blue-800",
      UPDATE: "bg-yellow-100 text-yellow-800",
      DELETE: "bg-red-100 text-red-800",
      VIEW: "bg-indigo-100 text-indigo-800",
    };
    return (
      classes[action as keyof typeof classes] || "bg-gray-100 text-gray-800"
    );
  }

  getSeverityBadgeClasses(severity: string): string {
    const classes = {
      LOW: "bg-gray-100 text-gray-800",
      MEDIUM: "bg-yellow-100 text-yellow-800",
      HIGH: "bg-orange-100 text-orange-800",
      CRITICAL: "bg-red-100 text-red-800",
    };
    return (
      classes[severity as keyof typeof classes] || "bg-gray-100 text-gray-800"
    );
  }

  private loadMockData(): void {
    // Mock audit log data
    this.logs.set([
      {
        id: "1",
        timestamp: new Date("2024-01-15T10:30:00Z"),
        user: {
          id: "1",
          name: "Administrator",
          email: "admin@triun.co.uk",
        },
        action: "LOGIN",
        resource: "Authentication",
        details: "Successful login with 2FA",
        ipAddress: "192.168.1.100",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        severity: "LOW",
      },
      {
        id: "2",
        timestamp: new Date("2024-01-15T10:15:00Z"),
        user: {
          id: "1",
          name: "Administrator",
          email: "admin@triun.co.uk",
        },
        action: "CREATE",
        resource: "User",
        resourceId: "usr_123",
        details: "Created new user: Fleet Manager (fleet@triun.co.uk)",
        ipAddress: "192.168.1.100",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        severity: "MEDIUM",
      },
      {
        id: "3",
        timestamp: new Date("2024-01-15T09:45:00Z"),
        user: {
          id: "2",
          name: "Financial Manager",
          email: "finance@triun.co.uk",
        },
        action: "UPDATE",
        resource: "Route Price",
        resourceId: "route_456",
        details: "Updated daily rate for FULL_ROUTE from £120.00 to £125.00",
        ipAddress: "192.168.1.101",
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        severity: "HIGH",
      },
      {
        id: "4",
        timestamp: new Date("2024-01-15T09:30:00Z"),
        user: {
          id: "1",
          name: "Administrator",
          email: "admin@triun.co.uk",
        },
        action: "DELETE",
        resource: "User",
        resourceId: "usr_789",
        details: "Deleted user account: John Doe (john.doe@example.com)",
        ipAddress: "192.168.1.100",
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        severity: "CRITICAL",
      },
      {
        id: "5",
        timestamp: new Date("2024-01-15T09:00:00Z"),
        user: {
          id: "3",
          name: "Fleet Manager",
          email: "fleet@triun.co.uk",
        },
        action: "VIEW",
        resource: "Driver List",
        details: "Viewed driver management dashboard",
        ipAddress: "192.168.1.102",
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
        severity: "LOW",
      },
    ]);
  }
}
