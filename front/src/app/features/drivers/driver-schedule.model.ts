export type ScheduleStatus =
  | "FULL_ROUTE"
  | "OFF"
  | "HOLIDAY"
  | "RIDE_ALONG"
  | "TRAINING_DAY"
  | "SAME_DAY"
  | "NURSERY_ROUTE";

export interface ScheduleEntry {
  readonly driverId: string;
  readonly date: string;
  readonly status: ScheduleStatus;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly notes?: string;
}

export interface DaySchedule {
  readonly date: string;
  readonly dayName: string;
  readonly dayNumber: number;
  readonly isToday: boolean;
  readonly schedules: ScheduleEntry[];
}

export interface WeekSchedule {
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly days: DaySchedule[];
}

export interface DriverScheduleInfo {
  readonly id: string;
  readonly name: string;
  readonly avatar?: string;
  readonly status: string;
  readonly schedules: Record<string, ScheduleEntry>;
}

export interface ScheduleStatCard {
  readonly title: string;
  readonly value: string;
  readonly change: string;
  readonly icon: string;
  readonly color: string;
  readonly bgColor: string;
}

export interface CreateScheduleRequest {
  readonly driverId: string;
  readonly date: string;
  readonly status: ScheduleStatus;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly notes?: string;
}

export interface UpdateScheduleRequest extends CreateScheduleRequest {
  readonly id: string;
}

export interface ScheduleFilters {
  readonly week: string;
  readonly status: ScheduleStatus | "all";
  readonly depot: string;
}
