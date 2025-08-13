export type VanStatus = "BOOKED" | "DELIVERED" | "TBC" | "AVAILABLE" | "MAINTENANCE" | "OUT_OF_SERVICE";
export type VanCondition = "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "NEEDS_ATTENTION";
export type ContractStatus = "ACTIVE" | "REMOVED" | "BROKEN_DOWN" | "SUSPENDED" | "EXPIRED";
export type MaintenanceStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "OVERDUE";
export type MaintenancePriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Van {
  readonly id: string;
  readonly vanNumber: string;
  readonly registration: string;
  readonly make: string;
  readonly model: string;
  readonly year?: number;
  readonly status: VanStatus;
  readonly condition: VanCondition;
  readonly motExpiry?: string;
  readonly monthlyRental?: number;
  readonly contractId?: string;
  readonly contract?: Contract;
  readonly vin?: string;
  readonly engineNumber?: string;
  readonly fuelType?: string;
  readonly capacity?: string;
  readonly depot?: string;
  readonly assignedDriver?: string;
  readonly mileage?: number;
  readonly lastService?: string;
  readonly nextService?: string;
  readonly comments?: string;
  readonly motReminder?: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly maintenanceRecords?: MaintenanceRecord[];
}

export interface Contract {
  readonly id: string;
  readonly name: string;
  readonly depot: string;
  readonly hireName: string;
  readonly rentalRate: number;
  readonly status: ContractStatus;
  readonly hasInsurance: boolean;
  readonly supplier?: string;
  readonly startDate: string;
  readonly endDate?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly description?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly vans?: Van[];
}

