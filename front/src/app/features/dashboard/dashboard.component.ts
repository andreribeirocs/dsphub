import { Component, inject, computed, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { AuthService, User } from "../../../core/services/auth.service";
import { AlertService } from "../../shared/services/alert.service";
import {
  DashboardService,
  RecentActivity,
  DashboardStats,
} from "./dashboard.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./dashboard.component.html",
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);
  private readonly dashboardService = inject(DashboardService);

  // Convert observables to signals
  readonly user = toSignal(this.authService.currentUser$, {
    initialValue: null as User | null,
  });
  readonly loading = toSignal(this.authService.loading$, {
    initialValue: false,
  });

  // Computed property for better logic encapsulation
  readonly hasTokenButNoUser = computed(
    () => !!this.authService.token && !this.user() && !this.loading()
  );

  // Dashboard data
  readonly recentActivities = toSignal(
    this.dashboardService.getRecentActivities(),
    {
      initialValue: [] as RecentActivity[],
    }
  );
  readonly dashboardStats = toSignal(
    this.dashboardService.getDashboardStats(),
    {
      initialValue: {
        activeDrivers: 0,
        completedRoutes: 0,
        pendingCandidates: 0,
        vehicleIssues: 0,
      } as DashboardStats,
    }
  );

  // Method to retry loading user profile
  retryLoadProfile(): void {
    this.authService.retryLoadUserProfile();
  }

  // Test methods for the new ngx-sonner alerts
  testSuccessAlert(): void {
    this.alertService.showSuccess(
      "Success!",
      "This is a success message using ngx-sonner positioned at top-center!"
    );
  }

  testErrorAlert(): void {
    this.alertService.showError(
      "Error!",
      "This is an error message with top-center positioning"
    );
  }

  testWarningAlert(): void {
    this.alertService.showWarning("Warning!", "This is a warning message");
  }

  testInfoAlert(): void {
    this.alertService.showInfo("Info", "This is an info message");
  }

  ngOnInit(): void {
    // Data will be loaded automatically via signals
  }

  getStatusClasses(status: string): string {
    const classes = {
      success: "bg-green-100 text-green-800",
      error: "bg-red-100 text-red-800",
      warning: "bg-yellow-100 text-yellow-800",
      info: "bg-blue-100 text-blue-800",
    };
    return (
      classes[status as keyof typeof classes] || "bg-gray-100 text-gray-800"
    );
  }

  getActivityIcon(type: string): string {
    const icons = {
      login: "🔐",
      payment: "💰",
      security: "🛡️",
      driver: "🚚",
      candidate: "👤",
      system: "⚙️",
    };
    return icons[type as keyof typeof icons] || "📝";
  }
}
