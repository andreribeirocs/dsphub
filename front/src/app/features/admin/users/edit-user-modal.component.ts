import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Observable, concat, forkJoin } from "rxjs";
import { last } from "rxjs/operators";
import {
  ALL_ROLES,
  DepotOption,
  ROLE_LABELS,
  UpdateUserRequest,
  User,
  UserRole,
  UserStatus,
  UsersService,
  isManagerRole,
} from "./users.service";

@Component({
  selector: "app-edit-user-modal",
  standalone: true,
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 bg-gray-600/50 overflow-y-auto h-full w-full z-50"
      (click)="onBackdropClick($event)"
    >
      <div
        class="relative top-10 mx-auto mb-10 p-5 border w-full max-w-lg shadow-lg rounded-md bg-white"
        (click)="$event.stopPropagation()"
      >
        <div class="mt-3">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h3 class="text-lg font-medium text-gray-900">Edit User</h3>
              <p class="text-sm text-gray-500">{{ user().email }}</p>
            </div>
            <button
              type="button"
              (click)="close.emit()"
              class="text-gray-400 hover:text-gray-600 focus:outline-none"
              aria-label="Close"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          @if (error()) {
            <div class="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <p class="text-sm font-medium text-red-800">{{ error() }}</p>
            </div>
          }

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            <div>
              <label for="edit-name" class="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                id="edit-name"
                type="text"
                formControlName="name"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                [class.border-red-300]="form.controls.name.invalid && form.controls.name.touched"
              />
              @if (form.controls.name.invalid && form.controls.name.touched) {
                <p class="mt-1 text-sm text-red-600">Name must be between 2 and 100 characters</p>
              }
            </div>

            <div>
              <label for="edit-email" class="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
              <input
                id="edit-email"
                type="email"
                formControlName="email"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                [class.border-red-300]="form.controls.email.invalid && form.controls.email.touched"
              />
              @if (form.controls.email.invalid && form.controls.email.touched) {
                <p class="mt-1 text-sm text-red-600">Please provide a valid email address</p>
              }
            </div>

            <div>
              <label for="edit-phone" class="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                id="edit-phone"
                type="tel"
                formControlName="phoneNumber"
                placeholder="+44 7700 900123"
                class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label for="edit-role" class="block text-sm font-medium text-gray-700 mb-1">Role *</label>
                <select
                  id="edit-role"
                  formControlName="role"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                >
                  @for (role of roleOptions(); track role) {
                    <option [value]="role">{{ roleLabels[role] }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="edit-status" class="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  id="edit-status"
                  formControlName="status"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-50 disabled:text-gray-500"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            </div>
            @if (isSelf()) {
              <p class="text-xs text-gray-500">You cannot change your own role or status.</p>
            }

            @if (showDepotAccess()) {
              <div class="border border-gray-200 rounded-md p-4">
                <div class="flex items-center justify-between mb-1">
                  <span class="block text-sm font-medium text-gray-700">Depot access</span>
                  @if (selectedDepotIds().length > 0) {
                    <button type="button" class="text-xs text-blue-600 hover:text-blue-800" (click)="selectedDepotIds.set([])">
                      Clear selection
                    </button>
                  }
                </div>
                <p class="text-xs text-gray-500 mb-3">No depot selected = all depots</p>

                @if (depotsLoading()) {
                  <div class="flex justify-center py-3">
                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                  </div>
                } @else if (depotsError()) {
                  <div class="text-sm text-red-600">
                    {{ depotsError() }}
                    <button type="button" class="ml-2 text-blue-600 hover:text-blue-800" (click)="loadDepots()">Retry</button>
                  </div>
                } @else if (depots().length === 0) {
                  <p class="text-sm text-gray-500">This DSP has no depots yet. Add them in Settings.</p>
                } @else {
                  <div class="max-h-48 overflow-y-auto space-y-2">
                    @for (depot of depots(); track depot.id) {
                      <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          [checked]="selectedDepotIds().includes(depot.id)"
                          (change)="toggleDepot(depot.id)"
                        />
                        <span class="font-medium">{{ depot.code }}</span>
                        <span class="text-gray-500">{{ depot.name }}</span>
                      </label>
                    }
                  </div>
                }
              </div>
            }

            <div class="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                (click)="close.emit()"
                class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                [disabled]="saving()"
              >
                Cancel
              </button>
              <button
                type="submit"
                [disabled]="form.invalid || saving() || depotsLoading()"
                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ saving() ? "Saving..." : "Save Changes" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class EditUserModalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly usersService = inject(UsersService);
  private readonly destroyRef = inject(DestroyRef);

  readonly user = input.required<User>();
  readonly canGrantSuperAdmin = input(false);
  readonly isSelf = input(false);

  readonly close = output<void>();
  readonly saved = output<void>();

  readonly roleLabels = ROLE_LABELS;

  readonly saving = signal(false);
  readonly error = signal("");

  readonly selectedRole = signal<UserRole>("DRIVER");
  readonly depots = signal<DepotOption[]>([]);
  readonly depotsLoading = signal(false);
  readonly depotsError = signal("");
  readonly depotsLoaded = signal(false);
  readonly selectedDepotIds = signal<string[]>([]);
  private initialDepotIds: string[] = [];

  readonly showDepotAccess = computed(() => isManagerRole(this.selectedRole()));

  readonly roleOptions = computed(() =>
    ALL_ROLES.filter(
      (role) => role !== "SUPER_ADMIN" || this.canGrantSuperAdmin() || this.user().role === "SUPER_ADMIN"
    )
  );

  readonly form = this.fb.nonNullable.group({
    name: ["", [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ["", [Validators.required, Validators.email]],
    phoneNumber: [""],
    role: ["DRIVER" as UserRole, [Validators.required]],
    status: ["ACTIVE" as UserStatus, [Validators.required]],
  });

  ngOnInit(): void {
    const user = this.user();
    this.form.setValue({
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber ?? "",
      role: user.role,
      status: user.status,
    });
    if (this.isSelf()) {
      this.form.controls.role.disable();
      this.form.controls.status.disable();
    }
    this.selectedRole.set(user.role);

    this.form.controls.role.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((role) => {
        this.selectedRole.set(role);
        if (isManagerRole(role) && !this.depotsLoaded() && !this.depotsLoading()) {
          this.loadDepots();
        }
      });

    if (isManagerRole(user.role)) {
      this.loadDepots();
    }
  }

  loadDepots(): void {
    this.depotsLoading.set(true);
    this.depotsError.set("");
    forkJoin({
      depots: this.usersService.getDepots(),
      access: this.usersService.getMemberDepots(this.user().id),
    }).subscribe({
      next: ({ depots, access }) => {
        const ids = access.depots.map((depot) => depot.id);
        this.depots.set(depots);
        this.initialDepotIds = ids;
        this.selectedDepotIds.set(ids);
        this.depotsLoaded.set(true);
        this.depotsLoading.set(false);
      },
      error: (err: Error) => {
        this.depotsError.set(err.message);
        this.depotsLoading.set(false);
      },
    });
  }

  toggleDepot(depotId: string): void {
    this.selectedDepotIds.update((ids) =>
      ids.includes(depotId) ? ids.filter((id) => id !== depotId) : [...ids, depotId]
    );
  }

  onBackdropClick(event: Event): void {
    if (event.target === event.currentTarget && !this.saving()) {
      this.close.emit();
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const user = this.user();
    const value = this.form.getRawValue();
    const requests: Observable<unknown>[] = [];

    const changes: UpdateUserRequest = {
      ...(value.name.trim() !== user.name && { name: value.name.trim() }),
      ...(value.email.trim() !== user.email && { email: value.email.trim() }),
      ...(value.phoneNumber.trim() !== (user.phoneNumber ?? "") && {
        phoneNumber: value.phoneNumber.trim(),
      }),
      ...(!this.isSelf() && value.role !== user.role && { role: value.role }),
    };
    if (Object.keys(changes).length > 0) {
      requests.push(this.usersService.updateUser(user.id, changes));
    }

    if (!this.isSelf() && value.status !== user.status) {
      requests.push(this.usersService.updateUserStatus(user.id, { status: value.status }));
    }

    if (isManagerRole(value.role)) {
      if (this.depotsLoaded() && !this.sameIds(this.selectedDepotIds(), this.initialDepotIds)) {
        requests.push(this.usersService.setMemberDepots(user.id, this.selectedDepotIds()));
      }
    } else if (this.initialDepotIds.length > 0) {
      // No longer a manager: drop the old depot restriction
      requests.push(this.usersService.setMemberDepots(user.id, []));
    }

    if (requests.length === 0) {
      this.close.emit();
      return;
    }

    this.saving.set(true);
    this.error.set("");
    concat(...requests)
      .pipe(last())
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.saved.emit();
        },
        error: (err: Error) => {
          this.saving.set(false);
          this.error.set(err.message);
        },
      });
  }

  private sameIds(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((id) => b.includes(id));
  }
}
