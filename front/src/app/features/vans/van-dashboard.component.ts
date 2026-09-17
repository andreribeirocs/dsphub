import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  OnInit,
} from "@angular/core";
import { FormsModule } from "@angular/forms";
import { HttpErrorResponse } from "@angular/common/http";
import { forkJoin } from "rxjs";

import { AlertService } from "../../shared/services/alert.service";
import { downloadCsv, today } from "../../shared/utils/csv";
import { VansService } from "./vans.service";
import { ContractsService } from "./contracts.service";
import { MaintenanceService } from "./maintenance.service";
import { PartsService } from "./parts.service";
import {
  Van,
  Contract,
  ContractStats,
  Depot,
  MaintenanceRecord,
  PartPrice,
  StatCard,
  VanStats,
  VanStatus,
  VanCondition,
  VehicleMake,
} from "./vans.model";
import {
  VanFormModalComponent,
  VAN_CONDITION_OPTIONS,
  VAN_STATUS_OPTIONS,
} from "./van-form-modal.component";
import { apiErrorMessage } from "../../shared/utils/api-error";

type DashboardTab = "fleet" | "contracts" | "maintenance" | "parts";
type MakeFilter = "all" | VehicleMake;

const EMPTY_VAN_STATS: VanStats = {
  total: 0,
  active: 0,
  booked: 0,
  maintenance: 0,
  expiringMot: 0,
  alerts: 0,
  totalRental: 0,
};

