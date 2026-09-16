import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router } from "@angular/router";
import { DriverService } from "./drivers.service";
import { Driver, PerformanceMetrics } from "./drivers.model";
// Chart imports removed as they're not used in this component

@Component({
  selector: "app-driver-details",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./driver-details.component.html",
  styles: [],
})
export class DriverDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly driverService = inject(DriverService);

  driver: Driver | null = null;
  performance: PerformanceMetrics | null = null;

  ngOnInit() {
    const driverId = this.route.snapshot.paramMap.get("id");
    if (driverId) {
      this.loadDriverDetails(driverId);
      this.loadMockPerformanceData();
    }
  }

  loadDriverDetails(id: string) {
    this.driverService.getDriverById(id).subscribe({
      next: (driver) => {
        this.driver = driver;
      },
      error: (error) => {
        console.error("Error loading driver details:", error);
      },
    });
  }

  loadMockPerformanceData() {
    // Mock data for Mario
    this.performance = {
      currentWeek: {
        deliveries: 1135,
        dcr: 99.91,
        pod: 99.15,
        cdf: 90.49,
      },
      weeklyTrends: {
        dcr: [97.42, 99.66, 98.09, 99.91],
        pod: [78.95, 99.7, 99.57, 99.15],
        cc: [63.16, 100, 100, 100],
        cdf: [87.61, 94.84, 74.97, 90.49],
      },
      weeklyDeliveries: [868, 1160, 1132, 1135],
      weeklyPerformance: [], // Not used in this view
      targets: {
        dcr: 98.5,
        pod: 95,
        cc: 95,
        cdf: 95,
      },
      improvementAreas: {
        critical: [],
        performance: [],
        training: [],
      },
    };
  }

  goBack() {
    this.router.navigate(["/drivers"]);
  }

  editDriver() {
    if (this.driver) {
      this.router.navigate(["/drivers", this.driver.id, "edit"]);
    }
  }

  getInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  }

  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      case "expired":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }
}
