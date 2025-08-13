import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  Contract,
  ContractStats,
  CreateContractRequest,
  UpdateContractRequest,
  GetContractsQuery,
} from "./vans.model";

@Injectable({
  providedIn: "root",
})
export class ContractsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/contracts`;

  getContracts(query?: GetContractsQuery): Observable<Contract[]> {
    let params = new HttpParams();
    
    if (query?.status) {
      params = params.set("status", query.status);
    }
    if (query?.depot) {
      params = params.set("depot", query.depot);
    }
    if (query?.supplier) {
      params = params.set("supplier", query.supplier);
    }
    if (query?.search) {
      params = params.set("search", query.search);
    }

    return this.http.get<Contract[]>(this.apiUrl, { params });
  }

  getContract(id: string): Observable<Contract> {
    return this.http.get<Contract>(`${this.apiUrl}/${id}`);
  }

  getContractByName(name: string): Observable<Contract> {
    return this.http.get<Contract>(`${this.apiUrl}/name/${name}`);
  }

  createContract(contract: CreateContractRequest): Observable<Contract> {
    return this.http.post<Contract>(this.apiUrl, contract);
  }

  updateContract(id: string, contract: UpdateContractRequest): Observable<Contract> {
    return this.http.put<Contract>(`${this.apiUrl}/${id}`, contract);
  }

  deleteContract(id: string): Observable<Contract> {
    return this.http.delete<Contract>(`${this.apiUrl}/${id}`);
  }

  getStats(): Observable<ContractStats> {
    return this.http.get<ContractStats>(`${this.apiUrl}/stats`);
  }

  getExpiringSoon(days?: number): Observable<Contract[]> {
    let params = new HttpParams();
    if (days !== undefined) {
      params = params.set("days", days.toString());
    }
    return this.http.get<Contract[]>(`${this.apiUrl}/expiring`, { params });
  }

  assignVan(contractId: string, vanId: string): Observable<Contract> {
    return this.http.put<Contract>(`${this.apiUrl}/${contractId}/vans/${vanId}`, {});
  }

  removeVan(contractId: string, vanId: string): Observable<Contract> {
    return this.http.delete<Contract>(`${this.apiUrl}/${contractId}/vans/${vanId}`);
  }
}