@Component({
  selector: "app-van-dashboard",
  standalone: true,
  imports: [FormsModule, VanFormModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="van-dashboard">
      <!-- Header -->
      <div class="flex flex-wrap gap-4 justify-between items-center mb-8">
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
            type="button"
            class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            (click)="exportData()"
            [disabled]="filteredVans().length === 0"
            title="Export the vans currently shown in Fleet Management to CSV"
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
            type="button"
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
                <svg
                  [class]="'w-6 h-6 ' + card.color"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    [attr.d]="card.icon"
                  />
                </svg>
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
      <div class="mb-6 overflow-x-auto">
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
          <div class="flex flex-wrap gap-2 justify-between items-center mb-6">
            <h2 class="text-lg font-semibold text-gray-900">Fleet Overview</h2>
            <p class="text-sm text-gray-600">
              Showing {{ filteredVans().length }} of {{ vans().length }} vans
            </p>
          </div>

          <!-- Filters -->
          <div class="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div class="flex-1 min-w-64">
              <input
                type="text"
                placeholder="Search by van number, registration, VIN, make, model or driver..."
                aria-label="Search vans"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                [(ngModel)]="searchTerm"
              />
            </div>
            <select
              aria-label="Filter by status"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              [(ngModel)]="statusFilter"
            >
              <option value="">All Status</option>
              @for (option of statusOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
            <select
              aria-label="Filter by condition"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              [(ngModel)]="conditionFilter"
            >
              <option value="">All Condition</option>
              @for (option of conditionOptions; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
            <select
              aria-label="Filter by depot"
              class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              [(ngModel)]="depotFilter"
            >
              <option value="">All Depots</option>
              @for (depot of depots(); track depot.id) {
              <option [value]="depot.id">{{ depot.code }} - {{ depot.name }}</option>
              }
            </select>
            @if (hasActiveFilters()) {
            <button
              type="button"
              class="px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
              (click)="clearFilters()"
            >
              Clear
            </button>
            }
          </div>

          <!-- Fleet Table -->
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Van ID
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Registration
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Make/Model
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Depot
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condition
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MOT
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contract
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rental
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Comments
                  </th>
                  <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                @for (van of filteredVans(); track van.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ van.vanNumber }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ van.registration }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ van.make }} {{ van.model }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ depotLabel(van) }}
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
                    @if (formatMoney(van.monthlyRental); as rental) {
                    {{ rental }}
                    } @else {
                    <span class="text-gray-400">-</span>
                    }
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" [title]="van.comments || ''">
                    {{ van.comments || "-" }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      type="button"
                      class="text-blue-600 hover:text-blue-800 font-medium"
                      (click)="editVan(van)"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
                } @empty {
                <tr>
                  <td colspan="11" class="px-6 py-12 text-center text-gray-500">
                    @if (vansLoading()) {
                    <div class="flex justify-center">
                      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                    } @else if (vansError()) {
                    <p class="text-red-600">{{ vansError() }}</p>
                    <button
                      type="button"
                      class="mt-2 text-sm text-blue-600 hover:text-blue-800"
                      (click)="loadVans()"
                    >
                      Try again
                    </button>
                    } @else if (vans().length === 0) {
                    No vans yet. Use "Add Van" to register the first one.
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
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contract
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Depot
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hire Name
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rental (£)
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Insurance
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vehicle
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                @for (contract of contracts(); track contract.id) {
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {{ contract.name }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ contract.depot }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ contract.hireName }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ formatMoney(contract.rentalRate) || "-" }}
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
                    @if (contractsLoading()) {
                    <div class="flex justify-center">
                      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                    } @else if (contractsError()) {
                    <p class="text-red-600">{{ contractsError() }}</p>
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
          @if (maintenanceAlerts().length > 0) {
          <div class="mb-6">
            @for (alert of maintenanceAlerts(); track alert.id) {
            <div class="flex items-center p-4 mb-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <svg class="w-5 h-5 text-yellow-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
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
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Van
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scheduled
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                    @if (formatMoney(record.actualCost ?? record.estimatedCost); as cost) {
                    {{ cost }}
                    } @else {
                    <span class="text-gray-400">-</span>
                    }
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    @if (record.status !== 'COMPLETED' && record.status !== 'CANCELLED') {
                    <button
                      type="button"
                      class="text-blue-600 hover:text-blue-800 text-sm disabled:opacity-50"
                      [disabled]="completingId() === record.id"
                      (click)="completeMaintenance(record)"
                    >
                      {{ completingId() === record.id ? "Saving..." : "Mark complete" }}
                    </button>
                    } @else {
                    <span class="text-gray-400">-</span>
                    }
                  </td>
                </tr>
                } @empty {
                <tr>
                  <td colspan="8" class="px-6 py-12 text-center text-gray-500">
                    @if (maintenanceLoading()) {
                    <div class="flex justify-center">
                      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                    } @else if (maintenanceError()) {
                    <p class="text-red-600">{{ maintenanceError() }}</p>
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
            <div class="flex flex-wrap gap-3">
              @for (make of makeFilters; track make.key) {
              <button
                type="button"
                [class]="getVehicleMakeButtonClasses(make.key)"
                (click)="selectedVehicleMake.set(make.key)"
              >
                {{ make.label }}
              </button>
              }
            </div>
          </div>

          <!-- Parts Pricing Table -->
          @if (partsLoading()) {
          <div class="text-center py-12">
            <div class="flex justify-center">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          </div>
          } @else if (partsError()) {
          <div class="text-center py-12 text-red-600">{{ partsError() }}</div>
          } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Part Description
                  </th>
                  <th [class]="priceHeaderClasses('ford')">Ford (£)</th>
                  <th [class]="priceHeaderClasses('mercedes')">Mercedes (£)</th>
                  <th [class]="priceHeaderClasses('peugeot')">Peugeot (£)</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                @for (price of filteredPartsPricing(); track price.partId) {
                <tr class="hover:bg-gray-50">
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ price.partName }}
                  </td>
                  <td [class]="priceCellClasses('ford')">
                    {{ formatMoney(price.fordPrice) || "-" }}
                  </td>
                  <td [class]="priceCellClasses('mercedes')">
                    {{ formatMoney(price.mercedesPrice) || "-" }}
                  </td>
                  <td [class]="priceCellClasses('peugeot')">
                    {{ formatMoney(price.peugeotPrice) || "-" }}
                  </td>
                </tr>
                } @empty {
                <tr>
                  <td colspan="4" class="px-6 py-12 text-center text-gray-500">
                    No priced parts found
                  </td>
                </tr>
                }
              </tbody>
            </table>
          </div>
          }
        </div>
        } }
      </div>
    </div>

    @if (showVanModal()) {
    <app-van-form-modal
      [van]="editingVan()"
      [depots]="depots()"
      [contracts]="contracts()"
      (close)="closeVanModal()"
      (saved)="onVanSaved()"
    />
    }
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
export class VanDashboardComponent implements OnInit {
  private readonly vansService = inject(VansService);
  private readonly contractsService = inject(ContractsService);
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly partsService = inject(PartsService);
  private readonly alertService = inject(AlertService);

