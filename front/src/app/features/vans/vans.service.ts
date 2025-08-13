import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  Van,
  VanStats,
  CreateVanRequest,
  UpdateVanRequest,
  GetVansQuery,
} from "./vans.model";

@Injectable({
  providedIn: "root",
})
export class VansService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/vans`;

  getVans(query?: GetVansQuery): Observable<Van[]> {
    let params = new HttpParams();
    
    if (query?.status) {
      params = params.set("status", query.status);
    }
    if (query?.condition) {
      params = params.set("condition", query.condition);
    }
    if (query?.depot) {
      params = params.set("depot", query.depot);
    }
    if (query?.contract) {
      params = params.set("contract", query.contract);
    }
    if (query?.search) {
      params = params.set("search", query.search);
    }
    if (query?.expiringMot !== undefined) {
      params = params.set("expiringMot", query.expiringMot.toString());
    }
    if (query?.maintenanceAlerts !== undefined) {
      params = params.set("maintenanceAlerts", query.maintenanceAlerts.toString());
    }
    if (query?.make) {
      params = params.set("make", query.make);
    }

    return this.http.get<Van[]>(this.apiUrl, { params });
  }

  getVan(id: string): Observable<Van> {
    return this.http.get<Van>(`${this.apiUrl}/${id}`);
  }

  getVanByNumber(vanNumber: string): Observable<Van> {
    return this.http.get<Van>(`${this.apiUrl}/number/${vanNumber}`);
  }

  createVan(van: CreateVanRequest): Observable<Van> {
    return this.http.post<Van>(this.apiUrl, van);
  }

  updateVan(id: string, van: UpdateVanRequest): Observable<Van> {
    return this.http.put<Van>(`${this.apiUrl}/${id}`, van);
  }

  deleteVan(id: string): Observable<Van> {
    return this.http.delete<Van>(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<VanStats> {
    return this.http.get<VanStats>(`${this.apiUrl}/stats`);
  }

  getExpiringMot(days?: number): Observable<Van[]> {
    let params = new HttpParams();
    if (days !== undefined) {
      params = params.set("days", days.toString());
    }
    return this.http.get<Van[]>(`${this.apiUrl}/expiring-mot`, { params });
  }
}