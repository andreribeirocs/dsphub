import { Component, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { AuthService, User } from "../../../core/services/auth.service";
import { AlertService } from "../../shared/services/alert.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./dashboard.component.html",
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly alertService = inject(AlertService);

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
}
