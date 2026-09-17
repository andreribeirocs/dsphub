import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  Depot,
  Driver,
  DriverDetails,
  DriverListFilters,
  DriverPayment,
  DriverStats,
  UpdateDriverRequest,
} from "./drivers.model";

@Injectable({
  providedIn: "root",
})
export class DriverService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/drivers`;

  getDrivers(filters: DriverListFilters = {}): Observable<Driver[]> {
    let params = new HttpParams();
    if (filters.depotId) {
      params = params.set("depotId", filters.depotId);
    }
    return this.http.get<Driver[]>(this.apiUrl, { params });
  }

  getDriver(id: string): Observable<DriverDetails> {
    return this.http.get<DriverDetails>(`${this.apiUrl}/${id}`);
  }

  updateDriver(id: string, body: UpdateDriverRequest): Observable<Driver> {
    return this.http.put<Driver>(`${this.apiUrl}/${id}`, body);
  }

  /** The API never hard-deletes: this sets the driver status to INACTIVE */
  deactivateDriver(id: string): Observable<Driver> {
    return this.http.delete<Driver>(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<DriverStats> {
    return this.http.get<DriverStats>(`${this.apiUrl}/stats`);
  }

  getDepots(): Observable<Depot[]> {
    return this.http.get<Depot[]>(`${environment.apiUrl}/depots`);
  }

  getDriverPayments(driverId: string): Observable<DriverPayment[]> {
    const params = new HttpParams().set("driverId", driverId);
    return this.http.get<DriverPayment[]>(`${environment.apiUrl}/payments/driver-payments`, { params });
  }
}
