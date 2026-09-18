export const DRIVER_STATUSES = ["ACTIVE", "PENDING", "SUSPENDED", "EXPIRED", "INACTIVE"] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

/** Derived from the expiry date (no document review data exists yet) */
export type DocumentStatus = "valid" | "expiring" | "expired" | "missing";

export interface DepotRef {
  id: string;
  code: string;
  name: string;
}

export interface Depot extends DepotRef {
  isActive: boolean;
}

/** Driver as returned by GET /api/drivers and GET /api/drivers/:id (dates are ISO strings) */
export interface Driver {
  id: string;
  name: string;
  transporterId?: string | null;
  avatar?: string;
  phone: string;
  email: string;
  /** Company-issued address; the personal one stays in `email` */
  corporateEmail?: string | null;
  /** Legacy free-text depot name, kept in sync with homeDepot by the API */
  depot: string;
  homeDepotId?: string | null;
  homeDepot?: DepotRef | null;
  address: string;
  status: DriverStatus;
  citizenship: string;
  contractType?: string | null;
  licenseNumber?: string | null;
  passportExpiry: string | null;
  licenseExpiry: string | null;
  rtwExpiry: string | null;
  points: number;
  lastCheck: string | null;
  nextCheck: string | null;
  age: number;
  hasEndorsements: boolean;
  joinDate: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriverScheduleItem {
  id: string;
  date: string;
  status: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

/** GET /api/drivers/:id also returns the linked user and the last 30 schedule entries */
export interface DriverDetails extends Driver {
  user?: { id: string; email: string; name: string; role: string; status: string } | null;
  schedules?: DriverScheduleItem[];
}

/** Body of PUT /api/drivers/:id (mirrors api UpdateDriverDto) */
export interface UpdateDriverRequest {
  name?: string;
  phone?: string;
  email?: string;
  /** Empty string clears it */
  corporateEmail?: string;
  address?: string;
  status?: DriverStatus;
  homeDepotId?: string;
  transporterId?: string;
  citizenship?: string;
  contractType?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  passportExpiry?: string;
  rtwExpiry?: string;
  nextCheck?: string;
  points?: number;
  hasEndorsements?: boolean;
}

export interface DriverListFilters {
  depotId?: string;
}

export interface StatCard {
  title: string;
  value: string;
  change: string;
  icon: string;
  color: string;
  bgColor: string;
}

/** GET /api/drivers/stats (organisation-wide counts) */
export interface DriverStats {
  total: number;
  active: number;
  expiring: number;
  pending: number;
}

/** GET /api/payments/driver-payments?driverId=... */
export interface DriverPayment {
  id: string;
  driverId: string;
  workDate: string;
  routeType: string;
  routeCode?: string | null;
  dailyRate: number;
  hoursWorked: number | null;
  extraAmount: number | null;
  deductionAmount: number | null;
  vanCharge: number | null;
  totalPaid: number;
  isPaid: boolean;
  paidDate: string | null;
  notes: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
export const EXPIRY_WARNING_DAYS = 30;

export function documentStatus(expiry: string | null | undefined, now: Date = new Date()): DocumentStatus {
  if (!expiry) {
    return "missing";
  }
  const diffDays = Math.ceil((new Date(expiry).getTime() - now.getTime()) / DAY_MS);
  if (Number.isNaN(diffDays)) {
    return "missing";
  }
  if (diffDays < 0) {
    return "expired";
  }
  return diffDays <= EXPIRY_WARNING_DAYS ? "expiring" : "valid";
}

export function documentStatusClass(status: DocumentStatus): string {
  switch (status) {
    case "valid":
      return "bg-green-100 text-green-800";
    case "expiring":
      return "bg-orange-100 text-orange-800";
    case "expired":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function driverStatusClass(status: string | null | undefined): string {
  switch ((status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "bg-green-100 text-green-800";
    case "PENDING":
      return "bg-yellow-100 text-yellow-800";
    case "SUSPENDED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export { apiErrorMessage } from "../../shared/utils/api-error";
