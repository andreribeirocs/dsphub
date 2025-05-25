export type DriverStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'EXPIRED';
export type DocumentStatus = 'valid' | 'expiring' | 'expired' | 'pending';

export interface Driver {
  id: string;
  name: string;
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
  type: 'success' | 'warning' | 'pending' | 'info';
}

export interface DriverStats {
  total: number;
  active: number;
  expiring: number;
  pending: number;
}
