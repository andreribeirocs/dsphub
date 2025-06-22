import { Component, OnInit, OnDestroy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import { AuthService, User } from "../../../core/services/auth.service";

@Component({
  selector: "app-dashboard",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./dashboard.component.html",
})
export class DashboardComponent implements OnInit, OnDestroy {
  constructor(private authService: AuthService) {}

  user: User | null = null;
  loading = false;
  private userSubscription?: Subscription;
  private loadingSubscription?: Subscription;

  ngOnInit(): void {
    // Subscribe to loading state
    this.loadingSubscription = this.authService.loading$.subscribe(
      (loading) => {
        this.loading = loading;
      }
    );

    // Subscribe to the user observable to get updates when user data is loaded
    this.userSubscription = this.authService.currentUser$.subscribe((user) => {
      this.user = user;
    });
  }

  ngOnDestroy(): void {
    // Clean up subscriptions to prevent memory leaks
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
    if (this.loadingSubscription) {
      this.loadingSubscription.unsubscribe();
    }
  }

  // Method to retry loading user profile
  retryLoadProfile(): void {
    this.authService.retryLoadUserProfile();
  }

  // Check if user is logged in but profile data is missing
  get hasTokenButNoUser(): boolean {
    return !!this.authService.token && !this.user && !this.loading;
  }
}
