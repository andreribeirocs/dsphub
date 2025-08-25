import { Component, inject, signal, output } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { UsersService, CreateUserRequest, UserRole } from "./users.service";

@Component({
  selector: "app-create-user-modal",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
      (click)="onBackdropClick($event)"
    >
      <div
        class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white"
        (click)="$event.stopPropagation()"
      >
        <div class="mt-3">
          <!-- Header -->
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-lg font-medium text-gray-900">Create New User</h3>
            <button
              type="button"
              (click)="closeModal()"
              class="text-gray-400 hover:text-gray-600 focus:outline-none"
            >
              <svg
                class="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <!-- Success Message -->
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
                  User created successfully!
                </p>
              </div>
            </div>
          </div>
          }

          <!-- Error Message -->
          @if (error()) {
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

          <!-- Form -->
          @if (!success()) {
          <form
            [formGroup]="createUserForm"
            (ngSubmit)="onSubmit()"
            class="space-y-4"
          >
            <!-- Name Field -->
            <div>
              <label
                for="name"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Full Name *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                formControlName="name"
                placeholder="Enter full name"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                [class.border-red-300]="
                  createUserForm.get('name')?.invalid &&
                  createUserForm.get('name')?.touched
                "
              />
              @if (createUserForm.get('name')?.invalid &&
              createUserForm.get('name')?.touched) {
              <p class="mt-1 text-sm text-red-600">
                @if (createUserForm.get('name')?.errors?.['required']) { Name is
                required } @if
                (createUserForm.get('name')?.errors?.['minlength']) { Name must
                be at least 2 characters long } @if
                (createUserForm.get('name')?.errors?.['maxlength']) { Name
                cannot exceed 100 characters }
              </p>
              }
            </div>

            <!-- Email Field -->
            <div>
              <label
                for="email"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                formControlName="email"
                placeholder="Enter email address"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                [class.border-red-300]="
                  createUserForm.get('email')?.invalid &&
                  createUserForm.get('email')?.touched
                "
              />
              @if (createUserForm.get('email')?.invalid &&
              createUserForm.get('email')?.touched) {
              <p class="mt-1 text-sm text-red-600">
                @if (createUserForm.get('email')?.errors?.['required']) { Email
                is required } @if
                (createUserForm.get('email')?.errors?.['email']) { Please
                provide a valid email address }
              </p>
              }
            </div>

            <!-- Phone Number Field -->
            <div>
              <label
                for="phoneNumber"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Phone Number
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                formControlName="phoneNumber"
                placeholder="+1234567890"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                [class.border-red-300]="
                  createUserForm.get('phoneNumber')?.invalid &&
                  createUserForm.get('phoneNumber')?.touched
                "
              />
              @if (createUserForm.get('phoneNumber')?.invalid &&
              createUserForm.get('phoneNumber')?.touched) {
              <p class="mt-1 text-sm text-red-600">
                @if (createUserForm.get('phoneNumber')?.errors?.['pattern']) {
                Please provide a valid phone number in international format }
              </p>
              }
            </div>

            <!-- Role Field -->
            <div>
              <label
                for="role"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Role *
              </label>
              <select
                id="role"
                name="role"
                formControlName="role"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                [class.border-red-300]="
                  createUserForm.get('role')?.invalid &&
                  createUserForm.get('role')?.touched
                "
              >
                <option value="">Select a role</option>
                <option value="DIRECTOR">Director</option>
                <option value="MANAGER_FINANCIAL">Financial Manager</option>
                <option value="MANAGER_FLEET">Fleet Manager</option>
                <option value="MANAGER_ONSITE">Onsite Manager</option>
                <option value="MANAGER_RECRUITMENT">Recruitment Manager</option>
                <option value="DRIVER">Driver</option>
              </select>
              @if (createUserForm.get('role')?.invalid &&
              createUserForm.get('role')?.touched) {
              <p class="mt-1 text-sm text-red-600">
                @if (createUserForm.get('role')?.errors?.['required']) { Role is
                required }
              </p>
              }
            </div>

            <!-- Password Field -->
            <div>
              <label
                for="password"
                class="block text-sm font-medium text-gray-700 mb-1"
              >
                Password *
              </label>
              <div class="relative">
                <input
                  id="password"
                  name="password"
                  [type]="passwordVisible() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="Enter password"
                  class="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  [class.border-red-300]="
                    createUserForm.get('password')?.invalid &&
                    createUserForm.get('password')?.touched
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
              @if (createUserForm.get('password')?.invalid &&
              createUserForm.get('password')?.touched) {
              <p class="mt-1 text-sm text-red-600">
                @if (createUserForm.get('password')?.errors?.['required']) {
                Password is required } @if
                (createUserForm.get('password')?.errors?.['minlength']) {
                Password must be at least 8 characters long }
              </p>
              }
            </div>

            <!-- Form Actions -->
            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                (click)="closeModal()"
                class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                [disabled]="loading()"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="createUserForm.invalid || loading()"
                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (loading()) {
                <svg
                  class="animate-spin -ml-1 mr-3 h-4 w-4 text-white inline"
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
                Creating... } @else { Create User }
              </button>
            </div>
          </form>
          } @else {
          <!-- Success Actions -->
          <div class="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              (click)="createAnother()"
              class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create Another
            </button>
            <button
              type="button"
              (click)="closeModal()"
              class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Done
            </button>
          </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class CreateUserModalComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly usersService = inject(UsersService);

  // Outputs
  readonly close = output<void>();
  readonly userCreated = output<void>();

  // Signals
  readonly loading = signal(false);
  readonly error = signal("");
  readonly success = signal(false);
  readonly passwordVisible = signal(false);

  // Form
  readonly createUserForm: FormGroup = this.formBuilder.group({
    name: [
      "",
      [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    ],
    email: ["", [Validators.required, Validators.email]],
    phoneNumber: ["", [Validators.pattern(/^\+?[1-9]\d{1,14}$/)]],
    role: ["", [Validators.required]],
    password: ["", [Validators.required, Validators.minLength(8)]],
  });

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  closeModal(): void {
    this.close.emit();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((value) => !value);
  }

  onSubmit(): void {
    if (this.createUserForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.createUserForm.controls).forEach((key) => {
        this.createUserForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.loading.set(true);
    this.error.set("");

    const formValue = this.createUserForm.value;
    const createUserRequest: CreateUserRequest = {
      name: formValue.name,
      email: formValue.email,
      password: formValue.password,
      role: formValue.role as UserRole,
      ...(formValue.phoneNumber && { phoneNumber: formValue.phoneNumber }),
    };

    this.usersService.createUser(createUserRequest).subscribe({
      next: () => {
        this.success.set(true);
        this.loading.set(false);
        this.userCreated.emit();
      },
      error: (error) => {
        this.error.set(error.message || "Failed to create user");
        this.loading.set(false);
      },
    });
  }

  createAnother(): void {
    this.success.set(false);
    this.error.set("");
    this.createUserForm.reset();
    this.passwordVisible.set(false);
  }
}
