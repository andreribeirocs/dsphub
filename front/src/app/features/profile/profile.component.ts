import { Component, signal, inject, ChangeDetectionStrategy, effect } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from "@angular/forms";
import { HttpClient } from "@angular/common/http";
import { toSignal } from "@angular/core/rxjs-interop";
import { AuthService, User } from "../../../core/services/auth.service";
import { environment } from "../../../environments/environment";
import { AlertService } from "../../shared/services/alert.service";
import { apiErrorMessage } from "../../shared/utils/api-error";

interface AvatarUploadResponse {
  message: string;
  avatar: string;
}

export interface LoginHistoryItem {
  id: string;
  attemptedAt: string;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
}

const ROLE_NAMES: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  DIRECTOR: "Director",
  MANAGER_FINANCIAL: "Financial Manager",
  MANAGER_FLEET: "Fleet Manager",
  MANAGER_ONSITE: "Onsite Manager",
  MANAGER_RECRUITMENT: "Recruitment Manager",
  DRIVER: "Driver",
};

const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-red-100 text-red-800",
  PENDING: "bg-yellow-100 text-yellow-800",
};

function passwordMatchValidator(form: AbstractControl): ValidationErrors | null {
  const newPassword = form.get("newPassword")?.value;
  const confirmPassword = form.get("confirmPassword")?.value;
  return newPassword && confirmPassword && newPassword !== confirmPassword
    ? { passwordMismatch: true }
    : null;
}

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./profile.component.html",
  styleUrls: ["./profile.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly alertService = inject(AlertService);
  private readonly usersUrl = `${environment.apiUrl}/users`;

  readonly user = toSignal(this.authService.currentUser$, {
    initialValue: null as User | null,
  });

  readonly updating = signal(false);
  readonly changingPassword = signal(false);
  readonly uploadingAvatar = signal(false);
  readonly avatarUrl = signal<string | null>(null);

  readonly showLoginHistory = signal(false);
  readonly loginHistory = signal<LoginHistoryItem[]>([]);
  readonly loginHistoryLoading = signal(false);
  readonly loginHistoryError = signal("");

  readonly profileForm = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    // The sign-in email is changed by a director in Admin > Users
    email: [{ value: "", disabled: true }],
    phoneNumber: ["", [Validators.maxLength(30)]],
  });

  readonly passwordForm = this.fb.nonNullable.group(
    {
      currentPassword: ["", [Validators.required]],
      newPassword: ["", [Validators.required, Validators.minLength(8)]],
      confirmPassword: ["", [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  constructor() {
    effect(() => {
      const userData = this.user();
      if (userData) {
        this.profileForm.patchValue({
          name: userData.name,
          email: userData.email,
          phoneNumber: userData.phoneNumber || "",
        });
        if (userData.avatar) {
          this.avatarUrl.set(userData.avatar);
        }
      }
    });
  }

  updateProfile(): void {
    if (this.profileForm.invalid || !this.user()) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.updating.set(true);
    const { name, phoneNumber } = this.profileForm.getRawValue();

    this.http.patch(`${this.usersUrl}/me`, { name, phoneNumber }).subscribe({
      next: () => {
        this.updating.set(false);
        this.alertService.showSuccess("Profile updated");
        this.authService.refreshUserProfile().subscribe();
      },
      error: (error: unknown) => {
        this.updating.set(false);
        this.alertService.showError("Could not update profile", apiErrorMessage(error, "Please try again."));
      },
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid || !this.user()) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    this.changingPassword.set(true);
    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    // better-auth checks the current password before changing it
    this.http
      .post(`${environment.apiUrl}/auth/change-password`, {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      })
      .subscribe({
        next: () => {
          this.changingPassword.set(false);
          this.passwordForm.reset();
          this.alertService.showSuccess("Password changed", "Other devices were signed out.");
        },
        error: (error: unknown) => {
          this.changingPassword.set(false);
          this.alertService.showError(
            "Could not change password",
            apiErrorMessage(error, "Check your current password and try again.")
          );
        },
      });
  }

  getRoleDisplayName(role: string): string {
    return ROLE_NAMES[role] || role;
  }

  getStatusBadgeClasses(status: string): string {
    return STATUS_CLASSES[status] || "bg-gray-100 text-gray-800";
  }

  getUserStatus(): string {
    return this.user()?.status || "ACTIVE";
  }

  getLastLoginText(): string {
    const lastLoginValue = this.user()?.lastLogin;
    if (!lastLoginValue) {
      return "—";
    }
    const lastLogin = new Date(lastLoginValue);
    const diffInMinutes = Math.floor((Date.now() - lastLogin.getTime()) / 60000);
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return lastLogin.toLocaleDateString();
  }

  onAvatarUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !this.user()) {
      return;
    }
    this.uploadingAvatar.set(true);
    const formData = new FormData();
    formData.append("avatar", file);

    this.http.patch<AvatarUploadResponse>(`${this.usersUrl}/avatar`, formData).subscribe({
      next: (response) => {
        this.uploadingAvatar.set(false);
        if (response.avatar) {
          this.avatarUrl.set(response.avatar);
        }
        this.authService.refreshUserProfile().subscribe();
        this.alertService.showSuccess("Photo updated");
      },
      error: (error: unknown) => {
        this.uploadingAvatar.set(false);
        this.alertService.showError("Could not upload photo", apiErrorMessage(error, "Use an image up to 5 MB."));
      },
    });
  }

  triggerAvatarUpload(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (event) => this.onAvatarUpload(event);
    input.click();
  }

  toggleLoginHistory(): void {
    const open = !this.showLoginHistory();
    this.showLoginHistory.set(open);
    if (open) {
      this.loadLoginHistory();
    }
  }

  loadLoginHistory(): void {
    this.loginHistoryLoading.set(true);
    this.loginHistoryError.set("");
    this.http.get<LoginHistoryItem[]>(`${this.usersUrl}/me/login-history`).subscribe({
      next: (items) => {
        this.loginHistory.set(items);
        this.loginHistoryLoading.set(false);
      },
      error: (error: unknown) => {
        this.loginHistoryError.set(apiErrorMessage(error, "Could not load sign-in history."));
        this.loginHistoryLoading.set(false);
      },
    });
  }

  /** Short device description from the user agent */
  describeDevice(userAgent: string | null): string {
    if (!userAgent) return "Unknown device";
    const browser = /Edg\//.test(userAgent)
      ? "Edge"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Firefox\//.test(userAgent)
          ? "Firefox"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "Browser";
    const os = /Windows/.test(userAgent)
      ? "Windows"
      : /Android/.test(userAgent)
        ? "Android"
        : /iPhone|iPad/.test(userAgent)
          ? "iOS"
          : /Mac OS X/.test(userAgent)
            ? "macOS"
            : /Linux/.test(userAgent)
              ? "Linux"
              : "";
    return os ? `${browser} on ${os}` : browser;
  }
}