  // UI state
  readonly activeTab = signal<DashboardTab>("fleet");
  readonly searchTerm = signal("");
  readonly statusFilter = signal<VanStatus | "">("");
  readonly conditionFilter = signal<VanCondition | "">("");
  readonly depotFilter = signal("");
  readonly selectedVehicleMake = signal<MakeFilter>("all");

  readonly showVanModal = signal(false);
  readonly editingVan = signal<Van | null>(null);
  readonly completingId = signal<string | null>(null);

  // Data
  readonly vans = signal<Van[]>([]);
  readonly vansLoading = signal(true);
  readonly vansError = signal("");
  readonly vanStats = signal<VanStats>(EMPTY_VAN_STATS);
  readonly contractStats = signal<ContractStats | null>(null);
  readonly depots = signal<Depot[]>([]);

  readonly contracts = signal<Contract[]>([]);
  readonly contractsLoading = signal(true);
  readonly contractsError = signal("");

  readonly maintenanceRecords = signal<MaintenanceRecord[]>([]);
  readonly maintenanceAlerts = signal<MaintenanceRecord[]>([]);
  readonly maintenanceLoading = signal(true);
  readonly maintenanceError = signal("");

  readonly partsPricing = signal<PartPrice[]>([]);
  readonly partsLoading = signal(true);
  readonly partsError = signal("");

  readonly statusOptions = VAN_STATUS_OPTIONS;
  readonly conditionOptions = VAN_CONDITION_OPTIONS;

  readonly tabs: ReadonlyArray<{ key: DashboardTab; label: string }> = [
    { key: "fleet", label: "Fleet Management" },
    { key: "contracts", label: "Contracts" },
    { key: "maintenance", label: "Maintenance" },
    { key: "parts", label: "Parts Inventory" },
  ];

  readonly makeFilters: ReadonlyArray<{ key: MakeFilter; label: string }> = [
    { key: "all", label: "All makes" },
    { key: "ford", label: "Ford" },
    { key: "mercedes", label: "Mercedes" },
    { key: "peugeot", label: "Peugeot" },
  ];

  private readonly depotById = computed(
    () => new Map(this.depots().map((depot) => [depot.id, depot] as const))
  );

  readonly statCards = computed((): StatCard[] => {
    const stats = this.vanStats();
    const contractStats = this.contractStats();
    return [
      {
        title: "Total Vans",
        value: stats.total.toString(),
        subtitle: `${stats.active} active, ${stats.maintenance} in maintenance`,
        icon: "M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6-6 6V7z",
        color: "text-blue-600",
        bgColor: "bg-blue-100",
      },
      {
        title: "Active Contracts",
        value: contractStats ? contractStats.active.toString() : "-",
        subtitle: contractStats
          ? `of ${contractStats.total} contracts`
          : "Current agreements",
        icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
        color: "text-green-600",
        bgColor: "bg-green-100",
      },
      {
        title: "Maintenance Alerts",
        value: stats.alerts.toString(),
        subtitle: `${stats.expiringMot} MOT expiring in 30 days`,
        icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.664-.833-2.464 0L5.36 16.5c-.77.833.192 2.5 1.732 2.5z",
        color: "text-yellow-600",
        bgColor: "bg-yellow-100",
      },
      {
        title: "Monthly Rental",
        value: `£${stats.totalRental.toFixed(0)}`,
        subtitle: "Total cost",
        icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1",
        color: "text-indigo-600",
        bgColor: "bg-indigo-100",
      },
    ];
  });

  readonly hasActiveFilters = computed(
    () =>
      !!this.searchTerm().trim() ||
      !!this.statusFilter() ||
      !!this.conditionFilter() ||
      !!this.depotFilter()
  );

  readonly filteredVans = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const condition = this.conditionFilter();
    const depotId = this.depotFilter();
    const matches = (value?: string | null): boolean =>
      !!value && value.toLowerCase().includes(search);

