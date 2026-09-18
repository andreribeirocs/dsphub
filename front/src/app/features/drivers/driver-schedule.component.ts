import {
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  effect,
  afterNextRender,
  ElementRef,
  viewChild,
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

  templateUrl: "./driver-schedule.component.html",
  styleUrls: ["./driver-schedule.component.scss"],
})
export class DriverScheduleComponent implements OnInit, OnDestroy {
  private readonly scheduleService = inject(DriverScheduleService);
  private readonly driverService = inject(DriverService);
  private readonly router = inject(Router);
  private readonly alertService = inject(AlertService);
  private readonly destroy$ = new Subject<void>();
  private loadingRequestId = signal<string | null>(null);
  private readonly pageHeader =
    viewChild.required<ElementRef<HTMLElement>>("schedulePageHeader");
  private pageHeaderObserver?: ResizeObserver;
  readonly pageHeaderHeight = signal(0);

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
    afterNextRender(() => {
      const header = this.pageHeader().nativeElement;
      const updateHeaderHeight = () => {
        this.pageHeaderHeight.set(header.getBoundingClientRect().height);
      };

      // Keep column labels below the sticky toolbar, including after resizing.
      updateHeaderHeight();
      this.pageHeaderObserver = new ResizeObserver(updateHeaderHeight);
      this.pageHeaderObserver.observe(header);
    });

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
    this.pageHeaderObserver?.disconnect();
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

    // One week on screen: only this week's data is fetched.
    const weekStarts = this.getMultipleWeekStarts(weekStart, 1);

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

        // Promise.all above is built as: one schedule per week, then one
        // drivers list per week, then a single stats call. The slice bounds
        // must follow weekStarts.length — they were hardcoded to 3 and broke
        // silently when the screen went down to a single week.
        const weekCount = weekStarts.length;
        const weekSchedules = results
          .slice(0, weekCount)
          .filter((r) => r !== null) as WeekSchedule[];
        const driversData = results
          .slice(weekCount, weekCount * 2)
          .filter((r) => r !== null) as DriverScheduleInfo[][];
        const stats = results[weekCount * 2] as ScheduleStatCard[];


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

  /**
   * Sunday that starts week 2 of `year` — that is, the first Sunday AFTER
   * 1 January. Week 1 runs from 1 January to the Saturday before it.
   */
  private secondWeekSundayOf(year: number): Date {
    const jan1 = new Date(year, 0, 1);
    const daysToSunday = (7 - jan1.getDay()) % 7;
    const sunday = new Date(year, 0, 1 + (daysToSunday === 0 ? 7 : daysToSunday));
    return sunday;
  }

  /**
   * Week number in the DSP's calendar, matching the reference tab of the
   * Payment Tracker sheet (validated against its 365 rows for 2025).
   *
   * Week 1 always STARTS on 1 January, whatever weekday that is, and ends on
   * the first Saturday. Every week after that runs Sunday to Saturday, and the
   * final week of the year is cut short at 31 December. So the first and last
   * weeks of a year are usually partial, and a year normally has 53 of them.
   *
   * Because of that, an on-screen week (always Sunday to Saturday) can straddle
   * two numbered weeks at New Year — Sun 27/12/2026 to Sat 02/01/2027 is week
   * 53 of 2026 for its first five days and week 1 of 2027 for the last two.
   * formatWeekRange() shows both numbers in that case rather than picking one.
   *
   * Dates are built from local Y/M/D on purpose — see toDateKey() for the
   * timezone bug this file had.
   */
  private weekOfYear(dateKey: string): { week: number; year: number } {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const secondWeekSunday = this.secondWeekSundayOf(y);

    if (date < secondWeekSunday) {
      return { week: 1, year: y };
    }

    const days = Math.round(
      (date.getTime() - secondWeekSunday.getTime()) / (24 * 60 * 60 * 1000)
    );
    return { week: 2 + Math.floor(days / 7), year: y };
  }

  /** e.g. "Week 37 · Sep 13 - Sep 19, 2026" */
  formatWeekRange(): string {
    const week = this.currentWeek();
    if (!week.weekStart || !week.weekEnd) return "";

    const first = this.weekOfYear(week.weekStart);
    const last = this.weekOfYear(week.weekEnd);
    const weekNumber =
      first.week === last.week ? `${first.week}` : `${first.week}/${last.week}`;
    const [sy, sm, sd] = week.weekStart.split("-").map(Number);
    const [ey, em, ed] = week.weekEnd.split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);

    const startLabel = start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    const endLabel = end.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return `Week ${weekNumber} \u00b7 ${startLabel} - ${endLabel}`;
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
