import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import { DriverScheduleService } from "./driver-schedule.service";
import { DriverService } from "./drivers.service";
import { AlertService } from "../../shared/services/alert.service";
import { LoadingComponent } from "../../shared/components/loading/loading.component";
import { downloadCsv, type CsvColumn } from "../../shared/utils/csv";
import type {
  DriverScheduleInfo,
  WeekSchedule,
  DaySchedule,
  ScheduleEntry,
  ScheduleStatus,
  ScheduleStatCard,
  CreateScheduleRequest,
  ScheduleFilters,
} from "./driver-schedule.model";

@Component({
  selector: "app-driver-schedule",
  standalone: true,
  imports: [CommonModule, FormsModule, LoadingComponent],

  template: `
    <div class="min-h-screen bg-gray-50">
      <!-- Header -->
      <div
        class="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40"
      >
        <div class="px-6 py-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-3xl font-bold text-gray-900">
                Driver Availability
              </h1>
              <p class="text-gray-600 mt-1">
                Manage daily work availability for all drivers
              </p>
            </div>
            <div class="flex items-center gap-3">
              <button
                (click)="exportSchedule()"
                class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
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
                  ></path>
                </svg>
                Export
              </button>
              <button
                (click)="saveAllChanges()"
                [disabled]="!hasUnsavedChanges() || isSaving()"
                class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                @if (isSaving()) {
                <app-loading
                  size="sm"
                  color="white"
                  [center]="false"
                  [showSpinner]="true"
                  message=""
                />
                <span class="ml-2">Saving...</span>
                } @else {
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
                    d="M5 13l4 4L19 7"
                  ></path>
                </svg>
                Save Changes @if (hasUnsavedChanges()) {
                <span
                  class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white bg-opacity-20"
                >
                  {{ pendingChanges().length }}
                </span>
                } }
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="p-6">
        <!-- Stats Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          @for (stat of stats(); track stat.title) {
          <div
            class="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium text-gray-600">
                  {{ stat.title }}
                </p>
                <p class="text-2xl font-bold text-gray-900 mt-1">
                  {{ stat.value }}
                </p>
                <p class="text-xs text-gray-500 mt-1">{{ stat.change }}</p>
              </div>
              <div [class]="'p-3 rounded-full ' + stat.bgColor">
                <svg
                  [class]="'w-5 h-5 ' + stat.color"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  @switch (stat.icon) { @case ('calendar') {
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                  } @case ('users') {
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m3 4.197a4 4 0 11-8 0 4 4 0 018 0z"
                  ></path>
                  } @case ('clock') {
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                  } @case ('trending-up') {
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  ></path>
                  } }
                </svg>
              </div>
            </div>
          </div>
          }
        </div>

        <!-- Week Navigation and Filters -->
        <div class="bg-white rounded-lg shadow mb-6">
          <div class="px-6 py-4 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4">
                <button
                  (click)="previousWeek()"
                  class="p-2 hover:bg-gray-100 rounded-md week-nav-button"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 19l-7-7 7-7"
                    ></path>
                  </svg>
                </button>
                <div class="text-lg font-semibold text-gray-900">
                  {{ formatWeekRange() }}
                </div>
                <button
                  (click)="nextWeek()"
                  class="p-2 hover:bg-gray-100 rounded-md week-nav-button"
                >
                  <svg
                    class="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5l7 7-7 7"
                    ></path>
                  </svg>
                </button>
                <button
                  (click)="goToCurrentWeek()"
                  class="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Today
                </button>

                <!-- Search Bar -->
                <div class="relative">
                  <div
                    class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                  >
                    <svg
                      class="h-4 w-4 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      ></path>
                    </svg>
                  </div>
                  <input
                    type="text"
                    [value]="searchQuery()"
                    (input)="updateSearchQuery($event)"
                    placeholder="Search drivers..."
                    class="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                  @if (searchQuery()) {
                  <button
                    (click)="clearSearch()"
                    class="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg
                      class="h-4 w-4 text-gray-400 hover:text-gray-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M6 18L18 6M6 6l12 12"
                      ></path>
                    </svg>
                  </button>
                  }
                </div>
              </div>
              <div class="flex items-center gap-3">
                <select
                  [value]="filters().status"
                  (change)="updateStatusFilter($event)"
                  class="block border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  @for (option of scheduleStatusOptions; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                  }
                </select>
                <select
                  [value]="filters().depot"
                  (change)="updateDepotFilter($event)"
                  class="block border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="all">All Depots</option>
                  <option value="north">North Depot</option>
                  <option value="south">South Depot</option>
                  <option value="central">Central Depot</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading State -->
        @if (isLoading()) {
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <div class="p-12">
            <app-loading
              size="lg"
              message="Loading driver schedules..."
              color="blue"
              [center]="true"
            />
          </div>
        </div>
        } @else {
        <!-- Schedule Grid -->
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <div class="flex">
            <!-- Fixed Driver Column -->
            <div class="w-64 flex-shrink-0 border-r border-gray-200">
              <!-- Driver Column Header -->
              <div
                class="px-6 py-4 bg-gray-50 border-b border-gray-200 h-20 flex items-center"
              >
                <h3 class="text-sm font-semibold text-gray-900">
                  Drivers ({{ filteredDrivers().length }})
                </h3>
              </div>
              <!-- Driver List -->
              <div>
                @for (driver of filteredDrivers(); track driver.id) {
                <div
                  class="px-6 hover:bg-gray-50 transition-colors h-20 flex items-center border-b border-gray-200"
                >
                  <div class="flex items-center space-x-3">
                    <div
                      [class]="
                        'w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm driver-avatar ' +
                        getDriverAvatarColor(driver.id)
                      "
                    >
                      {{ getInitials(driver.name) }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-gray-900 break-normal">
                        {{ driver.name }}
                      </p>
                      <p class="text-xs text-gray-500 uppercase tracking-wide">
                        {{ driver.status }}
                      </p>
                    </div>
                  </div>
                </div>
                }
              </div>
            </div>

            <!-- Scrollable Weeks Section -->
            <div class="flex-1 overflow-x-auto">
              <!-- Weeks Header -->
              <div
                class="flex bg-gray-50 border-b border-gray-200 min-w-max h-20"
              >
                <!-- Week 1 (Current Week) -->
                <div class="flex border-r-2 border-blue-300 bg-blue-50 h-full">
                  @for (day of currentWeek().days; track day.date) {
                  <div
                    class="min-w-36 px-4 text-center border-r border-gray-200 last:border-r-0 flex flex-col justify-center h-full"
                  >
                    <div
                      class="text-xs font-medium text-blue-600 uppercase tracking-wide font-semibold"
                    >
                      {{ day.dayName }}
                    </div>
                    <div
                      [class]="
                        'text-lg font-bold mt-1 ' +
                        (day.isToday ? 'text-blue-600' : 'text-gray-900')
                      "
                    >
                      {{ day.dayNumber }}
                    </div>
                  </div>
                  }
                </div>
                <!-- Week 2 (Next Week) -->
                <div
                  class="flex border-r-2 border-green-300 bg-green-50 h-full"
                >
                  @for (day of currentWeek().days; track day.date + '-week2';
                  let i = $index) {
                  <div
                    class="min-w-36 px-4 text-center border-r border-gray-200 last:border-r-0 flex flex-col justify-center h-full"
                  >
                    <div
                      class="text-xs font-medium text-green-600 uppercase tracking-wide font-semibold"
                    >
                      {{ day.dayName }}
                    </div>
                    <div class="text-lg font-bold mt-1 text-gray-900">
                      {{ getNextWeekDayNumber(day.date, 7) }}
                    </div>
                  </div>
                  }
                </div>
                <!-- Week 3 (Week After) -->
                <div class="flex bg-purple-50 h-full">
                  @for (day of currentWeek().days; track day.date + '-week3';
                  let i = $index) {
                  <div
                    class="min-w-36 px-4 text-center border-r border-gray-200 last:border-r-0 flex flex-col justify-center h-full"
                  >
                    <div
                      class="text-xs font-medium text-purple-600 uppercase tracking-wide font-semibold"
                    >
                      {{ day.dayName }}
                    </div>
                    <div class="text-lg font-bold mt-1 text-gray-900">
                      {{ getNextWeekDayNumber(day.date, 14) }}
                    </div>
                  </div>
                  }
                </div>
              </div>

              <!-- Schedule Rows -->
              <div class="min-w-max">
                @for (driver of filteredDrivers(); track driver.id) {
                <div
                  class="flex hover:bg-gray-50 transition-colors h-20 border-b border-gray-200"
                >
                  <!-- Week 1 (Current Week) -->
                  <div
                    class="flex border-r-2 border-blue-300 bg-blue-50/30 h-full"
                  >
                    @for (day of currentWeek().days; track day.date) {
                    <div
                      class="min-w-36 px-4 border-r border-gray-100 last:border-r-0 flex items-center justify-center h-full"
                    >
                      @if (getScheduleForDriverAndDate(driver.id, day.date); as
                      schedule) {
                      <button
                        (click)="editSchedule(driver.id, day.date, schedule)"
                        [class]="
                          'w-full px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-all hover:shadow-sm schedule-button ' +
                          getScheduleStatusClass(schedule.status)
                        "
                      >
                        {{ getScheduleDisplayText(schedule) }}
                      </button>
                      } @else {
                      <div class="relative">
                        <button
                          (click)="toggleDropdown(driver.id, day.date)"
                          [attr.data-dropdown-id]="driver.id + '-' + day.date"
                          class="w-full px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-all hover:shadow-sm bg-gray-50 text-gray-600 hover:bg-blue-50 hover:text-blue-600 border border-dashed border-gray-300 hover:border-blue-400 add-schedule-btn"
                        >
                          + Add
                          <svg
                            class="ml-1 w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 9l-7 7-7-7"
                            ></path>
                          </svg>
                        </button>

                        @if (showDropdown() === driver.id + '-' + day.date) {
                        <div
                          class="fixed bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-36"
                          [style.left.px]="
                            getDropdownPosition(driver.id + '-' + day.date).left
                          "
                          [style.top.px]="
                            getDropdownPosition(driver.id + '-' + day.date).top
                          "
                        >
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                day.date,
                                'FULL_ROUTE'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-blue-50 hover:text-blue-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Full Route</span>
                            <span class="text-gray-400 text-xs">F</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(driver.id, day.date, 'HOLIDAY')
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-green-50 hover:text-green-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Holiday</span>
                            <span class="text-gray-400 text-xs">H</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                day.date,
                                'RIDE_ALONG'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-purple-50 hover:text-purple-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Ride Along</span>
                            <span class="text-gray-400 text-xs">R</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                day.date,
                                'TRAINING_DAY'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-yellow-50 hover:text-yellow-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Training Day</span>
                            <span class="text-gray-400 text-xs">T</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(driver.id, day.date, 'SAME_DAY')
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Same Day</span>
                            <span class="text-gray-400 text-xs">S</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                day.date,
                                'NURSERY_ROUTE'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-pink-50 hover:text-pink-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Nursery Route</span>
                            <span class="text-gray-400 text-xs">N</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(driver.id, day.date, 'OFF')
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 hover:text-gray-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Off</span>
                            <span class="text-gray-400 text-xs">O</span>
                          </button>
                          <button
                            (click)="addSchedule(driver.id, day.date)"
                            class="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 hover:text-gray-600 transition-colors font-medium flex justify-between items-center"
                          >
                            <span>Custom...</span>
                            <span class="text-gray-400 text-xs">C</span>
                          </button>
                        </div>
                        }
                      </div>
                      }
                    </div>
                    }
                  </div>
                  <!-- Week 2 (Next Week) -->
                  <div
                    class="flex border-r-2 border-green-300 bg-green-50/30 h-full"
                  >
                    @for (day of currentWeek().days; track day.date + '-week2')
                    {
                    <div
                      class="min-w-36 px-4 border-r border-gray-200 last:border-r-0 flex items-center justify-center h-full"
                    >
                      @if (getScheduleForDriverAndDate(driver.id,
                      getNextWeekDate(day.date, 7)); as schedule) {
                      <button
                        (click)="
                          editSchedule(
                            driver.id,
                            getNextWeekDate(day.date, 7),
                            schedule
                          )
                        "
                        [class]="
                          'w-full px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-all hover:shadow-sm schedule-button ' +
                          getScheduleStatusClass(schedule.status)
                        "
                      >
                        {{ getScheduleDisplayText(schedule) }}
                      </button>
                      } @else {
                      <div class="relative">
                        <button
                          (click)="
                            toggleDropdown(
                              driver.id,
                              getNextWeekDate(day.date, 7)
                            )
                          "
                          [attr.data-dropdown-id]="
                            driver.id + '-' + getNextWeekDate(day.date, 7)
                          "
                          class="w-full px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-all hover:shadow-sm bg-gray-50 text-gray-600 hover:bg-green-50 hover:text-green-600 border border-dashed border-green-300 hover:border-green-400 add-schedule-btn"
                        >
                          + Add
                          <svg
                            class="ml-1 w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 9l-7 7-7-7"
                            ></path>
                          </svg>
                        </button>

                        @if (showDropdown() === driver.id + '-' +
                        getNextWeekDate(day.date, 7)) {
                        <div
                          class="fixed bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-36"
                          [style.left.px]="
                            getDropdownPosition(
                              driver.id + '-' + getNextWeekDate(day.date, 7)
                            ).left
                          "
                          [style.top.px]="
                            getDropdownPosition(
                              driver.id + '-' + getNextWeekDate(day.date, 7)
                            ).top
                          "
                        >
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 7),
                                'FULL_ROUTE'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-blue-50 hover:text-blue-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Full Route</span>
                            <span class="text-gray-400 text-xs">F</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 7),
                                'HOLIDAY'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-green-50 hover:text-green-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Holiday</span>
                            <span class="text-gray-400 text-xs">H</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 7),
                                'RIDE_ALONG'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-purple-50 hover:text-purple-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Ride Along</span>
                            <span class="text-gray-400 text-xs">R</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 7),
                                'TRAINING_DAY'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-yellow-50 hover:text-yellow-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Training Day</span>
                            <span class="text-gray-400 text-xs">T</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 7),
                                'SAME_DAY'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Same Day</span>
                            <span class="text-gray-400 text-xs">S</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 7),
                                'NURSERY_ROUTE'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-pink-50 hover:text-pink-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Nursery Route</span>
                            <span class="text-gray-400 text-xs">N</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 7),
                                'OFF'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 hover:text-gray-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Off</span>
                            <span class="text-gray-400 text-xs">O</span>
                          </button>
                          <button
                            (click)="
                              addSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 7)
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 hover:text-gray-600 transition-colors font-medium flex justify-between items-center"
                          >
                            <span>Custom...</span>
                            <span class="text-gray-400 text-xs">C</span>
                          </button>
                        </div>
                        }
                      </div>
                      }
                    </div>
                    }
                  </div>
                  <!-- Week 3 (Week After) -->
                  <div class="flex bg-purple-50/30 h-full">
                    @for (day of currentWeek().days; track day.date + '-week3')
                    {
                    <div
                      class="min-w-36 px-4 border-r border-gray-200 last:border-r-0 flex items-center justify-center h-full"
                    >
                      @if (getScheduleForDriverAndDate(driver.id,
                      getNextWeekDate(day.date, 14)); as schedule) {
                      <button
                        (click)="
                          editSchedule(
                            driver.id,
                            getNextWeekDate(day.date, 14),
                            schedule
                          )
                        "
                        [class]="
                          'w-full px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-all hover:shadow-sm schedule-button ' +
                          getScheduleStatusClass(schedule.status)
                        "
                      >
                        {{ getScheduleDisplayText(schedule) }}
                      </button>
                      } @else {
                      <div class="relative">
                        <button
                          (click)="
                            toggleDropdown(
                              driver.id,
                              getNextWeekDate(day.date, 14)
                            )
                          "
                          [attr.data-dropdown-id]="
                            driver.id + '-' + getNextWeekDate(day.date, 14)
                          "
                          class="w-full px-3 py-2 rounded-md text-xs font-medium cursor-pointer transition-all hover:shadow-sm bg-gray-50 text-gray-600 hover:bg-purple-50 hover:text-purple-600 border border-dashed border-purple-300 hover:border-purple-400 add-schedule-btn"
                        >
                          + Add
                          <svg
                            class="ml-1 w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M19 9l-7 7-7-7"
                            ></path>
                          </svg>
                        </button>

                        @if (showDropdown() === driver.id + '-' +
                        getNextWeekDate(day.date, 14)) {
                        <div
                          class="fixed bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-36"
                          [style.left.px]="
                            getDropdownPosition(
                              driver.id + '-' + getNextWeekDate(day.date, 14)
                            ).left
                          "
                          [style.top.px]="
                            getDropdownPosition(
                              driver.id + '-' + getNextWeekDate(day.date, 14)
                            ).top
                          "
                        >
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 14),
                                'FULL_ROUTE'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-blue-50 hover:text-blue-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Full Route</span>
                            <span class="text-gray-400 text-xs">F</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 14),
                                'HOLIDAY'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-green-50 hover:text-green-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Holiday</span>
                            <span class="text-gray-400 text-xs">H</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 14),
                                'RIDE_ALONG'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-purple-50 hover:text-purple-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Ride Along</span>
                            <span class="text-gray-400 text-xs">R</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 14),
                                'TRAINING_DAY'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-yellow-50 hover:text-yellow-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Training Day</span>
                            <span class="text-gray-400 text-xs">T</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 14),
                                'SAME_DAY'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Same Day</span>
                            <span class="text-gray-400 text-xs">S</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 14),
                                'NURSERY_ROUTE'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-pink-50 hover:text-pink-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Nursery Route</span>
                            <span class="text-gray-400 text-xs">N</span>
                          </button>
                          <button
                            (click)="
                              quickAddSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 14),
                                'OFF'
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 hover:text-gray-600 transition-colors border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>Off</span>
                            <span class="text-gray-400 text-xs">O</span>
                          </button>
                          <button
                            (click)="
                              addSchedule(
                                driver.id,
                                getNextWeekDate(day.date, 14)
                              )
                            "
                            class="w-full px-3 py-2 text-xs text-left hover:bg-gray-50 hover:text-gray-600 transition-colors font-medium flex justify-between items-center"
                          >
                            <span>Custom...</span>
                            <span class="text-gray-400 text-xs">C</span>
                          </button>
                        </div>
                        }
                      </div>
                      }
                    </div>
                    }
                  </div>
                </div>
                }
              </div>
            </div>
          </div>
        </div>
        }
      </div>
    </div>

    <!-- Schedule Modal -->
    @if (showScheduleModal()) {
    <div
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 modal-backdrop"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white modal-content"
      >
        <div class="mt-3">
          <h3 class="text-lg font-medium text-gray-900 mb-4">
            {{ modalMode() === "edit" ? "Edit" : "Add" }} Schedule
          </h3>
          <div class="space-y-4">
            <div>
              <h4 class="block text-sm font-medium text-gray-700 mb-1">
                Driver
              </h4>
              <p class="text-sm text-gray-900">
                {{ getDriverName(selectedDriverId()) }}
              </p>
            </div>
            <div>
              <h4 class="block text-sm font-medium text-gray-700 mb-1">Date</h4>
              <p class="text-sm text-gray-900">
                {{ formatDate(selectedDate()) }}
              </p>
            </div>
            <div>
              <label
                for="schedule-status"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Status</label
              >
              <select
                id="schedule-status"
                [value]="scheduleForm().status"
                (change)="updateScheduleForm('status', $event)"
                class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              >
                @for (option of scheduleStatusOptions; track option.value) { @if
                (option.value !== 'all') {
                <option [value]="option.value">{{ option.label }}</option>
                } }
              </select>
            </div>
            @if (scheduleForm().status === 'TRAINING_DAY' ||
            scheduleForm().status === 'RIDE_ALONG') {
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label
                  for="schedule-start-time"
                  class="block text-sm font-medium text-gray-700 mb-1"
                  >Start Time</label
                >
                <input
                  id="schedule-start-time"
                  type="time"
                  [value]="scheduleForm().startTime || ''"
                  (input)="updateScheduleForm('startTime', $event)"
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label
                  for="schedule-end-time"
                  class="block text-sm font-medium text-gray-700 mb-1"
                  >End Time</label
                >
                <input
                  id="schedule-end-time"
                  type="time"
                  [value]="scheduleForm().endTime || ''"
                  (input)="updateScheduleForm('endTime', $event)"
                  class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
            </div>
            }
            <div>
              <label
                for="schedule-notes"
                class="block text-sm font-medium text-gray-700 mb-1"
                >Notes (Optional)</label
              >
              <textarea
                id="schedule-notes"
                [value]="scheduleForm().notes || ''"
                (input)="updateScheduleForm('notes', $event)"
                rows="3"
                class="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Add any additional notes..."
              ></textarea>
            </div>
          </div>
          <div class="flex justify-between pt-4">
            <div>
              @if (modalMode() === 'edit') {
              <button
                (click)="deleteSchedule()"
                class="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700"
              >
                Delete
              </button>
              }
            </div>
            <div class="flex gap-2">
              <button
                (click)="closeModal()"
                class="px-4 py-2 bg-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                (click)="saveSchedule()"
                class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
              >
                {{ modalMode() === "edit" ? "Update" : "Create" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    }
  `,
  styleUrls: ["./driver-schedule.component.scss"],
})
export class DriverScheduleComponent implements OnInit, OnDestroy {
  private readonly scheduleService = inject(DriverScheduleService);
  private readonly driverService = inject(DriverService);
  private readonly router = inject(Router);
  private readonly alertService = inject(AlertService);
  private readonly destroy$ = new Subject<void>();
  private loadingRequestId = signal<string | null>(null);

