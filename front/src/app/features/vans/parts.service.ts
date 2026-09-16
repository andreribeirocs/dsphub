import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  Part,
  PartsStats,
  PartPrice,
  CreatePartRequest,
  UpdatePartRequest,
  GetPartsQuery,
} from "./vans.model";

@Injectable({
  providedIn: "root",
})
export class PartsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/parts`;

  getParts(query?: GetPartsQuery): Observable<Part[]> {
    let params = new HttpParams();
    
    if (query?.category) {
      params = params.set("category", query.category);
    }
    if (query?.search) {
      params = params.set("search", query.search);
    }
    if (query?.supplier) {
      params = params.set("supplier", query.supplier);
    }
    if (query?.activeOnly !== undefined) {
      params = params.set("activeOnly", query.activeOnly.toString());
    }
    if (query?.lowStockOnly !== undefined) {
      params = params.set("lowStockOnly", query.lowStockOnly.toString());
    }
    if (query?.vehicleMake) {
      params = params.set("vehicleMake", query.vehicleMake);
    }

    return this.http.get<Part[]>(this.apiUrl, { params });
  }

  getPart(id: string): Observable<Part> {
    return this.http.get<Part>(`${this.apiUrl}/${id}`);
  }

  getPartsByCategory(category: string): Observable<Part[]> {
    return this.http.get<Part[]>(`${this.apiUrl}/category/${category}`);
  }

  createPart(part: CreatePartRequest): Observable<Part> {
    return this.http.post<Part>(this.apiUrl, part);
  }

  updatePart(id: string, part: UpdatePartRequest): Observable<Part> {
    return this.http.put<Part>(`${this.apiUrl}/${id}`, part);
  }

  deletePart(id: string): Observable<Part> {
    return this.http.delete<Part>(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<PartsStats> {
    return this.http.get<PartsStats>(`${this.apiUrl}/stats`);
  }

  getLowStockParts(): Observable<Part[]> {
    return this.http.get<Part[]>(`${this.apiUrl}/low-stock`);
  }

  getCategories(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/categories`);
  }

  getPricingByVehicle(vehicleMake: "ford" | "mercedes" | "peugeot"): Observable<PartPrice[]> {
    return this.http.get<PartPrice[]>(`${this.apiUrl}/pricing/${vehicleMake}`);
  }

  updateStock(id: string, quantity: number): Observable<Part> {
    return this.http.put<Part>(`${this.apiUrl}/${id}/stock`, { quantity });
  }

  bulkUpdatePrices(
    vehicleMake: "ford" | "mercedes" | "peugeot",
    priceUpdates: Array<{ partId: string; price: number }>
  ): Observable<{ updated: number }> {
    return this.http.put<{ updated: number }>(`${this.apiUrl}/pricing/${vehicleMake}/bulk`, priceUpdates);
  }
}