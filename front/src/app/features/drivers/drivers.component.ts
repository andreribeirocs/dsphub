import {
  Component,
  signal,
  computed,
  inject,
  effect,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { DriverService } from "./drivers.service";
import {
  Driver,
  DriverStats,
  DriverStatus,
  DocumentStatus,
  StatCard,
  ActivityItem,
} from "./drivers.model";
import { WhatsAppMessagingComponent } from "../whatsapp/whatsapp.component";

@Component({
  selector: "app-drivers",
  standalone: true,
  imports: [CommonModule, FormsModule, WhatsAppMessagingComponent],
  templateUrl: "./drivers.component.html",
  styleUrls: ["./drivers.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriversComponent {
  private readonly driverService = inject(DriverService);
  private readonly router = inject(Router);

  // Signals for reactive state management
  drivers = signal<Driver[]>([]);
  searchTerm = signal("");
  statusFilter = signal<string>("all");
  depotFilter = signal<string>("all");
  selectedDriver = signal<Driver | null>(null);
  activeTab = signal<string>("overview");
  showDriverModal = signal(false);

  // Computed values
  filteredDrivers = computed(() => {
    const drivers = this.drivers();
    const search = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    const depot = this.depotFilter();

    return drivers.filter((driver) => {
      const matchesSearch =
        search === "" ||
        driver.name.toLowerCase().includes(search) ||
        driver.email.toLowerCase().includes(search) ||
        driver.phone.includes(search);

      const matchesStatus = status === "all" || driver.status === status;
      const matchesDepot = depot === "all" || driver.depot === depot;

      return matchesSearch && matchesStatus && matchesDepot;
    });
  });

  stats = signal<StatCard[]>([
    {
      title: "Total Drivers",
      value: "124",
      change: "+12 this month",
      icon: "user",
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Active Drivers",
      value: "98",
      change: "79% of total",
      icon: "check-circle",
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Expiring Soon",
      value: "8",
      change: "Next 30 days",
      icon: "alert-circle",
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Pending Review",
      value: "5",
      change: "Requires action",
      icon: "file-text",
      color: "text-red-600",
      bgColor: "bg-red-100",
    },
  ]);

  recentActivities = signal<ActivityItem[]>([
    {
      id: 1,
      driver: "John Smith",
      action: "License Renewed - renewed until 2025",
      time: "2 hours ago",
      type: "success",
    },
    {
      id: 2,
      driver: "Sarah Johnson",
      action: "Medical Check Due - required by next week",
      time: "4 hours ago",
      type: "warning",
    },
    {
      id: 3,
      driver: "Mike Davis",
      action: "Background Check Complete - verification completed",
      time: "1 day ago",
      type: "success",
    },
    {
      id: 4,
      driver: "Emma Wilson",
      action: "Document Upload - insurance document uploaded",
      time: "2 days ago",
      type: "pending",
    },
    {
      id: 5,
      driver: "David Brown",
      action: "Status Update - changed to active",
      time: "3 days ago",
      type: "success",
    },
    {
      id: 6,
      driver: "Lisa Garcia",
      action: "Alert - multiple documents expiring soon",
      time: "3 days ago",
      type: "warning",
    },
  ]);

  // Effects for data loading
  private readonly loadDataEffect = effect(() => {
    this.loadDrivers();
    this.loadStats();
  });

  loadDrivers() {
    this.driverService.getDrivers().subscribe({
      next: (drivers: unknown[]) => {
        // Transform the backend data to match frontend expectations
        const transformedDrivers = drivers.map((driver) =>
          this.transformDriverData(driver)
        );
        this.drivers.set(transformedDrivers);
      },
      error: (error: unknown) => {
        console.error("Error loading drivers:", error);
      },
    });
  }

  // Transform backend driver data to frontend format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformDriverData(backendDriver: any): Driver {
    return {
      id: backendDriver.id,
      name: backendDriver.name,
      phone: backendDriver.phone,
      email: backendDriver.email,
      depot: backendDriver.depot,
      address: backendDriver.address,
      status: backendDriver.status,
      citizenship: backendDriver.citizenship,
      passportExpiry: this.formatDate(backendDriver.passportExpiry),
      licenseExpiry: this.formatDate(backendDriver.licenseExpiry),
      rtwExpiry: this.formatDate(backendDriver.rtwExpiry),
      points: backendDriver.points,
      lastCheck: this.formatDate(backendDriver.lastCheck),
      nextCheck: this.formatDate(backendDriver.nextCheck),
      age: backendDriver.age,
      hasEndorsements: backendDriver.hasEndorsements,
      joinDate: this.formatDate(backendDriver.joinDate),
      completionRate: backendDriver.completionRate,
      rating: backendDriver.rating,
      totalTrips: backendDriver.totalTrips,
      documents: {
        passport: this.mapDocumentStatus(backendDriver.passportStatus),
        license: this.mapDocumentStatus(backendDriver.licenseStatus),
        rtw: this.mapDocumentStatus(backendDriver.rtwStatus),
        medical: this.mapDocumentStatus(backendDriver.medicalStatus),
        dbs: this.mapDocumentStatus(backendDriver.dbsStatus),
      },
    };
  }

  // Map backend document status to frontend format
  mapDocumentStatus(backendStatus: string): DocumentStatus {
    switch (backendStatus?.toUpperCase()) {
      case "VERIFIED":
      case "VALID":
        return "valid";
      case "EXPIRING":
        return "expiring";
      case "EXPIRED":
        return "expired";
      case "PENDING":
        return "pending";
      default:
        return "pending";
    }
  }

  // Format date from backend to display format
  formatDate(dateString: string): string {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB"); // DD/MM/YYYY format
  }

  loadStats() {
    this.driverService.getStats().subscribe({
      next: (stats: DriverStats) => {
        this.stats.set([
          {
            title: "Total Drivers",
            value: stats.total.toString(),
            change: "+12 this month",
            icon: "user",
            color: "text-blue-600",
            bgColor: "bg-blue-100",
          },
          {
            title: "Active Drivers",
            value: stats.active.toString(),
            change: `${Math.round(
              (stats.active / stats.total) * 100
            )}% of total`,
            icon: "check-circle",
            color: "text-green-600",
            bgColor: "bg-green-100",
          },
          {
            title: "Expiring Soon",
            value: stats.expiring.toString(),
            change: "Next 30 days",
            icon: "alert-circle",
            color: "text-orange-600",
            bgColor: "bg-orange-100",
          },
          {
            title: "Pending Review",
            value: stats.pending.toString(),
            change: "Requires action",
            icon: "file-text",
            color: "text-red-600",
            bgColor: "bg-red-100",
          },
        ]);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (error: any) => {
        console.error("Error loading stats:", error);
      },
    });
  }

  onSearchChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchTerm.set(target.value);
  }

  onStatusFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.statusFilter.set(target.value);
  }

  onDepotFilterChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.depotFilter.set(target.value);
  }

  setActiveTab(tab: string) {
    this.activeTab.set(tab);
  }

  openDriverModal(driver: Driver) {
    this.selectedDriver.set(driver);
    this.showDriverModal.set(true);
  }

  closeDriverModal() {
    this.selectedDriver.set(null);
    this.showDriverModal.set(false);
  }

  getStatusBadgeClass(status: DriverStatus | string): string {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      case "expired":
      case "inactive":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  getDocumentStatusClass(status: DocumentStatus | string): string {
    switch (status) {
      case "valid":
        return "bg-green-100 text-green-800";
      case "expiring":
        return "bg-orange-100 text-orange-800";
      case "expired":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case "success":
        return "check-circle";
      case "warning":
        return "alert-circle";
      case "pending":
        return "clock";
      default:
        return "bell";
    }
  }

  getActivityIconColor(type: string): string {
    switch (type) {
      case "success":
        return "text-green-600";
      case "warning":
        return "text-orange-600";
      case "pending":
        return "text-yellow-600";
      default:
        return "text-blue-600";
    }
  }

  isExpiringSoon(dateStr: string): boolean {
    const date = new Date(dateStr.split("/").reverse().join("-"));
    const today = new Date();
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays >= 0;
  }

  getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("");
  }

  editDriver(driver: Driver) {
    console.log("Edit driver:", driver);
    // Implement edit functionality
  }

  deleteDriver(driver: Driver) {
    this.driverService.deleteDriver(driver.id).subscribe({
      next: () => {
        // Reload drivers after deletion
        this.loadDrivers();
        console.log("Driver deleted successfully");
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (error: any) => {
        console.error("Error deleting driver:", error);
      },
    });
  }

  exportData() {
    console.log("Export data");
    // Implement export functionality
  }

  addNewDriver() {
    console.log("Add new driver");
    // Implement add driver functionality
  }

  viewDriverDetails(driver: Driver) {
    this.router.navigate(["/drivers", driver.id]);
  }
}
