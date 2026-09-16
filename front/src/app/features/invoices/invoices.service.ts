import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import type { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import type {
  Invoice,
  InvoiceListResponse,
  GenerateWeeklyInvoicesRequest,
  GenerateWeeklyInvoicesResponse,
  SendInvoicesRequest,
  SendInvoicesResponse,
  InvoiceFilters,
} from "./invoices.model";

@Injectable({
  providedIn: "root",
})
export class InvoicesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/invoices`;

  generateWeeklyInvoices(
    request: GenerateWeeklyInvoicesRequest
  ): Observable<GenerateWeeklyInvoicesResponse> {
    return this.http.post<GenerateWeeklyInvoicesResponse>(
      `${this.apiUrl}/generate-weekly`,
      request
    );
  }

  getInvoices(filters?: InvoiceFilters): Observable<InvoiceListResponse> {
    let params = new HttpParams();

    if (filters) {
      if (filters.driverId) params = params.set("driverId", filters.driverId);
      if (filters.status) params = params.set("status", filters.status);
      if (filters.weekStartFrom)
        params = params.set("weekStartFrom", filters.weekStartFrom);
      if (filters.weekStartTo)
        params = params.set("weekStartTo", filters.weekStartTo);
      if (filters.page) params = params.set("page", filters.page.toString());
      if (filters.limit) params = params.set("limit", filters.limit.toString());
    }

    return this.http.get<InvoiceListResponse>(this.apiUrl, { params });
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.apiUrl}/${id}`);
  }

  updateInvoice(
    id: string,
    data: { totalAmount?: number; notes?: string }
  ): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.apiUrl}/${id}`, data);
  }

  approveInvoice(id: string): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.apiUrl}/${id}/approve`, {});
  }

  regeneratePdf(id: string): Observable<{ pdfUrl: string }> {
    return this.http.post<{ pdfUrl: string }>(
      `${this.apiUrl}/${id}/regenerate-pdf`,
      {}
    );
  }

  sendInvoices(request: SendInvoicesRequest): Observable<SendInvoicesResponse> {
    return this.http.post<SendInvoicesResponse>(
      `${this.apiUrl}/send-bulk`,
      request
    );
  }

  downloadPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${id}/pdf`, {
      responseType: "blob",
    });
  }

  cancelInvoice(id: string): Observable<Invoice> {
    return this.http.delete<Invoice>(`${this.apiUrl}/${id}`);
  }

  clearAllInvoices(): Observable<{
    success: boolean;
    deletedInvoices: number;
    deletedPdfs: number;
    message: string;
  }> {
    return this.http.delete<{
      success: boolean;
      deletedInvoices: number;
      deletedPdfs: number;
      message: string;
    }>(`${this.apiUrl}/clear/all`, { withCredentials: true });
  }
}
