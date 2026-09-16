import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RecentActivity {
  id: string;
  timestamp: Date;
  type: 'login' | 'payment' | 'security' | 'driver' | 'candidate' | 'system';
  activity: string;
  user: {
    name: string;
    email?: string;
  };
  status: 'success' | 'warning' | 'error' | 'info';
  details?: string;
}

export interface DashboardStats {
  activeDrivers: number;
  completedRoutes: number;
  pendingCandidates: number;
  vehicleIssues: number;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private readonly baseUrl = `${environment.apiUrl}`;

  constructor(private http: HttpClient) {}

  getRecentActivities(): Observable<RecentActivity[]> {
    return this.http.get<RecentActivity[]>(`${this.baseUrl}/dashboard/recent-activities`);
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${this.baseUrl}/dashboard/stats`);
  }
}
