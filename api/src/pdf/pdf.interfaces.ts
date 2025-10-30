export interface InvoiceData {
  readonly invoiceNumber: string;
  readonly invoiceDate: string;
  readonly driverName: string;
  readonly transporterId: string;
  readonly driverAddress?: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly items: readonly InvoiceItem[];
  readonly subtotal: string;
  readonly extras?: string;
  readonly deductions?: string;
  readonly vanCharges?: string;
  readonly total: string;
  readonly currency: string;
  readonly notes?: string;
}

export interface InvoiceItem {
  readonly date: string;
  readonly description: string;
  readonly routeType: string;
  readonly routeCode?: string;
  readonly amount: string;
}

export interface SevenDaysInvoiceData {
  // Organization details
  readonly organization: {
    readonly name: string;
    readonly address?: string;
    readonly city?: string;
    readonly postcode?: string;
    readonly country?: string;
    readonly phone?: string;
    readonly companyRegNumber?: string;
    readonly vatNumber?: string;
    readonly logoBase64?: string;
  };
  // Driver details
  readonly driver: {
    readonly name: string;
    readonly address: string;
    readonly transporterId: string;
  };
  // Invoice metadata
  readonly statementDate: string; // e.g., "04-10-2025"
  readonly dueDate: string; // e.g., "18-10-2025"
  readonly weekNumber: number; // e.g., 40
  readonly weekPeriod: string; // e.g., "28-09-2025 - 04-10-2025"
  readonly invoiceNumber: string;
  readonly deliveryServiceTypes: string[]; // e.g., ["DXW3", "DRG3"]
  readonly amzlSite?: string;
  // Earnings summary
  readonly earnings: {
    readonly items: readonly {
      readonly period: string;
      readonly ds: string;
      readonly totalEarnings: number; // VAT inc
    }[];
    readonly totalDeductions: number;
    readonly invoiceTotal: number;
  };
  // Deductions
  readonly deductions: {
    readonly vehicleHireTotal: number;
    readonly items: readonly {
      readonly type: string;
      readonly description?: string;
      readonly amount: number;
      readonly vat: number;
      readonly total: number;
    }[];
    readonly total: number;
  };
  // Fuel breakdown
  readonly fuelBreakdown: readonly {
    readonly date: string;
    readonly fuelCost: number;
    readonly vat: number;
    readonly admFee: number;
    readonly total: number;
  }[];
  // Vehicle rental
  readonly vehicleRental: {
    readonly vehicleHireCosts: readonly {
      readonly date: string;
      readonly description: string;
      readonly rate: number;
      readonly vat: number;
      readonly total: number;
    }[];
    readonly insurancePackCosts: readonly {
      readonly date: string;
      readonly description: string;
      readonly rate: number;
    }[];
    readonly tollCharges: readonly {
      readonly journeyDate: string;
      readonly vehReg: string;
      readonly chargeType: string;
      readonly transactionId: string;
      readonly chargeAmount: number;
    }[];
    readonly totalVehicleRental: number;
  };
  // Self billing invoice (detailed services)
  readonly services: readonly {
    readonly date: string;
    readonly routeTypeStopRate: string;
    readonly route: string;
    readonly rate: number;
    readonly incentive: number;
    readonly mileage: number;
    readonly mileageCost: number;
    readonly byod: number;
    readonly total: number;
  }[];
  // Extras and deductions for self billing
  readonly extrasAndDeductions: readonly {
    readonly date: string;
    readonly description: string;
    readonly toolCharge: number;
    readonly additional: number;
    readonly deductions: number;
    readonly total: number;
  }[];
  // Refunds
  readonly refunds: {
    readonly items: readonly {
      readonly description: string;
      readonly relatedSBI: string;
      readonly amount: number;
    }[];
    readonly total: number;
    readonly vat20: number;
    readonly refunds: number;
    readonly toolCharge: number;
    readonly totalVATInc: number;
  };
  // Final totals
  readonly finalDeductions: number;
  readonly netPayment: number;
  readonly finalDueDate: string;
}
