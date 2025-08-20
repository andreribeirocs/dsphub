import {
  Component,
  signal,
  inject,
  ChangeDetectionStrategy,
  effect,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from "@angular/forms";
import { AuthService, User } from "../../../core/services/auth.service";
import { toSignal } from "@angular/core/rxjs-interop";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";

interface ExtendedUser extends User {
  phoneNumber?: string;
  lastLogin?: Date;
  status?: string;
  twoFactorEnabled?: boolean;
}

@Component({
  selector: "app-profile",
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: "./profile.component.html",
  styleUrls: ["./profile.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/users`;

  readonly user = toSignal(this.authService.currentUser$, {
    initialValue: null as User | null,
  });

  readonly updating = signal(false);
  readonly changingPassword = signal(false);
  readonly uploadingAvatar = signal(false);

  readonly profileForm: FormGroup = this.fb.group({
    name: ["", [Validators.required, Validators.minLength(2)]],
    email: ["", [Validators.required, Validators.email]],
    phoneNumber: [""],
  });

  readonly passwordForm: FormGroup = this.fb.group(
    {
      currentPassword: ["", [Validators.required]],
      newPassword: ["", [Validators.required, Validators.minLength(8)]],
      confirmPassword: ["", [Validators.required]],
    },
    { validators: this.passwordMatchValidator }
  );

  constructor() {
    // Effect to update form when user data changes
    effect(() => {
      const userData = this.user();
      if (userData) {
        this.profileForm.patchValue({
          name: userData.name,
          email: userData.email,
          phoneNumber: (userData as ExtendedUser).phoneNumber || "",
        });
      }
    });
  }

  updateProfile(): void {
    if (this.profileForm.valid && this.user()) {
      this.updating.set(true);
      const userId = this.user()!.id;
      const updateData = this.profileForm.value;

      this.http.patch(`${this.API_URL}/${userId}`, updateData).subscribe({
        next: (response) => {
          console.log("Profile updated successfully!", response);
          this.updating.set(false);
          // Refresh user profile to get updated data
          this.authService.refreshUserProfile().subscribe();
        },
        error: (error) => {
          console.error("Failed to update profile:", error);
          this.updating.set(false);
          // TODO: Show error message to user
        },
      });
    }
  }

  changePassword(): void {
    if (this.passwordForm.valid && this.user()) {
      this.changingPassword.set(true);
      const userId = this.user()!.id;
      const passwordData = {
        newPassword: this.passwordForm.value.newPassword,
      };

      this.http
        .patch(`${this.API_URL}/${userId}/password`, passwordData)
        .subscribe({
          next: (response) => {
            console.log("Password changed successfully!", response);
            this.changingPassword.set(false);
            this.passwordForm.reset();
            // TODO: Show success message to user
          },
          error: (error) => {
            console.error("Failed to change password:", error);
            this.changingPassword.set(false);
            // TODO: Show error message to user
          },
        });
    }
  }

  getRoleDisplayName(role: string): string {
    const displayNames = {
      DIRECTOR: "Director",
      MANAGER_FINANCIAL: "Financial Manager",
      MANAGER_FLEET: "Fleet Manager",
      MANAGER_ONSITE: "Onsite Manager",
      MANAGER_RECRUITMENT: "Recruitment Manager",
      DRIVER: "Driver",
    };
    return displayNames[role as keyof typeof displayNames] || role;
  }

  getStatusBadgeClasses(status: string): string {
    const classes = {
      ACTIVE: "bg-green-100 text-green-800",
      INACTIVE: "bg-red-100 text-red-800",
      PENDING: "bg-yellow-100 text-yellow-800",
    };
    return (
      classes[status as keyof typeof classes] || "bg-gray-100 text-gray-800"
    );
  }

  getUserStatus(): string {
    const userData = this.user() as ExtendedUser;
    return userData?.status || "ACTIVE";
  }

  getTwoFactorStatus(): boolean {
    const userData = this.user() as ExtendedUser;
    return userData?.twoFactorEnabled || false;
  }

  getLastLoginText(): string {
    const userData = this.user() as ExtendedUser;
    if (userData?.lastLogin) {
      const lastLogin = new Date(userData.lastLogin);
      const now = new Date();
      const diffInMinutes = Math.floor(
        (now.getTime() - lastLogin.getTime()) / (1000 * 60)
      );

      if (diffInMinutes < 1) return "Just now";
      if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
      if (diffInMinutes < 1440)
        return `${Math.floor(diffInMinutes / 60)} hours ago`;
      return lastLogin.toLocaleDateString();
    }
    return "Just now";
  }

  onAvatarUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file && this.user()) {
      this.uploadingAvatar.set(true);
      const formData = new FormData();
      formData.append("avatar", file);

      // TODO: Implement avatar upload API endpoint
      console.log("Uploading avatar:", file.name);

      // Simulate upload
      setTimeout(() => {
        this.uploadingAvatar.set(false);
        console.log("Avatar uploaded successfully!");
      }, 2000);
    }
  }

  triggerAvatarUpload(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (event) => this.onAvatarUpload(event);
    input.click();
  }

  enable2FA(): void {
    console.log("Enable 2FA clicked");
    // TODO: Implement 2FA setup flow
  }

  viewLoginHistory(): void {
    console.log("View login history clicked");
    // TODO: Navigate to login history page or show modal
  }

  manageApiKeys(): void {
    console.log("Manage API keys clicked");
    // TODO: Navigate to API keys management page or show modal
  }

  private passwordMatchValidator(form: FormGroup) {
    const newPassword = form.get("newPassword")?.value;
    const confirmPassword = form.get("confirmPassword")?.value;

    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      return { passwordMismatch: true };
    }

    return null;
  }
}
