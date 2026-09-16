import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";

import { toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map } from "rxjs";

import { VansService } from "./vans.service";
import { ContractsService } from "./contracts.service";
import { MaintenanceService } from "./maintenance.service";
import { PartsService } from "./parts.service";
import {
  Van,
  Contract,
  MaintenanceRecord,
  StatCard,
  VanStatus,
  VanCondition,
  GetVansQuery,
} from "./vans.model";

@Component({
  selector: "app-van-dashboard",
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="van-dashboard">
      <!-- Header -->
      <div class="flex justify-between items-center mb-8">
        <div class="flex items-center space-x-3">
          <div class="p-2 bg-blue-100 rounded-lg">
            <svg
              class="w-8 h-8 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6-6 6V7z"
              />
            </svg>
          </div>
          <div>
            <h1 class="text-3xl font-bold text-gray-900">
              Van Management Panel
            </h1>
            <p class="text-gray-600">Amazon Delivery Partner Dashboard</p>
          </div>
        </div>
        <div class="flex space-x-3">
          <button
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            (click)="exportData()"
          >
            <svg
              class="w-4 h-4 mr-2"
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
            Export
          </button>
          <button
            class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            (click)="addVan()"
          >
            <svg
              class="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add Van
          </button>
        </div>
      </div>

      <!-- Statistics Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        @for (card of statCards(); track card.title) {
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div [class]="'p-3 rounded-lg ' + card.bgColor">
                <div
                  [class]="'w-6 h-6 ' + card.color"
                  [innerHTML]="card.icon"
                ></div>
              </div>
            </div>
            <div class="ml-4 flex-1">
              <h3 class="text-sm font-medium text-gray-500">
                {{ card.title }}
              </h3>
              <p class="text-2xl font-bold text-gray-900">{{ card.value }}</p>
              <p class="text-sm text-gray-600">{{ card.subtitle }}</p>
            </div>
          </div>
        </div>
        }
      </div>

      <!-- Navigation Tabs -->
      <div class="mb-6">
        <nav class="flex space-x-8" aria-label="Tabs">
          @for (tab of tabs; track tab.key) {
          <button
            [class]="getTabClasses(tab.key)"
            (click)="activeTab.set(tab.key)"
            type="button"
          >
            {{ tab.label }}
          </button>
          }
        </nav>
      </div>

      <!-- Tab Content -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200">
        @switch (activeTab()) { @case ('fleet') {
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-semibold text-gray-900">Fleet Overview</h2>
            <p class="text-sm text-gray-600">Manage your delivery van fleet</p>
          </div>

          <!-- Filters -->
          <div class="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div class="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search by registration, VIN, or make..."
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                [(ngModel)]="searchTerm"
                (input)="applyFilters()"
              />
            </div>
            <select
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              [(ngModel)]="statusFilter"
              (change)="applyFilters()"
            >
              <option value="">All Status</option>
              <option value="BOOKED">Booked</option>
              <option value="DELIVERED">Delivered</option>
              <option value="TBC">TBC</option>
              <option value="AVAILABLE">Available</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="OUT_OF_SERVICE">Out of Service</option>
            </select>
            <select
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              [(ngModel)]="conditionFilter"
              (change)="applyFilters()"
            >
              <option value="">All Condition</option>
              <option value="EXCELLENT">Excellent</option>
              <option value="GOOD">Good</option>
              <option value="FAIR">Fair</option>
              <option value="POOR">Poor</option>
              <option value="NEEDS_ATTENTION">Needs Attention</option>
            </select>
            <button
              class="px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
              (click)="clearFilters()"
            >
              Clear
            </button>
          </div>

          <!-- Fleet Table -->
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Van ID
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Registration
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Make/Model
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Condition
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    MOT
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Contract
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Rental
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Comments
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                @for (van of filteredVans(); track van.id) {
                <tr class="hover:bg-gray-50">
                  <td
                    class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                  >
                    {{ van.vanNumber }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ van.registration }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ van.make }} {{ van.model }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span [class]="getStatusBadgeClasses(van.status)">
                      {{ van.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span [class]="getConditionBadgeClasses(van.condition)">
                      {{ van.condition }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    @if (van.motExpiry) {
                    <span [class]="getMotExpiryClasses(van.motExpiry)">
                      {{ formatDate(van.motExpiry) }}
                    </span>
                    } @else {
                    <span class="text-gray-400">N/A</span>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ van.contract?.name || "Unassigned" }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    @if (van.monthlyRental) { £{{ van.monthlyRental }}
                    } @else {
                    <span class="text-gray-400">-</span>
                    }
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {{ van.comments || "-" }}
                  </td>
                </tr>
                } @empty {
                <tr>
                  <td colspan="9" class="px-6 py-12 text-center text-gray-500">
                    @if (loading()) {
                    <div class="flex justify-center">
                      <div
                        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                      ></div>
                    </div>
                    } @else { No vans found matching your criteria }
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        } @case ('contracts') {
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-semibold text-gray-900">
              Contract Management
            </h2>
            <p class="text-sm text-gray-600">
              Overview of all delivery contracts
            </p>
          </div>

          <!-- Contracts Table -->
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Contract
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Depot
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Hire Name
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Rental (£)
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Insurance
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Supplier
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Vehicle
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                @for (contract of contracts(); track contract.id) {
                <tr class="hover:bg-gray-50">
                  <td
                    class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                  >
                    {{ contract.name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ contract.depot }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ contract.hireName }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    £{{ contract.rentalRate }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span [class]="getContractStatusClasses(contract.status)">
                      {{ contract.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span
                      [class]="
                        contract.hasInsurance
                          ? 'text-green-600 bg-green-100 px-2 py-1 rounded-full text-xs'
                          : 'text-red-600 bg-red-100 px-2 py-1 rounded-full text-xs'
                      "
                    >
                      {{ contract.hasInsurance ? "YES" : "NO" }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ contract.supplier || "-" }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ getContractVehicleInfo(contract) }}
                  </td>
                </tr>
                } @empty {
                <tr>
                  <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                    @if (loading()) {
                    <div class="flex justify-center">
                      <div
                        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                      ></div>
                    </div>
                    } @else { No contracts found }
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        } @case ('maintenance') {
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-semibold text-gray-900">
              Maintenance Schedule
            </h2>
            <p class="text-sm text-gray-600">
              Track vehicle maintenance and repairs
            </p>
          </div>

          <!-- Maintenance Alerts -->
          @if (maintenanceAlerts(); as alerts) {
          <div class="mb-6">
            @for (alert of alerts; track alert.id) {
            <div
              class="flex items-center p-4 mb-3 bg-yellow-50 border border-yellow-200 rounded-lg"
            >
              <svg
                class="w-5 h-5 text-yellow-400 mr-3"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fill-rule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clip-rule="evenodd"
                />
              </svg>
              <div class="flex-1">
                <h4 class="text-sm font-medium text-yellow-800">
                  {{ alert.van?.vanNumber }} - {{ alert.van?.registration }}
                </h4>
                <p class="text-sm text-yellow-700">
                  {{ alert.description }}
                  @if (alert.isOverdue) {
                  <span class="text-red-600 font-medium">- OVERDUE</span>
                  }
                </p>
              </div>
              <span [class]="getPriorityBadgeClasses(alert.priority)">
                {{ alert.priority }}
              </span>
            </div>
            }
          </div>
          }

          <!-- Maintenance Records -->
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Van
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Type
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Description
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Scheduled
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Status
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Priority
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Cost
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                @for (record of maintenanceRecords(); track record.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    @if (record.van) {
                    <div>
                      <div class="font-medium">{{ record.van.vanNumber }}</div>
                      <div class="text-gray-500">
                        {{ record.van.registration }}
                      </div>
                    </div>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ record.type }}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 max-w-xs">
                    {{ record.description }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ formatDate(record.scheduledDate) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span [class]="getMaintenanceStatusClasses(record.status)">
                      {{ record.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span [class]="getPriorityBadgeClasses(record.priority)">
                      {{ record.priority }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    @if (record.estimatedCost) { £{{ record.estimatedCost }}
                    } @else {
                    <span class="text-gray-400">-</span>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <button class="text-blue-600 hover:text-blue-800 text-sm">
                      Schedule Repair
                    </button>
                  </td>
                </tr>
                } @empty {
                <tr>
                  <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                    @if (loading()) {
                    <div class="flex justify-center">
                      <div
                        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                      ></div>
                    </div>
                    } @else { No maintenance records found }
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        } @case ('parts') {
        <div class="p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-lg font-semibold text-gray-900">
              Parts Inventory & Pricing
            </h2>
            <p class="text-sm text-gray-600">
              Spare parts pricing by vehicle make
            </p>
          </div>

          <!-- Vehicle Make Selector -->
          <div class="mb-6">
            <div class="flex space-x-4">
              @for (make of vehicleMakes; track make) {
              <button
                [class]="getVehicleMakeButtonClasses(make)"
                (click)="selectedVehicleMake.set(make)"
              >
                {{ make }}
              </button>
              }
            </div>
          </div>

          <!-- Parts Pricing Table -->
          @if (partsPricing(); as pricing) {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Part Description
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Ford (£)
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Mercedes (£)
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Peugeot (£)
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                @for (price of pricing; track price.partId) {
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ price.partName }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    @if (price.fordPrice) { £{{ price.fordPrice.toFixed(2) }}
                    } @else {
                    <span class="text-gray-400">-</span>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    @if (price.mercedesPrice) { £{{
                      price.mercedesPrice.toFixed(2)
                    }}
                    } @else {
                    <span class="text-gray-400">-</span>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    @if (price.peugeotPrice) { £{{
                      price.peugeotPrice.toFixed(2)
                    }}
                    } @else {
                    <span class="text-gray-400">-</span>
                    }
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
          } @else {
          <div class="text-center py-12">
            <div class="flex justify-center">
              <div
                class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
              ></div>
            </div>
          </div>
          }
        </div>
        } }
      </div>
    </div>
  `,
  styles: [
    `
      .van-dashboard {
        max-width: 80rem;
        margin: 0 auto;
        padding: 2rem 1rem;
      }
    `,
  ],
})
export class VanDashboardComponent {
  private readonly vansService = inject(VansService);
  private readonly contractsService = inject(ContractsService);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly partsService = inject(PartsService);

  // Signals for state management
  readonly activeTab = signal<"fleet" | "contracts" | "maintenance" | "parts">(
    "fleet"
  );
  readonly searchTerm = signal("");
  readonly statusFilter = signal<VanStatus | "">("");
  readonly conditionFilter = signal<VanCondition | "">("");
  readonly selectedVehicleMake = signal<"ford" | "mercedes" | "peugeot">(
    "ford"
  );

  // Data signals from API
  readonly vans = toSignal(this.vansService.getVans(), {
    initialValue: [] as Van[],
  });
  readonly vanStats = toSignal(this.vansService.getStats(), {
    initialValue: {
      total: 0,
      active: 0,
      booked: 0,
      maintenance: 0,
      expiringMot: 0,
      alerts: 0,
      totalRental: 0,
    },
  });
  readonly contracts = toSignal(this.contractsService.getContracts(), {
    initialValue: [] as Contract[],
  });
  readonly maintenanceRecords = toSignal(
    this.maintenanceService.getMaintenanceRecords(),
    { initialValue: [] as MaintenanceRecord[] }
  );
  readonly maintenanceAlerts = toSignal(this.maintenanceService.getAlerts(), {
    initialValue: [] as MaintenanceRecord[],
  });

  // Parts pricing data
  readonly partsPricing = toSignal(
    combineLatest([
      this.partsService.getPricingByVehicle("ford"),
      this.partsService.getPricingByVehicle("mercedes"),
      this.partsService.getPricingByVehicle("peugeot"),
    ]).pipe(
      map(([fordPricing, mercedesPricing, peugeotPricing]) => {
        // Combine all pricing data into a single array
        const allParts = new Map<string, any>();

        [...fordPricing, ...mercedesPricing, ...peugeotPricing].forEach(
          (part) => {
            if (!allParts.has(part.partName)) {
              allParts.set(part.partName, {
                partId: part.partId,
                partName: part.partName,
                fordPrice: null,
                mercedesPrice: null,
                peugeotPrice: null,
              });
            }
            const existing = allParts.get(part.partName);
            if (existing) {
              existing.fordPrice = part.fordPrice || existing.fordPrice;
              existing.mercedesPrice =
                part.mercedesPrice || existing.mercedesPrice;
              existing.peugeotPrice =
                part.peugeotPrice || existing.peugeotPrice;
            }
          }
        );

        return Array.from(allParts.values());
      })
    ),
    { initialValue: [] }
  );

  readonly loading = signal(false);

  // Computed properties
  readonly statCards = computed((): StatCard[] => {
    const stats = this.vanStats();
    return [
      {
        title: "Total Vans",
        value: stats.total.toString(),
        subtitle: "Active fleet",
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6-6 6V7z"/>',
        color: "text-blue-600",
        bgColor: "bg-blue-100",
      },
      {
        title: "Active Contracts",
        value: "1",
        subtitle: "Current agreements",
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>',
        color: "text-green-600",
        bgColor: "bg-green-100",
      },
      {
        title: "Maintenance Alerts",
        value: stats.alerts.toString(),
        subtitle: "Require attention",
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L5.36 16.5c-.77.833.192 2.5 1.732 2.5z"/>',
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
      },
      {
        title: "Monthly Rental",
        value: `£${stats.totalRental.toFixed(0)}`,
        subtitle: "Total cost",
        icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>',
        color: "text-indigo-600",
        bgColor: "bg-indigo-100",
      },
    ];
  });

  readonly filteredVans = computed(() => {
    let filtered = this.vans();

    if (this.searchTerm()) {
      const search = this.searchTerm().toLowerCase();
      filtered = filtered.filter(
        (van) =>
          van.registration.toLowerCase().includes(search) ||
          van.vanNumber.toLowerCase().includes(search) ||
          van.make.toLowerCase().includes(search) ||
          van.model.toLowerCase().includes(search) ||
          (van.vin && van.vin.toLowerCase().includes(search))
      );
    }

    if (this.statusFilter()) {
      filtered = filtered.filter((van) => van.status === this.statusFilter());
    }

    if (this.conditionFilter()) {
      filtered = filtered.filter(
        (van) => van.condition === this.conditionFilter()
      );
    }

    return filtered;
  });

  readonly tabs = [
    { key: "fleet" as const, label: "Fleet Management" },
    { key: "contracts" as const, label: "Contracts" },
    { key: "maintenance" as const, label: "Maintenance" },
    { key: "parts" as const, label: "Parts Inventory" },
  ];

  readonly vehicleMakes: Array<"ford" | "mercedes" | "peugeot"> = [
    "ford",
    "mercedes",
    "peugeot",
  ];

  // Methods
  getTabClasses(tabKey: string): string {
    return this.activeTab() === tabKey
      ? "whitespace-nowrap py-4 px-1 border-b-2 border-blue-500 font-medium text-sm text-blue-600"
      : "whitespace-nowrap py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300";
  }

  getStatusBadgeClasses(status: VanStatus): string {
    const baseClasses =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case "BOOKED":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case "DELIVERED":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "TBC":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case "AVAILABLE":
        return `${baseClasses} bg-gray-100 text-gray-800`;
      case "MAINTENANCE":
        return `${baseClasses} bg-orange-100 text-orange-800`;
      case "OUT_OF_SERVICE":
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  getConditionBadgeClasses(condition: VanCondition): string {
    const baseClasses =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (condition) {
      case "EXCELLENT":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "GOOD":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case "FAIR":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case "POOR":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "NEEDS_ATTENTION":
        return `${baseClasses} bg-orange-100 text-orange-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  getContractStatusClasses(status: string): string {
    const baseClasses =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case "ACTIVE":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "REMOVED":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "BROKEN_DOWN":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "SUSPENDED":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case "EXPIRED":
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  getMaintenanceStatusClasses(status: string): string {
    const baseClasses =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (status) {
      case "SCHEDULED":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case "IN_PROGRESS":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case "COMPLETED":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "CANCELLED":
        return `${baseClasses} bg-gray-100 text-gray-800`;
      case "OVERDUE":
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  getPriorityBadgeClasses(priority: string): string {
    const baseClasses =
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";
    switch (priority) {
      case "LOW":
        return `${baseClasses} bg-gray-100 text-gray-800`;
      case "MEDIUM":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case "HIGH":
        return `${baseClasses} bg-orange-100 text-orange-800`;
      case "URGENT":
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  }

  getMotExpiryClasses(motExpiry: string): string {
    const expiryDate = new Date(motExpiry);
    const now = new Date();
    const thirtyDaysFromNow = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    );

    if (expiryDate < now) {
      return "text-red-600 font-medium";
    } else if (expiryDate < thirtyDaysFromNow) {
      return "text-yellow-600 font-medium";
    }
    return "text-gray-900";
  }

  getVehicleMakeButtonClasses(make: string): string {
    const baseClasses =
      "px-4 py-2 text-sm font-medium rounded-md transition-colors";
    return this.selectedVehicleMake() === make
      ? `${baseClasses} bg-blue-600 text-white`
      : `${baseClasses} bg-gray-100 text-gray-700 hover:bg-gray-200`;
  }

  getContractVehicleInfo(contract: Contract): string {
    if (!contract.vans || contract.vans.length === 0) {
      return "No vehicles assigned";
    }
    const firstVan = contract.vans[0];
    const make =
      firstVan.make === "Ford"
        ? "Ford Transit"
        : firstVan.make === "Mercedes"
        ? "Mercedes eSPRINTER"
        : firstVan.make === "Peugeot"
        ? "Peugeot Boxer"
        : firstVan.make;
    return contract.vans.length === 1
      ? make
      : `${make} (+${contract.vans.length - 1} more)`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  applyFilters(): void {
    // Filters are automatically applied via computed properties
  }

  clearFilters(): void {
    this.searchTerm.set("");
    this.statusFilter.set("");
    this.conditionFilter.set("");
  }

  exportData(): void {
    // TODO: Implement export functionality
    console.log("Export data functionality to be implemented");
  }

  addVan(): void {
    // TODO: Implement add van functionality
    console.log("Add van functionality to be implemented");
  }
}