  // Signals for reactive state management
  drivers = signal<DriverScheduleInfo[]>([]);
  currentWeek = signal<WeekSchedule>({
    weekStart: "",
    weekEnd: "",
    days: [],
  });
  // Multiple weeks for horizontal scrolling (current week + 2 weeks ahead)
  allWeeks = signal<WeekSchedule[]>([]);
  stats = signal<ScheduleStatCard[]>([]);
  filters = signal<ScheduleFilters>({
    week: this.getCurrentWeekStart(),
    status: "all",
    depot: "all",
  });

  // Modal state
  showScheduleModal = signal(false);
  modalMode = signal<"add" | "edit">("add");
  selectedDriverId = signal("");
  selectedDate = signal("");
  scheduleForm = signal<Partial<CreateScheduleRequest>>({
    status: "FULL_ROUTE",
  });

  // Pending changes for batch save
  pendingChanges = signal<CreateScheduleRequest[]>([]);

  // Dropdown state
  showDropdown = signal<string>("");
  dropdownPositions = signal<Map<string, { left: number; top: number }>>(
    new Map()
  );

  // Search state
  searchQuery = signal<string>("");

  // Loading states
  isLoading = signal(false);
  isSaving = signal(false);

  // Schedule status options
  readonly scheduleStatusOptions = [
    { value: "all", label: "All Status" },
    { value: "FULL_ROUTE", label: "Full Route" },
    { value: "OFF", label: "Off" },
    { value: "HOLIDAY", label: "Holiday" },
    { value: "RIDE_ALONG", label: "Ride Along" },
    { value: "TRAINING_DAY", label: "Training Day" },
    { value: "SAME_DAY", label: "Same Day" },
    { value: "NURSERY_ROUTE", label: "Nursery Route" },
  ] as const;

