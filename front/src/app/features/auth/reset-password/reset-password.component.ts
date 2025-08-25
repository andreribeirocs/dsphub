import { Component, inject, signal, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import { AuthService } from "../../../../core/services/auth.service";

@Component({
  selector: "app-reset-password",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div
      class="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8"
    >
      <div class="sm:mx-auto sm:w-full sm:max-w-md">
        <div class="flex justify-center">
          <div class="flex items-center">
            <div
              class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3"
            >
              <svg
                class="w-5 h-5 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  d="M10 2L3 7v11a1 1 0 001 1h3v-7h6v7h3a1 1 0 001-1V7l-7-5z"
                />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-gray-900">DSPHub</h1>
          </div>
        </div>
        <p class="mt-2 text-center text-sm text-gray-600">
          Connecting everything
        </p>
      </div>

      <div class="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div class="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          @if (tokenValid()) {
          <div class="mb-6">
            <h2 class="text-center text-3xl font-extrabold text-gray-900">
              Set new password
            </h2>
            <p class="mt-2 text-center text-sm text-gray-600">
              Enter your new password below
            </p>
          </div>

          @if (success()) {
          <div class="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg
                  class="h-5 w-5 text-green-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-green-800">
                  {{ successMessage() }}
                </p>
                <p class="mt-2 text-sm text-green-700">
                  You will be redirected to the login page in
                  {{ countdown() }} seconds...
                </p>
              </div>
            </div>
          </div>
          } @if (error()) {
          <div class="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
            <div class="flex">
              <div class="flex-shrink-0">
                <svg
                  class="h-5 w-5 text-red-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
              <div class="ml-3">
                <p class="text-sm font-medium text-red-800">
                  {{ error() }}
                </p>
              </div>
            </div>
          </div>
          } @if (!success()) {
          <form
            [formGroup]="resetPasswordForm"
            (ngSubmit)="onSubmit()"
            class="space-y-6"
          >
            <div>
              <label
                for="newPassword"
                class="block text-sm font-medium text-gray-700"
              >
                New Password
              </label>
              <div class="mt-1 relative">
                <input
                  id="newPassword"
                  name="newPassword"
                  [type]="passwordVisible() ? 'text' : 'password'"
                  formControlName="newPassword"
                  placeholder="Enter your new password"
                  class="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  [class.border-red-300]="
                    resetPasswordForm.get('newPassword')?.invalid &&
                    resetPasswordForm.get('newPassword')?.touched
                  "
                />
                <button
                  type="button"
                  (click)="togglePasswordVisibility()"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  @if (passwordVisible()) {
                  <svg
                    class="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                    />
                  </svg>
                  } @else {
                  <svg
                    class="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  }
                </button>
              </div>
              @if (resetPasswordForm.get('newPassword')?.invalid &&
              resetPasswordForm.get('newPassword')?.touched) {
              <p class="mt-2 text-sm text-red-600">
                @if (resetPasswordForm.get('newPassword')?.errors?.['required'])
                { Password is required } @if
                (resetPasswordForm.get('newPassword')?.errors?.['minlength']) {
                Password must be at least 8 characters long }
              </p>
              }
            </div>

            <div>
              <label
                for="confirmPassword"
                class="block text-sm font-medium text-gray-700"
              >
                Confirm New Password
              </label>
              <div class="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  [type]="confirmPasswordVisible() ? 'text' : 'password'"
                  formControlName="confirmPassword"
                  placeholder="Confirm your new password"
                  class="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  [class.border-red-300]="
                    resetPasswordForm.get('confirmPassword')?.invalid &&
                    resetPasswordForm.get('confirmPassword')?.touched
                  "
                />
                <button
                  type="button"
                  (click)="toggleConfirmPasswordVisibility()"
                  class="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  @if (confirmPasswordVisible()) {
                  <svg
                    class="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                    />
                  </svg>
                  } @else {
                  <svg
                    class="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                  }
                </button>
              </div>
              @if (resetPasswordForm.get('confirmPassword')?.invalid &&
              resetPasswordForm.get('confirmPassword')?.touched) {
              <p class="mt-2 text-sm text-red-600">
                @if
                (resetPasswordForm.get('confirmPassword')?.errors?.['required'])
                { Please confirm your password } @if
                (resetPasswordForm.get('confirmPassword')?.errors?.['passwordMismatch'])
                { Passwords do not match }
              </p>
              }
            </div>

            <div>
              <button
                type="submit"
                [disabled]="loading() || resetPasswordForm.invalid"
                class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (loading()) {
                <svg
                  class="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Resetting Password... } @else { Reset Password
                <svg
                  class="ml-2 -mr-1 w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fill-rule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clip-rule="evenodd"
                  />
                </svg>
                }
              </button>
            </div>
          </form>
          } } @else {
          <div class="text-center">
            <div
              class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100"
            >
              <svg
                class="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 class="mt-2 text-sm font-medium text-gray-900">
              Invalid or Expired Token
            </h3>
            <p class="mt-1 text-sm text-gray-500">
              {{
                tokenError() ||
                  "The password reset link is invalid or has expired."
              }}
            </p>
            <div class="mt-6">
              <button
                type="button"
                (click)="goToForgotPassword()"
                class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Request New Reset Link
              </button>
            </div>
          </div>
          }

          <div class="mt-6">
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-300"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-white text-gray-500"
                  >Remember your password?</span
                >
              </div>
            </div>

            <div class="mt-6">
              <button
                type="button"
                (click)="goToLogin()"
                class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ResetPasswordComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly resetPasswordForm: FormGroup = this.formBuilder.group(
    {
      newPassword: ["", [Validators.required, Validators.minLength(8)]],
      confirmPassword: ["", [Validators.required]],
    },
    { validators: this.passwordMatchValidator }
  );

  readonly loading = signal(false);
  readonly error = signal("");
  readonly success = signal(false);
  readonly successMessage = signal("");
  readonly passwordVisible = signal(false);
  readonly confirmPasswordVisible = signal(false);
  readonly tokenValid = signal(false);
  readonly tokenError = signal("");
  readonly countdown = signal(5);

  private token = "";
  private countdownInterval?: number;

  ngOnInit(): void {
    // Get token from URL parameters
    this.token = this.route.snapshot.queryParams["token"];

    if (!this.token) {
      this.tokenError.set("No reset token provided in the URL.");
      return;
    }

    // Verify the token
    this.verifyToken();
  }

  private verifyToken(): void {
    this.authService.verifyResetToken(this.token).subscribe({
      next: (response) => {
        if (response.valid) {
          this.tokenValid.set(true);
        } else {
          this.tokenError.set(response.message || "Invalid token");
        }
      },
      error: (error) => {
        this.tokenError.set(error.message || "Failed to verify token");
      },
    });
  }

  private passwordMatchValidator(form: FormGroup) {
    const password = form.get("newPassword");
    const confirmPassword = form.get("confirmPassword");

    if (
      password &&
      confirmPassword &&
      password.value !== confirmPassword.value
    ) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      if (confirmPassword?.errors?.["passwordMismatch"]) {
        delete confirmPassword.errors["passwordMismatch"];
        if (Object.keys(confirmPassword.errors).length === 0) {
          confirmPassword.setErrors(null);
        }
      }
    }
    return null;
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((value) => !value);
  }

  toggleConfirmPasswordVisibility(): void {
    this.confirmPasswordVisible.update((value) => !value);
  }

  onSubmit(): void {
    if (this.resetPasswordForm.invalid || !this.token) {
      return;
    }

    this.loading.set(true);
    this.error.set("");

    const { newPassword } = this.resetPasswordForm.value;

    this.authService.resetPassword(this.token, newPassword).subscribe({
      next: (response) => {
        this.success.set(true);
        this.successMessage.set(response.message);
        this.loading.set(false);
        this.resetPasswordForm.reset();
        this.startCountdown();
      },
      error: (error) => {
        this.error.set(error.message || "Failed to reset password");
        this.loading.set(false);
      },
    });
  }

  private startCountdown(): void {
    this.countdownInterval = window.setInterval(() => {
      const current = this.countdown();
      if (current > 1) {
        this.countdown.set(current - 1);
      } else {
        this.clearCountdown();
        this.goToLogin();
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
    }
  }

  goToLogin(): void {
    this.clearCountdown();
    this.router.navigate(["/login"]);
  }

  goToForgotPassword(): void {
    this.router.navigate(["/forgot-password"]);
  }

  ngOnDestroy(): void {
    this.clearCountdown();
  }
}
