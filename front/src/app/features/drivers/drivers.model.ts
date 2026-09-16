export type DriverStatus =
  | "ACTIVE"
  | "PENDING"
  | "SUSPENDED"
  | "EXPIRED"
  | "INACTIVE";
export type DocumentStatus = "valid" | "expiring" | "expired" | "pending";

export interface Driver {
  id: string;
  name: string;
  transporterId?: string;
  avatar?: string;
  phone: string;
  email: string;
  depot: string;
  address: string;
  status: DriverStatus;
  citizenship: string;
  passportExpiry: string;
  licenseExpiry: string;
  rtwExpiry: string;
  points: number;
  lastCheck: string;
  nextCheck: string;
  age: number;
  hasEndorsements: boolean;
  joinDate: string;
  completionRate: number;
  rating: number;
  totalTrips: number;
  documents: {
    passport: DocumentStatus;
    license: DocumentStatus;
    rtw: DocumentStatus;
    medical: DocumentStatus;
    dbs: DocumentStatus;
    [key: string]: DocumentStatus;
  };
}

export interface StatCard {
  title: string;
  value: string;
  change: string;
  icon: string;
  color: string;
  bgColor: string;
}

export interface ActivityItem {
  id: number;
  driver: string;
  action: string;
  time: string;
  type: "success" | "warning" | "pending" | "info";
}

export interface DriverStats {
  total: number;
  active: number;
  expiring: number;
  pending: number;
}

export interface WeeklyPerformance {
  week: number;
  deliveries: number;
  dcr: number;
  dnrDpmo: number;
  lorDpmo: number;
  pod: number;
  cc: number;
  ce: number;
  cdf: number;
  overallScore: number;
}

export interface PerformanceMetrics {
  currentWeek: {
    deliveries: number;
    dcr: number;
    pod: number;
    cdf: number;
  };
  weeklyTrends: {
    dcr: number[];
    pod: number[];
    cc: number[];
    cdf: number[];
  };
  weeklyDeliveries: number[];
  weeklyPerformance: WeeklyPerformance[];
  targets: {
    dcr: number;
    pod: number;
    cc: number;
    cdf: number;
  };
  improvementAreas: {
    critical: string[];
    performance: string[];
    training: string[];
  };
}
