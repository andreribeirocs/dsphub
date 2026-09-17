import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import type { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import type {
  Organization,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  DepotRecord,
  CreateDepotDto,
  UpdateDepotDto,
} from "./organizations.model";

@Injectable({
  providedIn: "root",
})
export class OrganizationsService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/organizations`;
  private readonly DEPOTS_URL = `${environment.apiUrl}/depots`;

  /** The DSP of the current domain */
  getCurrent(): Observable<Organization> {
    return this.http.get<Organization>(`${this.API_URL}/current`, {
      withCredentials: true,
    });
  }

  /** Depots of the current DSP */
  getDepots(includeInactive = false): Observable<DepotRecord[]> {
    return this.http.get<DepotRecord[]>(this.DEPOTS_URL, {
      params: includeInactive ? { includeInactive: "true" } : {},
      withCredentials: true,
    });
  }

  createDepot(dto: CreateDepotDto): Observable<DepotRecord> {
    return this.http.post<DepotRecord>(this.DEPOTS_URL, dto, {
      withCredentials: true,
    });
  }

  updateDepot(id: string, dto: UpdateDepotDto): Observable<DepotRecord> {
    return this.http.patch<DepotRecord>(`${this.DEPOTS_URL}/${id}`, dto, {
      withCredentials: true,
    });
  }

  getAll(): Observable<Organization[]> {
    return this.http.get<Organization[]>(this.API_URL, {
      withCredentials: true,
    });
  }

  getById(id: string): Observable<Organization> {
    return this.http.get<Organization>(`${this.API_URL}/${id}`, {
      withCredentials: true,
    });
  }

  create(dto: CreateOrganizationDto): Observable<Organization> {
    return this.http.post<Organization>(this.API_URL, dto, {
      withCredentials: true,
    });
  }

  update(id: string, dto: UpdateOrganizationDto): Observable<Organization> {
    return this.http.patch<Organization>(`${this.API_URL}/${id}`, dto, {
      withCredentials: true,
    });
  }

  delete(id: string): Observable<Organization> {
    return this.http.delete<Organization>(`${this.API_URL}/${id}`, {
      withCredentials: true,
    });
  }

  getMembers(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/${id}/members`, {
      withCredentials: true,
    });
  }
}
