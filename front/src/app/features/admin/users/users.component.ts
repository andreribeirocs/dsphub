import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from "@angular/core";
import { DatePipe, NgClass } from "@angular/common";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { Subscription } from "rxjs";
import {
  ALL_ROLES,
  ROLE_LABELS,
  User,
  UserRole,
  UserSortField,
  UserStats,
  UserStatus,
  UsersService,
} from "./users.service";
import { CreateUserModalComponent } from "./create-user-modal.component";
import { EditUserModalComponent } from "./edit-user-modal.component";
import { AlertService } from "../../../shared/services/alert.service";
import { AuthService } from "../../../../core/services/auth.service";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

@Component({
  selector: "app-users",
  standalone: true,
  imports: [
    DatePipe,
    NgClass,
    ReactiveFormsModule,
    CreateUserModalComponent,
    EditUserModalComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex flex-wrap gap-4 justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">User Management</h1>
          <p class="text-gray-600 mt-1">Manage the users of this DSP and their permissions</p>
        </div>
        <button
          (click)="showCreateModal.set(true)"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add New User
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        @for (card of statCards(); track card.label) {
          <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div class="flex items-center">
              <div class="p-3 rounded-lg" [ngClass]="card.bg">
                <svg class="w-6 h-6" [ngClass]="card.fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" [attr.d]="card.icon" />
                </svg>
              </div>
              <div class="ml-4">
                <h3 class="text-sm font-medium text-gray-500">{{ card.label }}</h3>
                <p class="text-2xl font-bold text-gray-900">{{ card.value }}</p>
              </div>
            </div>
          </div>
        }
      </div>
      @if (statsError()) {
        <p class="-mt-6 mb-6 text-sm text-red-600">
          {{ statsError() }}
          <button class="ml-2 text-blue-600 hover:text-blue-800" (click)="loadUserStats()">Retry</button>
        </p>
      }

      <!-- Filters and Search -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div class="flex flex-wrap gap-4">
          <div class="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search by name or email..."
              aria-label="Search users"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              [value]="searchInput()"
              (input)="onSearchInput($any($event.target).value)"
            />
          </div>
          <select
            aria-label="Filter by role"
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            [value]="roleFilter()"
            (change)="onRoleFilter($any($event.target).value)"
          >
            <option value="">All Roles</option>
            @for (role of allRoles; track role) {
              <option [value]="role">{{ roleLabels[role] }}</option>
            }
          </select>
          <select
            aria-label="Filter by status"
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            [value]="statusFilter()"
            (change)="onStatusFilter($any($event.target).value)"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PENDING">Pending</option>
          </select>
          @if (hasFilters()) {
            <button class="px-4 py-2 text-sm text-blue-600 hover:text-blue-800" (click)="clearFilters()">
              Clear Filters
            </button>
          }
        </div>
      </div>

      <!-- Users Table -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                @for (column of columns; track column.label) {
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-700"
                      (click)="sortBy(column.field)"
                    >
                      {{ column.label }}
                      @if (sortField() === column.field) {
                        <span aria-hidden="true">{{ sortOrder() === "asc" ? "▲" : "▼" }}</span>
                      }
                    </button>
                  </th>
                }
                <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @if (loadError()) {
                <tr>
                  <td colspan="5" class="px-6 py-12 text-center">
                    <p class="text-sm text-red-600 mb-3">{{ loadError() }}</p>
                    <button
                      class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      (click)="loadUsers()"
                    >
                      Retry
                    </button>
                  </td>
                </tr>
              } @else {
                @for (user of users(); track user.id) {
                  <tr class="hover:bg-gray-50" [class.opacity-60]="loading()">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="flex items-center">
                        <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <span class="text-blue-600 font-medium text-sm">
                            {{ user.name.charAt(0).toUpperCase() }}
                          </span>
                        </div>
                        <div class="ml-4">
                          <div class="text-sm font-medium text-gray-900">
                            {{ user.name }}
                            @if (user.id === currentUserId()) {
                              <span class="text-xs text-gray-400">(you)</span>
                            }
                          </div>
                          <div class="text-sm text-gray-500">{{ user.email }}</div>
                        </div>
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        [ngClass]="getRoleBadgeClasses(user.role)"
                      >
                        {{ roleLabels[user.role] || user.role }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        [ngClass]="getStatusBadgeClasses(user.status)"
                      >
                        {{ user.status }}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {{ user.lastLogin ? (user.lastLogin | date: "short") : "Never" }}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      @if (canManage(user)) {
                        <div class="flex justify-end space-x-3">
                          <button (click)="editingUser.set(user)" class="text-blue-600 hover:text-blue-900">Edit</button>
                          <button (click)="openResetPassword(user)" class="text-gray-600 hover:text-gray-900">
                            Reset password
                          </button>
                          @if (user.id !== currentUserId()) {
                            <button
                              (click)="toggleUserStatus(user)"
                              [disabled]="busyUserId() === user.id"
                              class="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                            >
                              {{ user.status === "ACTIVE" ? "Deactivate" : "Activate" }}
                            </button>
                            <button
                              (click)="removeUser(user)"
                              [disabled]="busyUserId() === user.id"
                              class="text-red-600 hover:text-red-900 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          }
                        </div>
                      } @else {
                        <span class="text-xs text-gray-400">Managed by super admins</span>
                      }
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                      @if (loading()) {
                        <div class="flex justify-center">
                          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                      } @else {
                        No users found matching your criteria
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        @if (!loadError() && pagination().total > 0) {
          <div class="bg-white px-4 py-3 flex flex-wrap gap-3 items-center justify-between border-t border-gray-200">
            <p class="text-sm text-gray-700">
              Showing <span class="font-medium">{{ rangeStart() }}</span> to
              <span class="font-medium">{{ rangeEnd() }}</span> of
              <span class="font-medium">{{ pagination().total }}</span> users
            </p>
            <div class="flex items-center gap-3">
              <select
                aria-label="Rows per page"
                class="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                [value]="limit()"
                (change)="onLimitChange($any($event.target).value)"
              >
                @for (size of pageSizes; track size) {
                  <option [value]="size">{{ size }} / page</option>
                }
              </select>
              <button
                class="px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                [disabled]="page() <= 1 || loading()"
                (click)="goToPage(page() - 1)"
              >
                Previous
              </button>
              <span class="text-sm text-gray-700">Page {{ page() }} of {{ pagination().totalPages }}</span>
              <button
                class="px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                [disabled]="page() >= pagination().totalPages || loading()"
                (click)="goToPage(page() + 1)"
              >
                Next
              </button>
            </div>
          </div>
        }
      </div>

      <!-- Create User Modal -->
      @if (showCreateModal()) {
        <app-create-user-modal
          [canGrantSuperAdmin]="isSuperAdmin()"
          (close)="showCreateModal.set(false)"
          (userCreated)="onUserCreated()"
        />
      }

      <!-- Edit User Modal -->
      @if (editingUser(); as user) {
        <app-edit-user-modal
          [user]="user"
          [canGrantSuperAdmin]="isSuperAdmin()"
          [isSelf]="user.id === currentUserId()"
          (close)="onEditClosed()"
          (saved)="onUserSaved()"
        />
      }

      <!-- Reset Password Modal -->
      @if (resetUser(); as user) {
        <div
          class="fixed inset-0 bg-gray-600/50 overflow-y-auto h-full w-full z-50"
          (click)="closeResetPassword()"
        >
          <div
            class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white"
            (click)="$event.stopPropagation()"
          >
            <h3 class="text-lg font-medium text-gray-900">Reset password</h3>
            <p class="text-sm text-gray-500 mb-4">
              Set a new password for {{ user.name }} ({{ user.email }}). Share it with them securely.
            </p>
            <form [formGroup]="resetForm" (ngSubmit)="submitResetPassword(user)" class="space-y-4">
              <div>
                <label for="reset-new" class="block text-sm font-medium text-gray-700 mb-1">New password *</label>
                <input
                  id="reset-new"
                  type="password"
                  autocomplete="new-password"
                  formControlName="newPassword"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                @if (resetForm.controls.newPassword.invalid && resetForm.controls.newPassword.touched) {
                  <p class="mt-1 text-sm text-red-600">Password must be at least 8 characters long</p>
                }
              </div>
              <div>
                <label for="reset-confirm" class="block text-sm font-medium text-gray-700 mb-1">Confirm password *</label>
                <input
                  id="reset-confirm"
                  type="password"
                  autocomplete="new-password"
                  formControlName="confirmPassword"
                  class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                @if (resetMismatch() && resetForm.controls.confirmPassword.touched) {
                  <p class="mt-1 text-sm text-red-600">Passwords do not match</p>
                }
              </div>
              <div class="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  (click)="closeResetPassword()"
                  [disabled]="resetting()"
                  class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  [disabled]="resetForm.invalid || resetMismatch() || resetting()"
                  class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ resetting() ? "Saving..." : "Set new password" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class UsersComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly alertService = inject(AlertService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly roleLabels = ROLE_LABELS;
  readonly allRoles = ALL_ROLES;
  readonly pageSizes = [10, 25, 50, 100];
  readonly columns: { label: string; field: UserSortField }[] = [
    { label: "User", field: "name" },
    { label: "Role", field: "role" },
    { label: "Status", field: "status" },
    { label: "Last Login", field: "lastLogin" },
  ];

  private readonly currentUser = toSignal(this.authService.currentUser$, { initialValue: null });
  readonly currentUserId = computed(() => this.currentUser()?.id ?? "");
  readonly isSuperAdmin = computed(() => this.currentUser()?.role === "SUPER_ADMIN");

  readonly users = signal<User[]>([]);
  readonly pagination = signal<Pagination>({ page: 1, limit: 10, total: 0, totalPages: 0 });
  readonly stats = signal<UserStats | null>(null);
  readonly statsError = signal("");
  readonly loading = signal(false);
  readonly loadError = signal("");
  readonly busyUserId = signal<string | null>(null);

  readonly showCreateModal = signal(false);
  readonly editingUser = signal<User | null>(null);
  readonly resetUser = signal<User | null>(null);
  readonly resetting = signal(false);

  // Query state (sent to the API)
  readonly searchInput = signal("");
  readonly search = signal("");
  readonly roleFilter = signal<UserRole | "">("");
  readonly statusFilter = signal<UserStatus | "">("");
  readonly page = signal(1);
  readonly limit = signal(10);
  readonly sortField = signal<UserSortField>("createdAt");
  readonly sortOrder = signal<"asc" | "desc">("desc");

  readonly hasFilters = computed(
    () => !!this.searchInput() || !!this.roleFilter() || !!this.statusFilter()
  );
  readonly rangeStart = computed(() => {
    const { page, limit, total } = this.pagination();
    return total === 0 ? 0 : (page - 1) * limit + 1;
  });
  readonly rangeEnd = computed(() => {
    const { page, limit, total } = this.pagination();
    return Math.min(page * limit, total);
  });

  readonly statCards = computed(() => {
    const stats = this.stats();
    const show = (value: number | undefined) => (value === undefined ? "—" : String(value));
    return [
      {
        label: "Total Users",
        value: show(stats?.totalUsers),
        bg: "bg-blue-100",
        fg: "text-blue-600",
        icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z",
      },
      {
        label: "Active Users",
        value: show(stats?.activeUsers),
        bg: "bg-green-100",
        fg: "text-green-600",
        icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      },
      {
        label: "Pending Users",
        value: show(stats?.pendingUsers),
        bg: "bg-yellow-100",
        fg: "text-yellow-600",
        icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      },
      {
        label: "New This Month",
        value: show(stats?.newUsersThisMonth),
        bg: "bg-purple-100",
        fg: "text-purple-600",
        icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
      },
    ];
  });

  readonly resetForm = this.fb.nonNullable.group({
    newPassword: ["", [Validators.required, Validators.minLength(8)]],
    confirmPassword: ["", [Validators.required]],
  });
  private readonly resetValue = toSignal(this.resetForm.valueChanges, { initialValue: this.resetForm.value });
  readonly resetMismatch = computed(() => {
    const value = this.resetValue();
    return !!value.confirmPassword && value.newPassword !== value.confirmPassword;
  });

  private usersRequest?: Subscription;
  private searchTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.destroyRef.onDestroy(() => {
      clearTimeout(this.searchTimer);
      this.usersRequest?.unsubscribe();
    });
  }

  ngOnInit(): void {
    this.loadUsers();
    this.loadUserStats();
  }

  loadUsers(): void {
    this.usersRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set("");
    this.usersRequest = this.usersService
      .getUsers({
        page: this.page(),
        limit: this.limit(),
        search: this.search(),
        role: this.roleFilter(),
        status: this.statusFilter(),
        sortBy: this.sortField(),
        sortOrder: this.sortOrder(),
      })
      .subscribe({
        next: (response) => {
          this.users.set(response.data);
          this.pagination.set(response.pagination);
          this.loading.set(false);
          // Deleting the last row of the last page: step back one page
          if (response.data.length === 0 && response.pagination.total > 0 && this.page() > 1) {
            this.goToPage(Math.max(response.pagination.totalPages, 1));
          }
        },
        error: (error: Error) => {
          this.users.set([]);
          this.loadError.set(error.message);
          this.loading.set(false);
        },
      });
  }

  loadUserStats(): void {
    this.statsError.set("");
    this.usersService.getUserStats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: (error: Error) => this.statsError.set(error.message),
    });
  }

  private refresh(): void {
    this.loadUsers();
    this.loadUserStats();
  }

  onSearchInput(value: string): void {
    this.searchInput.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.search.set(value.trim());
      this.page.set(1);
      this.loadUsers();
    }, 300);
  }

  onRoleFilter(value: string): void {
    this.roleFilter.set(value as UserRole | "");
    this.page.set(1);
    this.loadUsers();
  }

  onStatusFilter(value: string): void {
    this.statusFilter.set(value as UserStatus | "");
    this.page.set(1);
    this.loadUsers();
  }

  clearFilters(): void {
    clearTimeout(this.searchTimer);
    this.searchInput.set("");
    this.search.set("");
    this.roleFilter.set("");
    this.statusFilter.set("");
    this.page.set(1);
    this.loadUsers();
  }

  sortBy(field: UserSortField): void {
    if (this.sortField() === field) {
      this.sortOrder.update((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      this.sortField.set(field);
      this.sortOrder.set(field === "lastLogin" ? "desc" : "asc");
    }
    this.page.set(1);
    this.loadUsers();
  }

  goToPage(page: number): void {
    this.page.set(Math.max(page, 1));
    this.loadUsers();
  }

  onLimitChange(value: string): void {
    this.limit.set(Number(value) || 10);
    this.page.set(1);
    this.loadUsers();
  }

  /** Only super admins can change a super admin */
  canManage(user: User): boolean {
    return user.role !== "SUPER_ADMIN" || this.isSuperAdmin();
  }

  onUserCreated(): void {
    this.refresh();
    this.alertService.showSuccess("User created successfully");
  }

  onUserSaved(): void {
    this.editingUser.set(null);
    this.refresh();
    this.alertService.showSuccess("User updated successfully");
  }

  onEditClosed(): void {
    this.editingUser.set(null);
    // A save may have partly succeeded before an error
    this.refresh();
  }

  toggleUserStatus(user: User): void {
    const newStatus: UserStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const verb = newStatus === "ACTIVE" ? "activate" : "deactivate";
    const warning = newStatus === "INACTIVE" ? " They will no longer be able to sign in." : "";
    if (!confirm(`Do you want to ${verb} "${user.name}"?${warning}`)) {
      return;
    }

    this.busyUserId.set(user.id);
    this.usersService.updateUserStatus(user.id, { status: newStatus }).subscribe({
      next: () => {
        this.busyUserId.set(null);
        this.refresh();
        this.alertService.showSuccess(`User ${verb}d successfully`);
      },
      error: (error: Error) => {
        this.busyUserId.set(null);
        this.alertService.showError("Failed to update user status", error.message);
      },
    });
  }

  removeUser(user: User): void {
    if (
      !confirm(
        `Remove "${user.name}" from this DSP?\n\nThey will lose access to this DSP. If they do not belong to any other DSP, their account is also deactivated.`
      )
    ) {
      return;
    }

    this.busyUserId.set(user.id);
    this.usersService.deleteUser(user.id).subscribe({
      next: () => {
        this.busyUserId.set(null);
        this.refresh();
        this.alertService.showSuccess("User removed from this DSP");
      },
      error: (error: Error) => {
        this.busyUserId.set(null);
        this.alertService.showError("Failed to remove user", error.message);
      },
    });
  }

  openResetPassword(user: User): void {
    this.resetForm.reset();
    this.resetUser.set(user);
  }

  closeResetPassword(): void {
    if (!this.resetting()) {
      this.resetUser.set(null);
    }
  }

  submitResetPassword(user: User): void {
    if (this.resetForm.invalid || this.resetMismatch()) {
      this.resetForm.markAllAsTouched();
      return;
    }
    this.resetting.set(true);
    this.usersService
      .updateUserPassword(user.id, { newPassword: this.resetForm.getRawValue().newPassword })
      .subscribe({
        next: () => {
          this.resetting.set(false);
          this.resetUser.set(null);
          this.resetForm.reset();
          this.alertService.showSuccess(`Password updated for ${user.name}`);
        },
        error: (error: Error) => {
          this.resetting.set(false);
          this.alertService.showError("Failed to reset password", error.message);
        },
      });
  }

  getRoleBadgeClasses(role: string): string {
    const classes: Record<string, string> = {
      SUPER_ADMIN: "bg-red-100 text-red-800",
      OWNER: "bg-orange-100 text-orange-800",
      DIRECTOR: "bg-purple-100 text-purple-800",
      MANAGER_FINANCIAL: "bg-green-100 text-green-800",
      MANAGER_FLEET: "bg-blue-100 text-blue-800",
      MANAGER_ONSITE: "bg-yellow-100 text-yellow-800",
      MANAGER_RECRUITMENT: "bg-indigo-100 text-indigo-800",
      DRIVER: "bg-gray-100 text-gray-800",
    };
    return classes[role] ?? "bg-gray-100 text-gray-800";
  }

  getStatusBadgeClasses(status: string): string {
    const classes: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-800",
      INACTIVE: "bg-red-100 text-red-800",
      PENDING: "bg-yellow-100 text-yellow-800",
    };
    return classes[status] ?? "bg-gray-100 text-gray-800";
  }
}
