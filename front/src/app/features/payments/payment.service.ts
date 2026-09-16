import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";
import {
  PaymentDashboard,
  RoutePrice,
  PaymentHistoryResponse,
  PaymentHistoryItem,
  UpdateRoutePriceRequest,
  DriverPaymentRecord,
  CreateDriverPaymentRequest,
  UpdateDriverPaymentRequest,
  RouteType,
} from "./payment.model";

@Injectable({
  providedIn: "root",
})
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/payments`;

  /**
   * Get payment dashboard overview
   */
  getDashboard(): Observable<PaymentDashboard> {
    return this.http.get<PaymentDashboard>(`${this.apiUrl}/dashboard`);
  }

  /**
   * Update route price (Financial managers and directors only)
   */
  updateRoutePrice(request: UpdateRoutePriceRequest): Observable<RoutePrice> {
    return this.http.put<RoutePrice>(`${this.apiUrl}/route-prices`, request);
  }

  /**
   * Get payment history with optional filtering
   */
  getPaymentHistory(filters?: {
    routeType?: RouteType;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Observable<PaymentHistoryResponse> {
    let params = new HttpParams();

    if (filters?.routeType) {
      params = params.set("routeType", filters.routeType);
    }
    if (filters?.startDate) {
      params = params.set("startDate", filters.startDate);
    }
    if (filters?.endDate) {
      params = params.set("endDate", filters.endDate);
    }
    if (filters?.page) {
      params = params.set("page", filters.page.toString());
    }
    if (filters?.limit) {
      params = params.set("limit", filters.limit.toString());
    }

    return this.http.get<PaymentHistoryResponse>(`${this.apiUrl}/history`, {
      params,
    });
  }

  /**
   * Create driver payment record
   */
  createDriverPayment(
    request: CreateDriverPaymentRequest
  ): Observable<DriverPaymentRecord> {
    return this.http.post<DriverPaymentRecord>(
      `${this.apiUrl}/driver-payments`,
      request
    );
  }

  /**
   * Get driver payments with optional filtering
   */
  getDriverPayments(filters?: {
    driverId?: string;
    routeType?: RouteType;
    startDate?: string;
    endDate?: string;
    isPaid?: boolean;
  }): Observable<DriverPaymentRecord[]> {
    let params = new HttpParams();

    if (filters?.driverId) {
      params = params.set("driverId", filters.driverId);
    }
    if (filters?.routeType) {
      params = params.set("routeType", filters.routeType);
    }
    if (filters?.startDate) {
      params = params.set("startDate", filters.startDate);
    }
    if (filters?.endDate) {
      params = params.set("endDate", filters.endDate);
    }
    if (filters?.isPaid !== undefined) {
      params = params.set("isPaid", filters.isPaid.toString());
    }

    return this.http.get<DriverPaymentRecord[]>(
      `${this.apiUrl}/driver-payments`,
      { params }
    );
  }

  /**
   * Update driver payment status
   */
  updateDriverPayment(
    paymentId: string,
    request: UpdateDriverPaymentRequest
  ): Observable<DriverPaymentRecord> {
    return this.http.put<DriverPaymentRecord>(
      `${this.apiUrl}/driver-payments/${paymentId}`,
      request
    );
  }

  /**
   * Mark driver payment as paid
   */
  markPaymentAsPaid(
    paymentId: string,
    notes?: string
  ): Observable<DriverPaymentRecord> {
    return this.updateDriverPayment(paymentId, {
      isPaid: true,
      paidDate: new Date().toISOString(),
      notes,
    });
  }

  /**
   * Mark driver payment as unpaid
   */
  markPaymentAsUnpaid(
    paymentId: string,
    notes?: string
  ): Observable<DriverPaymentRecord> {
    return this.updateDriverPayment(paymentId, {
      isPaid: false,
      notes,
    });
  }

  /**
   * Prefill daily payments for a date
   */
  prefillDaily(date: string, includeExisting: boolean = true) {
    const params = new HttpParams()
      .set("date", date)
      .set("includeExisting", includeExisting.toString());
    return this.http.get<import("./payment.model").DailyPrefillItem[]>(
      `${this.apiUrl}/daily`,
      { params }
    );
  }

  /**
   * Save daily payments (bulk)
   */
  saveDaily(body: import("./payment.model").SaveDailyPaymentsRequest) {
    return this.http.post<{ created: number; updated: number }>(
      `${this.apiUrl}/daily`,
      body
    );
  }

  /**
   * Import daily payments from XLSX file
   */
  importXlsx(body: import("./payment.model").ImportXlsxRequest) {
    return this.http.post<import("./payment.model").ImportXlsxResponse>(
      `${this.apiUrl}/import-xlsx`,
      body
    );
  }
}