export interface MaintenanceRecord {
  readonly id: string;
  readonly vanId: string;
  readonly van?: Pick<Van, 'id' | 'vanNumber' | 'registration' | 'make' | 'model' | 'status' | 'condition'>;
  readonly type: string;
  readonly description: string;
  readonly status: MaintenanceStatus;
  readonly priority: MaintenancePriority;
  readonly scheduledDate: string;
  readonly completedDate?: string;
  readonly estimatedCost?: number;
  readonly actualCost?: number;
  readonly workshop?: string;
  readonly workshopContact?: string;
  readonly partsUsed?: any[];
  readonly laborHours?: number;
  readonly notes?: string;
  readonly invoiceNumber?: string;
  readonly warrantyUntil?: string;
  readonly reminderSent: boolean;
  readonly isOverdue: boolean;
  readonly assignedTo?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Part {
  readonly id: string;
  readonly name: string;
  readonly category?: string;
  readonly fordPrice?: number;
  readonly mercedesPrice?: number;
  readonly peugeotPrice?: number;
  readonly partNumber?: string;
  readonly supplier?: string;
  readonly description?: string;
  readonly stockLevel: number;
  readonly minStockLevel: number;
  readonly maxStockLevel: number;
  readonly weight?: number;
  readonly dimensions?: string;
  readonly warrantyDays?: number;
  readonly isActive: boolean;
  readonly lastUpdated: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface VanStats {
  readonly total: number;
  readonly active: number;
  readonly booked: number;
  readonly maintenance: number;
  readonly expiringMot: number;
  readonly alerts: number;
  readonly totalRental: number;
}

export interface ContractStats {
  readonly total: number;
  readonly active: number;
  readonly expired: number;
  readonly broken: number;
  readonly totalRevenue: number;
}

export interface MaintenanceStats {
  readonly total: number;
  readonly scheduled: number;
  readonly inProgress: number;
  readonly overdue: number;
  readonly completed: number;
  readonly totalCost: number;
}

export interface PartsStats {
  readonly total: number;
  readonly active: number;
  readonly lowStock: number;
  readonly categories: number;
  readonly totalValue: number;
}

export interface PartPrice {
  readonly partId: string;
  readonly partName: string;
  readonly fordPrice: number | null;
  readonly mercedesPrice: number | null;
  readonly peugeotPrice: number | null;
}

export interface StatCard {
  readonly title: string;
  readonly value: string;
  readonly subtitle: string;
  readonly icon: string;
  readonly color: string;
  readonly bgColor: string;
}

export interface MaintenanceAlert {
  readonly id: string;
  readonly van: Pick<Van, 'vanNumber' | 'registration' | 'make' | 'model'>;
  readonly type: string;
  readonly description: string;
  readonly priority: MaintenancePriority;
  readonly scheduledDate: string;
  readonly isOverdue: boolean;
}

// DTOs for API requests
export interface CreateVanRequest {
  readonly vanNumber: string;
  readonly registration: string;
  readonly make: string;
  readonly model: string;
  readonly year?: number;
  readonly status?: VanStatus;
  readonly condition?: VanCondition;
  readonly motExpiry?: string;
  readonly contractId?: string;
  readonly monthlyRental?: string;
  readonly vin?: string;
  readonly engineNumber?: string;
  readonly fuelType?: string;
  readonly capacity?: string;
  readonly depot?: string;
  readonly assignedDriver?: string;
  readonly mileage?: number;
  readonly lastService?: string;
  readonly nextService?: string;
  readonly comments?: string;
  readonly motReminder?: boolean;
}

export interface UpdateVanRequest extends Partial<CreateVanRequest> {}

export interface GetVansQuery {
  readonly status?: VanStatus;
  readonly condition?: VanCondition;
  readonly depot?: string;
  readonly contract?: string;
  readonly search?: string;
  readonly expiringMot?: boolean;
  readonly maintenanceAlerts?: boolean;
  readonly make?: string;
}

export interface CreateContractRequest {
  readonly name: string;
  readonly depot: string;
  readonly hireName: string;
  readonly rentalRate: string;
  readonly startDate: string;
  readonly status?: ContractStatus;
  readonly hasInsurance?: boolean;
  readonly supplier?: string;
  readonly endDate?: string;
  readonly contactEmail?: string;
  readonly contactPhone?: string;
  readonly description?: string;
}

export interface UpdateContractRequest extends Partial<CreateContractRequest> {}

export interface GetContractsQuery {
  readonly status?: ContractStatus;
  readonly depot?: string;
  readonly supplier?: string;
  readonly search?: string;
}

export interface CreateMaintenanceRequest {
  readonly vanId: string;
  readonly type: string;
  readonly description: string;
  readonly scheduledDate: string;
  readonly status?: MaintenanceStatus;
  readonly priority?: MaintenancePriority;
  readonly estimatedCost?: string;
  readonly workshop?: string;
  readonly workshopContact?: string;
  readonly notes?: string;
  readonly assignedTo?: string;
}

export interface UpdateMaintenanceRequest extends Partial<CreateMaintenanceRequest> {
  readonly completedDate?: string;
  readonly actualCost?: string;
  readonly laborHours?: string;
  readonly invoiceNumber?: string;
  readonly warrantyUntil?: string;
}

export interface GetMaintenanceQuery {
  readonly vanId?: string;
  readonly status?: MaintenanceStatus;
  readonly priority?: MaintenancePriority;
  readonly type?: string;
  readonly overdueOnly?: boolean;
  readonly upcomingOnly?: boolean;
}

export interface CreatePartRequest {
  readonly name: string;
  readonly category?: string;
  readonly fordPrice?: string;
  readonly mercedesPrice?: string;
  readonly peugeotPrice?: string;
  readonly partNumber?: string;
  readonly supplier?: string;
  readonly description?: string;
  readonly stockLevel?: number;
  readonly minStockLevel?: number;
  readonly maxStockLevel?: number;
  readonly weight?: string;
  readonly dimensions?: string;
  readonly warrantyDays?: number;
  readonly isActive?: boolean;
}

export interface UpdatePartRequest extends Partial<CreatePartRequest> {}

export interface GetPartsQuery {
  readonly category?: string;
  readonly search?: string;
  readonly supplier?: string;
  readonly activeOnly?: boolean;
  readonly lowStockOnly?: boolean;
  readonly vehicleMake?: string;
}