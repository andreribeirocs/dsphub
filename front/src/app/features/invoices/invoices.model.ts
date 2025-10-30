export enum InvoiceStatus {
  DRAFT = "DRAFT",
  PENDING_REVIEW = "PENDING_REVIEW",
  APPROVED = "APPROVED",
  SENT = "SENT",
  CANCELLED = "CANCELLED",
}

export interface Invoice {
  readonly id: string;
  readonly invoiceNumber: string;
  readonly driverId: string;
  readonly driver: DriverInfo;
  readonly weekStartDate: string;
  readonly weekEndDate: string;
  readonly status: InvoiceStatus;
  readonly totalAmount: number;
  readonly currency: string;
  readonly notes?: string;
  readonly pdfUrl?: string;
  readonly sentAt?: string;
  readonly sentBy?: UserInfo;
  readonly items?: InvoiceItem[];
  readonly itemCount?: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InvoiceItem {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly routeType: string;
  readonly routeCode?: string;
  readonly amount: number;
}

export interface DriverInfo {
  readonly name: string;
  readonly transporterId: string;
  readonly email: string;
  readonly address?: string;
}

export interface UserInfo {
  readonly name: string;
  readonly email: string;
}

export interface GenerateWeeklyInvoicesRequest {
  readonly weekStartDate: string;
  readonly driverIds?: string[];
}

export interface GenerateWeeklyInvoicesResponse {
  readonly generated: number;
  readonly skipped: number;
  readonly errors: number;
  readonly invoices: Array<{
    readonly invoiceId: string;
    readonly driverId: string;
    readonly driverName: string;
    readonly invoiceNumber: string;
    readonly totalAmount: number;
  }>;
  readonly errorDetails?: Array<{
    readonly driverId: string;
    readonly driverName: string;
    readonly error: string;
  }>;
}

export interface SendInvoicesRequest {
  readonly invoiceIds: string[];
}

export interface SendInvoicesResponse {
  readonly total: number;
  readonly sent: number;
  readonly failed: number;
  readonly results: Array<{
    readonly invoiceId: string;
    readonly invoiceNumber: string;
    readonly driverEmail: string;
    readonly success: boolean;
    readonly error?: string;
  }>;
}

export interface InvoiceFilters {
  readonly driverId?: string;
  readonly status?: InvoiceStatus;
  readonly weekStartFrom?: string;
  readonly weekStartTo?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface InvoiceListResponse {
  readonly items: Invoice[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}
