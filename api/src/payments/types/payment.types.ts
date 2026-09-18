import { RouteType } from "@prisma/client";

export interface RoutePrice {
  readonly id: string;
  readonly routeType: RouteType;
  readonly dailyRate: number;
  readonly lastUpdated: Date;
  readonly updatedBy: string;
  readonly updatedByUser: {
    readonly name: string;
    readonly email: string;
  };
}

export interface PaymentHistoryItem {
  readonly id: string;
  readonly routeType: RouteType;
  readonly oldRate: number | null;
  readonly newRate: number;
  readonly changeReason: string | null;
  readonly changeDate: Date;
  readonly changedByUser: {
    readonly name: string;
    readonly email: string;
  };
}

export interface DashboardStats {
  readonly totalRoutes: number;
  readonly dailyRevenuePotential: number;
  readonly priceChanges: number;
}

export interface DriverPaymentRecord {
  readonly id: string;
  readonly driverId: string;
  readonly driver: {
    readonly name: string;
    /** Null while the driver is still in onboarding */
    readonly transporterId: string | null;
    readonly email?: string;
  };
  readonly workDate: Date;
  readonly routeType: RouteType;
  readonly routeCode?: string;
  readonly dailyRate: number;
  readonly hoursWorked: number | null;
  readonly extraAmount?: number | null;
  readonly deductionAmount?: number | null;
  readonly vanCharge?: number | null;
  readonly totalPaid: number;
  readonly isPaid: boolean;
  readonly paidDate: Date | null;
  readonly paidBy: string | null;
  readonly paidByUser: {
    readonly name: string;
    readonly email: string;
  } | null;
  readonly sourceSheet?: string | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt?: Date;
}