    return this.vans().filter(
      (van) =>
        (!search ||
          matches(van.registration) ||
          matches(van.vanNumber) ||
          matches(van.make) ||
          matches(van.model) ||
          matches(van.vin) ||
          matches(van.assignedDriver)) &&
        (!status || van.status === status) &&
        (!condition || van.condition === condition) &&
        (!depotId || van.depotId === depotId)
    );
  });

  readonly filteredPartsPricing = computed(() => {
    const make = this.selectedVehicleMake();
    const parts = this.partsPricing();
    if (make === "all") {
      return parts;
    }
    return parts.filter((part) => this.toNumber(this.priceFor(part, make)) !== null);
  });

  ngOnInit(): void {
    this.loadVans();
    this.loadStats();
    this.loadDepots();
    this.loadContracts();
    this.loadMaintenance();
    this.loadPartsPricing();
  }

  // Loading
  loadVans(): void {
    this.vansLoading.set(true);
    this.vansError.set("");
    this.vansService.getVans().subscribe({
      next: (vans) => {
        this.vans.set(vans);
        this.vansLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.vansError.set(apiErrorMessage(err, "Failed to load vans"));
        this.vansLoading.set(false);
      },
    });
  }

  loadStats(): void {
    this.vansService.getStats().subscribe({
      next: (stats) => this.vanStats.set(stats),
      error: () => this.vanStats.set(EMPTY_VAN_STATS),
    });
    this.contractsService.getStats().subscribe({
      next: (stats) => this.contractStats.set(stats),
      error: () => this.contractStats.set(null),
    });
  }

  loadDepots(): void {
    this.vansService.getDepots().subscribe({
      next: (depots) => this.depots.set(depots),
      error: () => this.depots.set([]),
    });
  }

  loadContracts(): void {
    this.contractsLoading.set(true);
    this.contractsError.set("");
    this.contractsService.getContracts().subscribe({
      next: (contracts) => {
        this.contracts.set(contracts);
        this.contractsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.contractsError.set(apiErrorMessage(err, "Failed to load contracts"));
        this.contractsLoading.set(false);
      },
    });
  }

  loadMaintenance(): void {
    this.maintenanceLoading.set(true);
    this.maintenanceError.set("");
    forkJoin({
      records: this.maintenanceService.getMaintenanceRecords(),
      alerts: this.maintenanceService.getAlerts(),
    }).subscribe({
      next: ({ records, alerts }) => {
        this.maintenanceRecords.set(records);
        this.maintenanceAlerts.set(alerts);
        this.maintenanceLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.maintenanceError.set(apiErrorMessage(err, "Failed to load maintenance records"));
        this.maintenanceLoading.set(false);
      },
    });
  }

  loadPartsPricing(): void {
    this.partsLoading.set(true);
    this.partsError.set("");
    forkJoin([
      this.partsService.getPricingByVehicle("ford"),
      this.partsService.getPricingByVehicle("mercedes"),
      this.partsService.getPricingByVehicle("peugeot"),
    ]).subscribe({
      next: (lists) => {
        // Each list only holds parts priced for that make; merge them by part id
        const byId = new Map<string, PartPrice>();
        for (const part of lists.flat()) {
          byId.set(part.partId, part);
        }
        this.partsPricing.set(Array.from(byId.values()));
        this.partsLoading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.partsError.set(apiErrorMessage(err, "Failed to load parts pricing"));
        this.partsLoading.set(false);
      },
    });
  }

  // Actions
  addVan(): void {
    this.editingVan.set(null);
    this.showVanModal.set(true);
  }

  editVan(van: Van): void {
    this.editingVan.set(van);
    this.showVanModal.set(true);
  }

  closeVanModal(): void {
    this.showVanModal.set(false);
    this.editingVan.set(null);
  }

  onVanSaved(): void {
    this.closeVanModal();
    this.loadVans();
    this.loadStats();
    this.loadContracts();
  }

  completeMaintenance(record: MaintenanceRecord): void {
    const label = record.van ? `${record.van.vanNumber} - ${record.van.registration}` : "this van";
    if (!confirm(`Mark "${record.description}" for ${label} as completed?`)) {
      return;
    }
    this.completingId.set(record.id);
    this.maintenanceService.completeMaintenance(record.id, {}).subscribe({
      next: () => {
        this.completingId.set(null);
        this.alertService.showSuccess("Maintenance marked as completed");
        this.loadMaintenance();
        this.loadVans();
        this.loadStats();
      },
      error: (err: HttpErrorResponse) => {
        this.completingId.set(null);
        this.alertService.showError(
          "Failed to complete maintenance",
          apiErrorMessage(err, "Please try again")
        );
      },
    });
  }

  clearFilters(): void {
    this.searchTerm.set("");
    this.statusFilter.set("");
    this.conditionFilter.set("");
    this.depotFilter.set("");
  }

  exportData(): void {
    const rows = this.filteredVans();
    if (rows.length === 0) {
      this.alertService.showError("No vans to export");
      return;
    }
    downloadCsv<Van>(`vans-${today()}`, rows, [
      { header: "Van number", value: (v) => v.vanNumber },
      { header: "Registration", value: (v) => v.registration },
      { header: "Make", value: (v) => v.make },
      { header: "Model", value: (v) => v.model },
      { header: "Year", value: (v) => v.year },
      { header: "Depot", value: (v) => this.depotLabel(v) },
      { header: "Status", value: (v) => v.status },
      { header: "Condition", value: (v) => v.condition },
      { header: "MOT expiry", value: (v) => (v.motExpiry ? v.motExpiry.slice(0, 10) : "") },
      { header: "Contract", value: (v) => v.contract?.name ?? "" },
      { header: "Monthly rental (GBP)", value: (v) => this.toNumber(v.monthlyRental)?.toFixed(2) ?? "" },
      { header: "VIN", value: (v) => v.vin },
      { header: "Fuel type", value: (v) => v.fuelType },
      { header: "Mileage", value: (v) => v.mileage },
      { header: "Assigned driver", value: (v) => v.assignedDriver },
      { header: "Next service", value: (v) => (v.nextService ? v.nextService.slice(0, 10) : "") },
      { header: "Comments", value: (v) => v.comments },
    ]);
    this.alertService.showSuccess(`Exported ${rows.length} vans`);
  }

  // Display helpers
  depotLabel(van: Van): string {
    const depot = van.depotId ? this.depotById().get(van.depotId) : undefined;
    return depot ? `${depot.code} - ${depot.name}` : van.depot || "-";
  }

  private toNumber(value: number | string | null | undefined): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  /** Decimal values arrive as strings from the API */
  formatMoney(value: number | string | null | undefined): string {
    const n = this.toNumber(value);
    return n === null ? "" : `£${n.toFixed(2)}`;
  }

  private priceFor(part: PartPrice, make: VehicleMake): number | string | null {
    switch (make) {
      case "ford":
        return part.fordPrice;
      case "mercedes":
        return part.mercedesPrice;
      case "peugeot":
        return part.peugeotPrice;
    }
  }

  priceHeaderClasses(make: VehicleMake): string {
    const base = "px-6 py-3 text-left text-xs font-medium uppercase tracking-wider";
    return this.selectedVehicleMake() === make
      ? `${base} text-blue-700 bg-blue-50`
      : `${base} text-gray-500`;
  }

  priceCellClasses(make: VehicleMake): string {
    const base = "px-6 py-4 whitespace-nowrap text-sm";
    return this.selectedVehicleMake() === make
      ? `${base} text-gray-900 font-medium bg-blue-50`
      : `${base} text-gray-900`;
  }

  getTabClasses(tabKey: DashboardTab): string {
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
      case "BROKEN_DOWN":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "SUSPENDED":
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
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
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (expiryDate < now) {
      return "text-red-600 font-medium";
    } else if (expiryDate < thirtyDaysFromNow) {
      return "text-yellow-600 font-medium";
    }
    return "text-gray-900";
  }

  getVehicleMakeButtonClasses(make: MakeFilter): string {
    const baseClasses = "px-4 py-2 text-sm font-medium rounded-md transition-colors";
    return this.selectedVehicleMake() === make
      ? `${baseClasses} bg-blue-600 text-white`
      : `${baseClasses} bg-gray-100 text-gray-700 hover:bg-gray-200`;
  }

  getContractVehicleInfo(contract: Contract): string {
    if (!contract.vans || contract.vans.length === 0) {
      return "No vehicles assigned";
    }
    const firstVan = contract.vans[0];
    const make = `${firstVan.make} ${firstVan.model}`.trim();
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
}
