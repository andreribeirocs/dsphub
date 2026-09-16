import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import type {
  ScheduleEntry,
  WeekSchedule,
  DriverScheduleInfo,
  CreateScheduleRequest,
  UpdateScheduleRequest,
  ScheduleStatCard,
} from "./driver-schedule.model";

@Injectable({
  providedIn: "root",
})
export class DriverScheduleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/drivers/schedule`;

  getWeekSchedule(weekStart: string): Observable<WeekSchedule> {
    return this.http.get<WeekSchedule>(`${this.apiUrl}/week`, {
      params: { weekStart },
    });
  }

  getDriversWithSchedules(weekStart: string): Observable<DriverScheduleInfo[]> {
    return this.http.get<DriverScheduleInfo[]>(`${this.apiUrl}/drivers`, {
      params: { weekStart },
    });
  }

  createSchedule(request: CreateScheduleRequest): Observable<ScheduleEntry> {
    return this.http.post<ScheduleEntry>(this.apiUrl, request);
  }

  updateSchedule(request: UpdateScheduleRequest): Observable<ScheduleEntry> {
    return this.http.put<ScheduleEntry>(
      `${this.apiUrl}/${request.id}`,
      request
    );
  }

  deleteSchedule(driverId: string, date: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${driverId}/${date}`);
  }

  getScheduleStats(weekStart: string): Observable<ScheduleStatCard[]> {
    return this.http.get<ScheduleStatCard[]>(`${this.apiUrl}/stats`, {
      params: { weekStart },
    });
  }

  bulkUpdateSchedule(
    schedules: CreateScheduleRequest[]
  ): Observable<ScheduleEntry[]> {
    return this.http.post<ScheduleEntry[]>(`${this.apiUrl}/bulk`, {
      schedules,
    });
  }
}
