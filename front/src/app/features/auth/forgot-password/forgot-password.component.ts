import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService } from "../../../../core/services/auth.service";

@Component({
  selector: "app-forgot-password",
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
          <div class="mb-6">
            <h2 class="text-center text-3xl font-extrabold text-gray-900">
              Reset your password
            </h2>
            <p class="mt-2 text-center text-sm text-gray-600">
              Enter your phone number and we'll send you a reset link via
              WhatsApp
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
          }

          <form
            [formGroup]="forgotPasswordForm"
            (ngSubmit)="onSubmit()"
            class="space-y-6"
          >
            <div>
              <label
                for="phoneNumber"
                class="block text-sm font-medium text-gray-700"
              >
                Phone Number
              </label>
              <div class="mt-1 relative">
                <div
                  class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                >
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
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                </div>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  formControlName="phoneNumber"
                  placeholder="+1234567890"
                  class="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  [class.border-red-300]="
                    forgotPasswordForm.get('phoneNumber')?.invalid &&
                    forgotPasswordForm.get('phoneNumber')?.touched
                  "
                />
              </div>
              @if (forgotPasswordForm.get('phoneNumber')?.invalid &&
              forgotPasswordForm.get('phoneNumber')?.touched) {
              <p class="mt-2 text-sm text-red-600">
                @if
                (forgotPasswordForm.get('phoneNumber')?.errors?.['required']) {
                Phone number is required } @if
                (forgotPasswordForm.get('phoneNumber')?.errors?.['pattern']) {
                Please provide a valid phone number in international format
                (e.g., +1234567890) }
              </p>
              }
            </div>

            <div>
              <button
                type="submit"
                [disabled]="loading() || forgotPasswordForm.invalid"
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
                Sending... } @else { Send Reset Link
                <svg
                  class="ml-2 -mr-1 w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"
                  />
                  <path
                    d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"
                  />
                </svg>
                }
              </button>
            </div>
          </form>

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

          <div class="mt-8 text-center">
            <p class="text-sm text-gray-500">
              Need help?
              <a href="#" class="font-medium text-blue-600 hover:text-blue-500">
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class ForgotPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly forgotPasswordForm: FormGroup = this.formBuilder.group({
    phoneNumber: [
      "",
      [Validators.required, Validators.pattern(/^\+?[1-9]\d{1,14}$/)],
    ],
  });

  readonly loading = signal(false);
  readonly error = signal("");
  readonly success = signal(false);
  readonly successMessage = signal("");

  onSubmit(): void {
    if (this.forgotPasswordForm.invalid) {
      return;
    }

    this.loading.set(true);
    this.error.set("");
    this.success.set(false);

    const { phoneNumber } = this.forgotPasswordForm.value;

    this.authService.forgotPassword(phoneNumber).subscribe({
      next: (response) => {
        this.success.set(true);
        this.successMessage.set(response.message);
        this.loading.set(false);
        this.forgotPasswordForm.reset();
      },
      error: (error) => {
        this.error.set(error.message || "Failed to send reset link");
        this.loading.set(false);
      },
    });
  }

  goToLogin(): void {
    this.router.navigate(["/login"]);
  }
}
