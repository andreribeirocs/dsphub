// src/app/layout/main-layout/main-layout.component.ts
import {
  Component,
  signal,
  inject,
  computed,
  HostListener,
  ElementRef,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { toSignal } from "@angular/core/rxjs-interop";
import { AuthService, User } from "../../../core/services/auth.service";
import { NgxSonnerToaster } from "ngx-sonner";

@Component({
  selector: "app-main-layout",
  standalone: true,
  imports: [CommonModule, RouterModule, NgxSonnerToaster],
  templateUrl: "./main-layout.component.html",
  styleUrls: ["./main-layout.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly elementRef = inject(ElementRef);

  readonly isSidebarOpen = signal(true);
  readonly isProfileMenuOpen = signal(false);
  readonly isMobileMenuOpen = signal(false);
  readonly user = toSignal(this.authService.currentUser$, {
    initialValue: null as User | null,
  });

  // Convert getters to computed signals for better performance
  readonly isDirector = computed(() => this.user()?.role === "DIRECTOR");
  readonly isRecruitmentManager = computed(
    () => this.user()?.role === "MANAGER_RECRUITMENT" || this.isDirector()
  );
  readonly isFleetManager = computed(
    () => this.user()?.role === "MANAGER_FLEET" || this.isDirector()
  );
  readonly isFinancialManager = computed(
    () => this.user()?.role === "MANAGER_FINANCIAL" || this.isDirector()
  );
  readonly isOnsiteManager = computed(
    () => this.user()?.role === "MANAGER_ONSITE" || this.isDirector()
  );

  toggleSidebar(): void {
    this.isSidebarOpen.update((value) => !value);
  }

  toggleProfileMenu(): void {
    this.isProfileMenuOpen.update((value) => !value);
  }

  logout(): void {
    this.authService.logout();
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((value) => !value);
  }

  @HostListener("document:click", ["$event"])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    const element = this.elementRef.nativeElement;

    // Close profile menu if clicking outside the profile dropdown container
    const profileContainer = element.querySelector(
      ".profile-dropdown-container"
    );
    if (profileContainer && !profileContainer.contains(target)) {
      this.isProfileMenuOpen.set(false);
    }

    // Close mobile menu if clicking outside
    if (!element.querySelector(".mobile-menu")?.contains(target)) {
      this.isMobileMenuOpen.set(false);
    }
  }
}
