// src/app/layout/main-layout/main-layout.component.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService, User } from '../../../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent {
  isSidebarOpen = signal(true);
  isProfileMenuOpen = signal(false);
  isMobileMenuOpen = signal(false);
  user: User | null = null;

  constructor(private authService: AuthService) {
    this.authService.currentUser$.subscribe((user) => {
      this.user = user;
    });
  }

  get isDirector(): boolean {
    return this.user?.role === 'DIRECTOR';
  }

  get isRecruitmentManager(): boolean {
    return this.user?.role === 'MANAGER_RECRUITMENT' || this.isDirector;
  }

  get isFleetManager(): boolean {
    return this.user?.role === 'MANAGER_FLEET' || this.isDirector;
  }

  get isFinancialManager(): boolean {
    return this.user?.role === 'MANAGER_FINANCIAL' || this.isDirector;
  }

  get isOnsiteManager(): boolean {
    return this.user?.role === 'MANAGER_ONSITE' || this.isDirector;
  }

  toggleSidebar() {
    console.log('Toggling sidebar, current state:', this.isSidebarOpen());
    this.isSidebarOpen.update((value) => !value);
    console.log('Sidebar state after toggle:', this.isSidebarOpen());
  }

  toggleProfileMenu() {
    this.isProfileMenuOpen.update((value) => !value);
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update((value) => !value);
  }

  logout() {
    this.authService.logout();
  }
}
