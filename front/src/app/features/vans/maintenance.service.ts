import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  MaintenanceRecord,
  MaintenanceStats,
  CreateMaintenanceRequest,
  UpdateMaintenanceRequest,
  GetMaintenanceQuery,
} from "./vans.model";

@Injectable({
  providedIn: "root",
})
export class MaintenanceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/maintenance`;

  getMaintenanceRecords(query?: GetMaintenanceQuery): Observable<MaintenanceRecord[]> {
    let params = new HttpParams();
    
    if (query?.vanId) {
      params = params.set("vanId", query.vanId);
    }
    if (query?.status) {
      params = params.set("status", query.status);
    }
    if (query?.priority) {
      params = params.set("priority", query.priority);
    }
    if (query?.type) {
      params = params.set("type", query.type);
    }
    if (query?.overdueOnly !== undefined) {
      params = params.set("overdueOnly", query.overdueOnly.toString());
    }
    if (query?.upcomingOnly !== undefined) {
      params = params.set("upcomingOnly", query.upcomingOnly.toString());
    }

    return this.http.get<MaintenanceRecord[]>(this.apiUrl, { params });
  }

  getMaintenanceRecord(id: string): Observable<MaintenanceRecord> {
    return this.http.get<MaintenanceRecord>(`${this.apiUrl}/${id}`);
  }

  createMaintenanceRecord(maintenance: CreateMaintenanceRequest): Observable<MaintenanceRecord> {
    return this.http.post<MaintenanceRecord>(this.apiUrl, maintenance);
  }

  updateMaintenanceRecord(id: string, maintenance: UpdateMaintenanceRequest): Observable<MaintenanceRecord> {
    return this.http.put<MaintenanceRecord>(`${this.apiUrl}/${id}`, maintenance);
  }

  deleteMaintenanceRecord(id: string): Observable<MaintenanceRecord> {
    return this.http.delete<MaintenanceRecord>(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<MaintenanceStats> {
    return this.http.get<MaintenanceStats>(`${this.apiUrl}/stats`);
  }

  getAlerts(): Observable<MaintenanceRecord[]> {
    return this.http.get<MaintenanceRecord[]>(`${this.apiUrl}/alerts`);
  }

  updateOverdueStatus(): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/update-overdue`, {});
  }

  completeMaintenance(
    id: string,
    data: {
      actualCost?: string;
      laborHours?: string;
      invoiceNumber?: string;
      notes?: string;
      partsUsed?: any[];
    }
  ): Observable<MaintenanceRecord> {
    return this.http.put<MaintenanceRecord>(`${this.apiUrl}/${id}/complete`, data);
  }
}