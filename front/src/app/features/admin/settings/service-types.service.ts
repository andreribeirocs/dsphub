import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../../environments/environment";

/** Service type as returned by GET /api/service-types */
export interface ServiceTypeRecord {
  id: string;
  organizationId: string;
  /** Stable key; matches a RouteType enum value for the rows the migration created */
  code: string;
  name: string;
  hours: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceTypeDto {
  code: string;
  name: string;
  hours?: number;
  sortOrder?: number;
}

/** `code` is absent on purpose: it is the bridge back to the payment tables */
export interface UpdateServiceTypeDto {
  name?: string;
  hours?: number;
  isActive?: boolean;
  sortOrder?: number;
}

@Injectable({ providedIn: "root" })
export class ServiceTypesService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/service-types`;

  list(includeInactive = false): Observable<ServiceTypeRecord[]> {
    const query = includeInactive ? "?includeInactive=true" : "";
    return this.http.get<ServiceTypeRecord[]>(`${this.API_URL}${query}`);
  }

  create(dto: CreateServiceTypeDto): Observable<ServiceTypeRecord> {
    return this.http.post<ServiceTypeRecord>(this.API_URL, dto);
  }

  update(
    id: string,
    dto: UpdateServiceTypeDto
  ): Observable<ServiceTypeRecord> {
    return this.http.patch<ServiceTypeRecord>(`${this.API_URL}/${id}`, dto);
  }

  deactivate(id: string): Observable<ServiceTypeRecord> {
    return this.http.delete<ServiceTypeRecord>(`${this.API_URL}/${id}`);
  }
}
