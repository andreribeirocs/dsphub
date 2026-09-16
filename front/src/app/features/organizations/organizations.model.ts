export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  createdAt: string;
  updatedAt: string;
  // Address fields
  address?: string;
  city?: string;
  postcode?: string;
  country?: string;
  // Contact fields
  phone?: string;
  email?: string;
  website?: string;
  // Legal fields
  taxId?: string;
  registrationNumber?: string;
  vatNumber?: string;
  companyRegNumber?: string;
  // Branding
  logoBase64?: string;
  invoicePrefix?: string;
  invoiceFooter?: string;
  // Banking
  bankName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
  iban?: string;
  swiftCode?: string;
  // Invoice settings
  termsAndConditions?: string;
  footerText?: string;
  // Depots
  depots?: Depot[];
  // Status
  isActive: boolean;
  // Counts (when included)
  _count?: {
    members?: number;
    drivers?: number;
    invoices?: number;
    candidates?: number;
    driverPayments?: number;
    vans?: number;
    contracts?: number;
    parts?: number;
    maintenanceRecords?: number;
  };
}

export interface Depot {
  name: string;
  address: string;
}

export interface CreateOrganizationDto {
  name: string;
  slug: string;
  address?: string;
  city?: string;
  postcode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxId?: string;
  registrationNumber?: string;
  vatNumber?: string;
  companyRegNumber?: string;
  logoBase64?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankSortCode?: string;
  iban?: string;
  swiftCode?: string;
  termsAndConditions?: string;
  footerText?: string;
  invoicePrefix?: string;
  invoiceFooter?: string;
  depots?: Depot[];
}

export interface UpdateOrganizationDto extends Partial<CreateOrganizationDto> {
  isActive?: boolean;
}
