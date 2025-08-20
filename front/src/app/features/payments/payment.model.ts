export enum RouteType {
  FULL_ROUTE = "FULL_ROUTE",
  HIDE_ALONG = "HIDE_ALONG",
  TRAINING_DAY = "TRAINING_DAY",
  SAME_DAY = "SAME_DAY",
  NURSERY_ROUTE = "NURSERY_ROUTE",
  EXTRAS = "EXTRAS",
  ORDT_EXTRA_LARGE_CARGO_VAN = "ORDT_EXTRA_LARGE_CARGO_VAN",
  STANDARD_PARCEL_MEDIUM_VAN = "STANDARD_PARCEL_MEDIUM_VAN",
  NURSERY_ROUTE_LEVEL_1 = "NURSERY_ROUTE_LEVEL_1",
}

export interface RoutePrice {
  readonly id: string;
  readonly routeType: RouteType;
  readonly dailyRate: number;
  readonly lastUpdated: string;
  readonly updatedBy: string;
  readonly updatedByUser: {
    readonly name: string;
    readonly email: string;
  };
}

export interface DashboardStats {
  readonly totalRoutes: number;
  readonly dailyRevenuePotential: number;
  readonly priceChanges: number;
}

export interface PaymentDashboard {
  readonly routePrices: RoutePrice[];
  readonly stats: DashboardStats;
}

export interface PaymentHistoryItem {
  readonly id: string;
  readonly routeType: RouteType;
  readonly oldRate: number | null;
  readonly newRate: number;
  readonly changeReason: string | null;
  readonly changeDate: string;
  readonly changedByUser: {
    readonly name: string;
    readonly email: string;
  };
}

export interface PaymentHistoryResponse {
  readonly items: PaymentHistoryItem[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
}

export interface UpdateRoutePriceRequest {
  readonly routeType: RouteType;
  readonly dailyRate: string;
  readonly changeReason?: string;
}

export interface DriverPaymentRecord {
  readonly id: string;
  readonly driverId: string;
  readonly driver: {
    readonly name: string;
    readonly transporterId: string;
    readonly email?: string;
  };
  readonly workDate: string;
  readonly routeType: RouteType;
  readonly routeCode?: string;
  readonly dailyRate: number;
  readonly hoursWorked: number | null;
  readonly extraAmount?: number | null;
  readonly deductionAmount?: number | null;
  readonly vanCharge?: number | null;
  readonly totalPaid: number;
  readonly isPaid: boolean;
  readonly paidDate: string | null;
  readonly paidBy: string | null;
  readonly paidByUser: {
    readonly name: string;
    readonly email: string;
  } | null;
  readonly sourceSheet?: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt?: string;
}

export interface CreateDriverPaymentRequest {
  readonly driverId: string;
  readonly workDate: string;
  readonly routeType: RouteType;
  readonly dailyRate: string;
  readonly hoursWorked?: string;
  readonly totalPaid: string;
  readonly notes?: string;
}

export interface UpdateDriverPaymentRequest {
  readonly isPaid?: boolean;
  readonly paidDate?: string;
  readonly notes?: string;
}

// Daily Payment (prefill and save)
export interface DailyPrefillItem {
  readonly driverId: string;
  readonly driverName: string;
  readonly transporterId: string;
  readonly workDate: string; // YYYY-MM-DD
  readonly routeType: RouteType;
  readonly routeCode?: string;
  readonly dailyRate: number;
  readonly extraAmount: number;
  readonly deductionAmount: number;
  readonly vanCharge: number;
  readonly totalSuggested: number;
  readonly exists: boolean;
}

export interface DailyUpsertItem {
  readonly driverId: string;
  readonly routeType: RouteType;
  readonly routeCode?: string;
  readonly dailyRate: string; // 2dp string
  readonly extraAmount?: string;
  readonly deductionAmount?: string;
  readonly vanCharge?: string;
  readonly notes?: string;
  readonly sourceSheet?: string;
}

export interface SaveDailyPaymentsRequest {
  readonly date: string; // YYYY-MM-DD
  readonly items: DailyUpsertItem[];
}

export interface ImportXlsxRequest {
  readonly date: string; // YYYY-MM-DD
  readonly sourceSheet?: string;
  readonly fileContent: string; // Base64 encoded XLSX file
}

export interface ImportXlsxResponse {
  readonly created: number;
  readonly updated: number;
  readonly errors: string[];
}

// Route type display names for UI
export const ROUTE_TYPE_LABELS: Record<RouteType, string> = {
  [RouteType.FULL_ROUTE]: "Full Route",
  [RouteType.HIDE_ALONG]: "Ride Along",
  [RouteType.TRAINING_DAY]: "Training Day",
  [RouteType.SAME_DAY]: "Same Day",
  [RouteType.NURSERY_ROUTE]: "Nursery Route",
  [RouteType.EXTRAS]: "Extras",
  [RouteType.ORDT_EXTRA_LARGE_CARGO_VAN]: "ORDT Extra Large Cargo Van",
  [RouteType.STANDARD_PARCEL_MEDIUM_VAN]: "Standard Parcel Medium Van",
  [RouteType.NURSERY_ROUTE_LEVEL_1]: "Nursery Route Level 1",
};

// Route type colors for UI
export const ROUTE_TYPE_COLORS: Record<RouteType, string> = {
  [RouteType.FULL_ROUTE]: "bg-blue-100 text-blue-800",
  [RouteType.HIDE_ALONG]: "bg-green-100 text-green-800",
  [RouteType.TRAINING_DAY]: "bg-yellow-100 text-yellow-800",
  [RouteType.SAME_DAY]: "bg-purple-100 text-purple-800",
  [RouteType.NURSERY_ROUTE]: "bg-pink-100 text-pink-800",
  [RouteType.EXTRAS]: "bg-gray-100 text-gray-800",
  [RouteType.ORDT_EXTRA_LARGE_CARGO_VAN]: "bg-orange-100 text-orange-800",
  [RouteType.STANDARD_PARCEL_MEDIUM_VAN]: "bg-indigo-100 text-indigo-800",
  [RouteType.NURSERY_ROUTE_LEVEL_1]: "bg-teal-100 text-teal-800",
};