  // Computed values
  filteredDrivers = computed(() => {
    const drivers = this.drivers();
    const statusFilter = this.filters().status;
    const depotFilter = this.filters().depot;
    const search = this.searchQuery().toLowerCase().trim();

    return drivers.filter((driver) => {
      const matchesStatus =
        statusFilter === "all" ||
        Object.values(driver.schedules).some(
          (schedule) => schedule.status === statusFilter
        );
      const matchesDepot =
        depotFilter === "all" ||
        driver.name.toLowerCase().includes(depotFilter);
      const matchesSearch =
        search === "" || driver.name.toLowerCase().includes(search);

      return matchesStatus && matchesDepot && matchesSearch;
    });
  });

  hasUnsavedChanges = computed(() => this.pendingChanges().length > 0);

  constructor() {
    // Initialize with empty data
    this.drivers.set([]);
    this.allWeeks.set([]);
    this.stats.set([]);

    // Watch for week changes but only trigger if not already loading
    effect(() => {
      const weekStart = this.filters().week;
      const currentWeek = this.currentWeek().weekStart;

      // Only load if week is different and we're not already loading
      if (weekStart && weekStart !== currentWeek && !this.isLoading()) {
        this.loadWeekData(weekStart);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (event) => {
      const target = event.target as HTMLElement;
      // Check if click is outside dropdown button and dropdown content
      if (
        !target.closest("[data-dropdown-id]") &&
        !target.closest(".fixed.bg-white")
      ) {
        this.showDropdown.set("");
        // Clear all cached positions when closing via outside click
        this.dropdownPositions.set(new Map());
      }
    });

    // Add keyboard shortcuts for dropdown
    document.addEventListener("keydown", (event) => {
      const currentDropdown = this.showDropdown();

      if (currentDropdown) {
        // Split by the last hyphen to separate driverId from date
        // Date format is YYYY-MM-DD, so we need to find where the date starts
        // The date pattern is: YYYY-MM-DD (10 characters)
        // So we look for the last 10 characters that match this pattern
        const dateMatch = currentDropdown.match(/-(\d{4}-\d{2}-\d{2})$/);

        if (dateMatch) {
          const date = dateMatch[1]; // The captured group (YYYY-MM-DD)
          const driverId = currentDropdown.substring(
            0,
            currentDropdown.lastIndexOf("-" + date)
          );


          if (driverId && date) {
            event.preventDefault();

            switch (event.key.toLowerCase()) {
              case "f":
                this.quickAddSchedule(driverId, date, "FULL_ROUTE");
                break;
              case "h":
                this.quickAddSchedule(driverId, date, "HOLIDAY");
                break;
              case "r":
                this.quickAddSchedule(driverId, date, "RIDE_ALONG");
                break;
              case "t":
                this.quickAddSchedule(driverId, date, "TRAINING_DAY");
                break;
              case "s":
                this.quickAddSchedule(driverId, date, "SAME_DAY");
                break;
              case "n":
                this.quickAddSchedule(driverId, date, "NURSERY_ROUTE");
                break;
              case "o":
                this.quickAddSchedule(driverId, date, "OFF");
                break;
              case "c":
                this.addSchedule(driverId, date);
                break;
              case "escape":
                this.showDropdown.set("");
                // Clear all cached positions when closing via ESC
                this.dropdownPositions.set(new Map());
                break;
            }
          }
        }
      }
    });
  }

  ngOnInit(): void {
    // Load initial data once, safely
    const initialWeek = this.getCurrentWeekStart();
    if (initialWeek) {
      this.loadWeekData(initialWeek);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadWeekData(weekStart: string): void {
    // Prevent multiple requests for the same week
    if (this.isLoading() || this.loadingRequestId() === weekStart) {
      return;
    }

    this.loadingRequestId.set(weekStart);
    this.isLoading.set(true);

    // Set basic week structure immediately
    this.currentWeek.set({
      weekStart: weekStart,
      weekEnd: this.getWeekEnd(weekStart),
      days: this.generateEmptyWeekDays(weekStart),
    });

    // Generate 3 weeks: current week + 2 weeks ahead
    const weekStarts = this.getMultipleWeekStarts(weekStart, 3);

    // Load real data with proper error handling
    Promise.all([
      ...weekStarts.map((week) =>
        this.scheduleService
          .getWeekSchedule(week)
          .toPromise()
          .catch((error) => {
            console.warn(
              `Failed to load schedule for week ${week}:`,
              error.message
            );
            return null;
          })
      ),
      ...weekStarts.map((week) =>
        this.scheduleService
          .getDriversWithSchedules(week)
          .toPromise()
          .catch((error) => {
            console.warn(
              `Failed to load drivers for week ${week}:`,
              error.message
            );
            return null;
          })
      ),
      this.scheduleService
        .getScheduleStats(weekStart)
        .toPromise()
        .catch((error) => {
          console.warn(
            `Failed to load stats for week ${weekStart}:`,
            error.message
          );
          return null;
        }),
    ])
      .then((results) => {
        // Check if this request is still current
        if (this.loadingRequestId() !== weekStart) {
          console.debug("Request superseded by newer request");
          return;
        }

        const weekSchedules = results
          .slice(0, 3)
          .filter((r) => r !== null) as WeekSchedule[];
        const driversData = results
          .slice(3, 6)
          .filter((r) => r !== null) as DriverScheduleInfo[][];
        const stats = results[6] as ScheduleStatCard[];


        // Update signals with loaded data - but don't trigger new requests
        if (weekSchedules?.[0]) {
          this.currentWeek.set(weekSchedules[0]);
        }
        if (weekSchedules?.length > 0) {
          this.allWeeks.set(weekSchedules);
        }

        if (driversData?.length > 0) {
          const mergedDrivers = this.mergeDriversData(driversData);
          this.drivers.set(mergedDrivers);
        }

        if (stats) {
          this.stats.set(stats);
        }
      })
      .catch((error) => {
        // Global catch for any unhandled errors
        console.warn(
          `Failed to load week data for ${weekStart}:`,
          error.message
        );
        // Don't update signals here to prevent loops - keep the basic structure we set earlier
      })
      .finally(() => {
        // Only clear loading if this is still the current request
        if (this.loadingRequestId() === weekStart) {
          this.loadingRequestId.set(null);
          this.isLoading.set(false);
        }
      });
  }

  private generateEmptyWeekDays(weekStart: string): DaySchedule[] {
    const days: DaySchedule[] = [];
    const startDate = new Date(weekStart + "T00:00:00");
    const today = this.toDateKey(new Date());

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      const dateStr = this.toDateKey(currentDate);

      days.push({
        date: dateStr,
        dayName: currentDate.toLocaleDateString("en-US", { weekday: "short" }),
        dayNumber: currentDate.getDate(),
        isToday: dateStr === today,
        schedules: [],
      });
    }

    return days;
  }

  private getWeekEnd(weekStart: string): string {
    const startDate = new Date(weekStart + "T00:00:00");
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    return this.toDateKey(endDate);
  }

  private mergeDriversData(
    driversDataArray: DriverScheduleInfo[][]
  ): DriverScheduleInfo[] {
    const driversMap = new Map<string, DriverScheduleInfo>();

    // Process each week's driver data
    driversDataArray.forEach((weekDrivers) => {
      if (weekDrivers) {
        weekDrivers.forEach((driver) => {
          if (driversMap.has(driver.id)) {
            // Merge schedules for existing driver
            const existingDriver = driversMap.get(driver.id)!;
            driversMap.set(driver.id, {
              ...existingDriver,
              schedules: {
                ...existingDriver.schedules,
                ...driver.schedules,
              },
            });
          } else {
            // Add new driver
            driversMap.set(driver.id, { ...driver });
          }
        });
      }
    });

    return Array.from(driversMap.values());
  }

  /**
   * Formats a Date as "YYYY-MM-DD" using its LOCAL calendar day.
   *
   * Bug fixed here: this file previously did
   * `date.toISOString().split("T")[0]` to get a date key, but `toISOString()`
   * converts to UTC first. On a machine whose local time is ahead of UTC
   * (e.g. the UK in BST, UTC+1) local midnight becomes 23:00 the PREVIOUS
   * day in UTC, so every date key came out one day early. That made
   * `getCurrentWeekStart()`/`getMultipleWeekStarts()` disagree with the
   * server's response for the same week, so the "did the loaded week
   * change?" effect never converged and kept re-requesting the schedule
   * forever. Formatting from local Y/M/D keeps this file's own week-start
   * math and the value it compares against consistent.
   */
  private toDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private getCurrentWeekStart(): string {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    // Calculate days to subtract to get to Sunday (week start)
    // If today is Sunday (0), use today (subtract 0)
    // If today is Monday (1), go back 1 day to Sunday
    // If today is Saturday (6), go back 6 days to Sunday
    const daysToSubtract = dayOfWeek;

    // Create a new date object to avoid mutating the original
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - daysToSubtract);

    return this.toDateKey(weekStart);
  }

  private getMultipleWeekStarts(startWeek: string, count: number): string[] {
    const weeks: string[] = [];
    const [year, month, day] = startWeek.split("-").map(Number);
    const startDate = new Date(year, month - 1, day);

    for (let i = 0; i < count; i++) {
      const weekDate = new Date(startDate);
      weekDate.setDate(startDate.getDate() + i * 7);
      weeks.push(this.toDateKey(weekDate));
    }

    return weeks;
  }

  formatWeekRange(): string {
    const week = this.currentWeek();
    if (!week.weekStart || !week.weekEnd) return "";

    const start = new Date(week.weekStart);
    const end = new Date(week.weekEnd);

    return `${this.formatDate(start.toISOString())} - ${this.formatDate(
      end.toISOString()
    )}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  getDriverAvatarColor(driverId: string): string {
    const colors = [
      "bg-blue-500",
      "bg-green-500",
      "bg-purple-500",
      "bg-red-500",
      "bg-yellow-500",
      "bg-indigo-500",
      "bg-pink-500",
      "bg-gray-500",
    ];
    // Use a simple hash of the driver ID to get consistent colors
    const hash = driverId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  }

  getScheduleForDriverAndDate(
    driverId: string,
    date: string
  ): ScheduleEntry | null {
    const driver = this.drivers().find((d) => d.id === driverId);
    return driver?.schedules[date] || null;
  }

  getScheduleStatusClass(status: ScheduleStatus): string {
    const classes = {
      FULL_ROUTE: "bg-blue-100 text-blue-800 border border-blue-200",
      TRAINING_DAY: "bg-green-100 text-green-800 border border-green-200",
      RIDE_ALONG: "bg-purple-100 text-purple-800 border border-purple-200",
      SAME_DAY: "bg-yellow-100 text-yellow-800 border border-yellow-200",
      NURSERY_ROUTE: "bg-pink-100 text-pink-800 border border-pink-200",
      HOLIDAY: "bg-red-100 text-red-800 border border-red-200",
      OFF: "bg-gray-100 text-gray-800 border border-gray-200",
    };
    return classes[status] || classes["OFF"];
  }

  getScheduleDisplayText(schedule: ScheduleEntry): string {
    switch (schedule.status) {
      case "FULL_ROUTE":
        return "Full Route";
      case "TRAINING_DAY":
        return "Training Day";
      case "RIDE_ALONG":
        return schedule.startTime && schedule.endTime
          ? `${schedule.startTime}-${schedule.endTime}`
          : "Ride Along";
      case "SAME_DAY":
        return "Same Day";
      case "NURSERY_ROUTE":
        return "Nursery Route";
      case "HOLIDAY":
        return "Holiday";
      case "OFF":
        return "Off";
      default:
        return schedule.status;
    }
  }

  getDriverName(driverId: string): string {
    return this.drivers().find((d) => d.id === driverId)?.name || "";
  }

  getNextWeekDayNumber(dateString: string, daysToAdd: number): number {
    const date = new Date(dateString + "T00:00:00");
    date.setDate(date.getDate() + daysToAdd);
    return date.getDate();
  }

  getNextWeekDate(dateString: string, daysToAdd: number): string {
    const date = new Date(dateString + "T00:00:00");
    date.setDate(date.getDate() + daysToAdd);
    return this.toDateKey(date);
  }

  // Navigation methods
  previousWeek(): void {
    // Parse as local midnight (not bare "YYYY-MM-DD", which JS treats as UTC)
    // to stay consistent with toDateKey()/getCurrentWeekStart() above.
    const currentStart = new Date(this.filters().week + "T00:00:00");
    currentStart.setDate(currentStart.getDate() - 7);
    this.updateWeekFilter(this.toDateKey(currentStart));
  }

  nextWeek(): void {
    const currentStart = new Date(this.filters().week + "T00:00:00");
    currentStart.setDate(currentStart.getDate() + 7);
    this.updateWeekFilter(this.toDateKey(currentStart));
  }

  goToCurrentWeek(): void {
    this.updateWeekFilter(this.getCurrentWeekStart());
  }

  // Filter methods
  updateWeekFilter(week: string): void {
    this.filters.update((current) => ({ ...current, week }));
  }

  updateStatusFilter(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.filters.update((current) => ({
      ...current,
      status: target.value as ScheduleStatus | "all",
    }));
  }

  updateDepotFilter(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.filters.update((current) => ({ ...current, depot: target.value }));
  }

  updateSearchQuery(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  clearSearch(): void {
    this.searchQuery.set("");
  }

  // Schedule management methods
  addSchedule(driverId: string, date: string): void {
    this.selectedDriverId.set(driverId);
    this.selectedDate.set(date);
    this.modalMode.set("add");
    this.scheduleForm.set({
      driverId,
      date,
      status: "FULL_ROUTE",
    });
    this.showScheduleModal.set(true);
  }

  editSchedule(driverId: string, date: string, schedule: ScheduleEntry): void {
    this.selectedDriverId.set(driverId);
    this.selectedDate.set(date);
    this.modalMode.set("edit");
    this.scheduleForm.set({
      driverId: schedule.driverId,
      date: schedule.date,
      status: schedule.status,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      notes: schedule.notes,
    });
    this.showScheduleModal.set(true);
  }

  updateScheduleForm(field: string, event: Event): void {
    const target = event.target as
      | HTMLInputElement
      | HTMLSelectElement
      | HTMLTextAreaElement;
    this.scheduleForm.update((current) => ({
      ...current,
      [field]: target.value,
    }));
  }

  saveSchedule(): void {
    const form = this.scheduleForm();
    if (!form.driverId || !form.date || !form.status) return;

    const request: CreateScheduleRequest = {
      driverId: form.driverId,
      date: form.date,
      status: form.status,
      startTime: form.startTime,
      endTime: form.endTime,
      notes: form.notes,
    };

    // Add to pending changes for batch save
    this.pendingChanges.update((current) => {
      const filtered = current.filter(
        (c) => !(c.driverId === request.driverId && c.date === request.date)
      );
      return [...filtered, request];
    });

    // Update local state immediately for better UX
    this.updateLocalSchedule(request);
    this.closeModal();

    // Show success alert for individual schedule save
    this.alertService.showSuccess(
      "Schedule Added",
      "Schedule has been added to pending changes. Click 'Save Changes' to confirm."
    );
  }

  deleteSchedule(): void {
    const driverId = this.selectedDriverId();
    const date = this.selectedDate();

    if (!driverId || !date) return;

    // Remove from pending changes
    this.pendingChanges.update((current) =>
      current.filter((c) => !(c.driverId === driverId && c.date === date))
    );

    // Update local state
    this.drivers.update((current) =>
      current.map((driver) => {
        if (driver.id === driverId) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [date]: removed, ...remainingSchedules } = driver.schedules;
          return { ...driver, schedules: remainingSchedules };
        }
        return driver;
      })
    );

    this.closeModal();
  }

  private updateLocalSchedule(request: CreateScheduleRequest): void {
    this.drivers.update((current) =>
      current.map((driver) => {
        if (driver.id === request.driverId) {
          return {
            ...driver,
            schedules: {
              ...driver.schedules,
              [request.date]: {
                driverId: request.driverId,
                date: request.date,
                status: request.status,
                startTime: request.startTime,
                endTime: request.endTime,
                notes: request.notes,
              },
            },
          };
        }
        return driver;
      })
    );
  }

  closeModal(): void {
    this.showScheduleModal.set(false);
    this.scheduleForm.set({ status: "FULL_ROUTE" });
    this.selectedDriverId.set("");
    this.selectedDate.set("");
  }

  saveAllChanges(): void {
    const changes = this.pendingChanges();

    if (changes.length === 0) return;

    this.isSaving.set(true);

    this.scheduleService.bulkUpdateSchedule(changes).subscribe({
      next: (response) => {
        this.pendingChanges.set([]);

        // Show success alert
        this.alertService.showSuccess(
          "Successfully uploaded",
          `${changes.length} schedule${
            changes.length === 1 ? "" : "s"
          } saved successfully`
        );
      },
      error: (error) => {
        console.error("Error saving changes:", error);
        console.error("Full error object:", error);
        console.error("Error response:", error.error);

        // Show error alert
        this.alertService.showError(
          "Save Failed",
          "Failed to save changes. Please try again or contact support if the problem persists."
        );
      },
      complete: () => {
        this.isSaving.set(false);
      },
    });
  }

  /** CSV of the week currently displayed (drivers after search/filters) */
  exportSchedule(): void {
    const week = this.currentWeek();
    const drivers = this.filteredDrivers();
    if (week.days.length === 0 || drivers.length === 0) {
      this.alertService.showWarning("Nothing to export", "No drivers in the displayed week.");
      return;
    }
    const columns: CsvColumn<DriverScheduleInfo>[] = [
      { header: "Driver", value: (driver) => driver.name },
      { header: "Driver status", value: (driver) => driver.status },
      ...week.days.map(
        (day): CsvColumn<DriverScheduleInfo> => ({
          header: `${day.dayName} ${day.date}`,
          value: (driver) => {
            const schedule = driver.schedules[day.date];
            if (!schedule) {
              return "";
            }
            const times =
              schedule.startTime && schedule.endTime ? ` ${schedule.startTime}-${schedule.endTime}` : "";
            return `${this.getScheduleDisplayText(schedule)}${schedule.status === "RIDE_ALONG" ? "" : times}`;
          },
        })
      ),
    ];
    downloadCsv(`driver-availability-${week.weekStart}`, drivers, columns);
    if (this.hasUnsavedChanges()) {
      this.alertService.showInfo("Exported with unsaved changes", "The file includes changes not yet saved.");
    }
  }

  toggleDropdown(driverId: string, date: string): void {
    const dropdownId = driverId + "-" + date;

    if (this.showDropdown() === dropdownId) {
      this.showDropdown.set("");
      // Clear cached position when closing
      const positions = this.dropdownPositions();
      positions.delete(dropdownId);
      this.dropdownPositions.set(new Map(positions));
    } else {
      // Calculate and cache position when opening
      const position = this.calculateDropdownPosition(dropdownId);
      const positions = this.dropdownPositions();
      positions.set(dropdownId, position);
      this.dropdownPositions.set(new Map(positions));

      this.showDropdown.set(dropdownId);
    }
  }

  calculateDropdownPosition(dropdownId: string): { left: number; top: number } {
    // Find the button element that triggered this dropdown
    const buttonElement = document.querySelector(
      `[data-dropdown-id="${dropdownId}"]`
    ) as HTMLElement;
    if (!buttonElement) {
      return { left: 0, top: 0 };
    }

    const rect = buttonElement.getBoundingClientRect();
    const dropdownHeight = 280; // Approximate height of dropdown with 7 items
    const viewportHeight = window.innerHeight;

    // Calculate if there's enough space below the button
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top: number;
    if (spaceBelow >= dropdownHeight) {
      // Show below the button
      top = rect.bottom + 4;
    } else if (spaceAbove >= dropdownHeight) {
      // Show above the button
      top = rect.top - dropdownHeight - 4;
    } else {
      // Show in the best available position
      if (spaceBelow > spaceAbove) {
        top = rect.bottom + 4;
      } else {
        top = Math.max(4, rect.top - dropdownHeight - 4);
      }
    }

    return {
      left: rect.left,
      top: top,
    };
  }

  getDropdownPosition(dropdownId: string): { left: number; top: number } {
    // Return cached position if available, otherwise return default
    const cachedPosition = this.dropdownPositions().get(dropdownId);
    return cachedPosition || { left: 0, top: 0 };
  }

  quickAddSchedule(
    driverId: string,
    date: string,
    status: ScheduleStatus
  ): void {

    const request: CreateScheduleRequest = {
      driverId,
      date,
      status,
      startTime: status === "FULL_ROUTE" ? "08:00" : undefined,
      endTime: status === "FULL_ROUTE" ? "16:00" : undefined,
      notes: "",
    };


    // Close dropdown
    this.showDropdown.set("");
    // Clear all cached positions when closing after action
    this.dropdownPositions.set(new Map());

    // Add to pending changes or save directly
    this.pendingChanges.update((changes) => [...changes, request]);

    this.updateLocalSchedule(request);

    // Show success alert for quick add
    this.alertService.showSuccess(
      "Schedule Added",
      "Schedule has been added to pending changes. Click 'Save Changes' to confirm."
    );
  }
}
