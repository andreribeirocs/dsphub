import {
  Component,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
  OnInit,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { UsersService, User, UserStats } from "./users.service";
import { CreateUserModalComponent } from "./create-user-modal.component";
import { AlertService } from "../../../shared/services/alert.service";

// Remove duplicate interfaces since they're imported from the service

@Component({
  selector: "app-users",
  standalone: true,
  imports: [CommonModule, FormsModule, CreateUserModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="max-w-7xl mx-auto">
      <!-- Header -->
      <div class="flex justify-between items-center mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">User Management</h1>
          <p class="text-gray-600 mt-1">
            Manage system users and their permissions
          </p>
        </div>
        <button
          (click)="showCreateModal.set(true)"
          class="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          <svg
            class="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Add New User
        </button>
      </div>

      <!-- Stats Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="p-3 rounded-lg bg-blue-100">
              <svg
                class="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                />
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-sm font-medium text-gray-500">Total Users</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ stats().totalUsers }}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="p-3 rounded-lg bg-green-100">
              <svg
                class="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-sm font-medium text-gray-500">Active Users</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ stats().activeUsers }}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="p-3 rounded-lg bg-yellow-100">
              <svg
                class="w-6 h-6 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-sm font-medium text-gray-500">Pending Users</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ stats().pendingUsers }}
              </p>
            </div>
          </div>
        </div>

        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div class="flex items-center">
            <div class="p-3 rounded-lg bg-purple-100">
              <svg
                class="w-6 h-6 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 7V3a2 2 0 012-2h4a2 2 0 012 2v4m-6 4l6 6-6 6V7z"
                />
              </svg>
            </div>
            <div class="ml-4">
              <h3 class="text-sm font-medium text-gray-500">New This Month</h3>
              <p class="text-2xl font-bold text-gray-900">
                {{ stats().newUsersThisMonth }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Filters and Search -->
      <div
        class="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6"
      >
        <div class="flex flex-wrap gap-4">
          <div class="flex-1 min-w-64">
            <input
              type="text"
              placeholder="Search by name or email..."
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              [value]="searchTerm()"
              (input)="searchTerm.set($any($event.target).value)"
            />
          </div>
          <select
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            [value]="roleFilter()"
            (change)="roleFilter.set($any($event.target).value)"
          >
            <option value="">All Roles</option>
            <option value="DIRECTOR">Director</option>
            <option value="MANAGER_FINANCIAL">Financial Manager</option>
            <option value="MANAGER_FLEET">Fleet Manager</option>
            <option value="MANAGER_ONSITE">Onsite Manager</option>
            <option value="MANAGER_RECRUITMENT">Recruitment Manager</option>
            <option value="DRIVER">Driver</option>
          </select>
          <select
            class="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            [value]="statusFilter()"
            (change)="statusFilter.set($any($event.target).value)"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="PENDING">Pending</option>
          </select>
          <button
            class="px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
            (click)="clearFilters()"
          >
            Clear Filters
          </button>
        </div>
      </div>

      <!-- Users Table -->
      <div
        class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
      >
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  User
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Role
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Last Login
                </th>
                <th
                  class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              @for (user of filteredUsers(); track user.id) {
              <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex items-center">
                    <div
                      class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center"
                    >
                      <span class="text-blue-600 font-medium text-sm">
                        {{ user.name.charAt(0).toUpperCase() }}
                      </span>
                    </div>
                    <div class="ml-4">
                      <div class="text-sm font-medium text-gray-900">
                        {{ user.name }}
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
                    {{ getRoleDisplayName(user.role) }}
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
                  {{
                    user.lastLogin ? (user.lastLogin | date : "short") : "Never"
                  }}
                </td>
                <td
                  class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                >
                  <div class="flex justify-end space-x-2">
                    <button
                      (click)="editUser(user)"
                      class="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
                    <button
                      (click)="toggleUserStatus(user)"
                      class="text-yellow-600 hover:text-yellow-900"
                    >
                      {{ user.status === "ACTIVE" ? "Deactivate" : "Activate" }}
                    </button>
                    @if (user.role !== 'DIRECTOR') {
                    <button
                      (click)="deleteUser(user)"
                      class="text-red-600 hover:text-red-900"
                    >
                      Delete
                    </button>
                    }
                  </div>
                </td>
              </tr>
              } @empty {
              <tr>
                <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                  @if (loading()) {
                  <div class="flex justify-center">
                    <div
                      class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
                    ></div>
                  </div>
                  } @else { No users found matching your criteria }
                </td>
              </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Create User Modal -->
      @if (showCreateModal()) {
      <app-create-user-modal
        (close)="onCloseCreateModal()"
        (userCreated)="onUserCreated()"
      />
      }
    </div>
  `,
})
export class UsersComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly usersService = inject(UsersService);
  private readonly alertService = inject(AlertService);

  // Signals for reactive state management
  readonly users = signal<User[]>([]);
  readonly stats = signal<UserStats>({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    pendingUsers: 0,
    usersByRole: {},
    newUsersThisMonth: 0,
  });
  readonly loading = signal(false);
  readonly showCreateModal = signal(false);

  // Filter signals
  readonly searchTerm = signal("");
  readonly roleFilter = signal("");
  readonly statusFilter = signal("");

  // Computed filtered users
  readonly filteredUsers = computed(() => {
    const users = this.users();
    const search = this.searchTerm().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();

    // Guard against undefined users array
    if (!users || !Array.isArray(users)) {
      return [];
    }

    return users.filter((user) => {
      const matchesSearch =
        search === "" ||
        user.name.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search);

      const matchesRole = role === "" || user.role === role;
      const matchesStatus = status === "" || user.status === status;

      return matchesSearch && matchesRole && matchesStatus;
    });
  });

  ngOnInit(): void {
    this.loadUsers();
    this.loadUserStats();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.usersService.getUsers({ limit: 50 }).subscribe({
      next: (response) => {
        // Ensure we always set an array, even if response.data is undefined
        this.users.set(response.data || []);
        this.loading.set(false);
      },
      error: (error) => {
        console.error("Failed to load users:", error);
        this.loading.set(false);
        // Ensure users is set to empty array on error
        this.users.set([]);
        // Fallback to mock data for now
        this.loadMockData();
      },
    });
  }

  loadUserStats(): void {
    this.usersService.getUserStats().subscribe({
      next: (stats) => {
        this.stats.set(stats);
      },
      error: (error) => {
        console.error("Failed to load user stats:", error);
        // Keep existing stats or use defaults
      },
    });
  }

  onCloseCreateModal(): void {
    this.showCreateModal.set(false);
  }

  onUserCreated(): void {
    // Refresh the users list and stats
    this.loadUsers();
    this.loadUserStats();
    this.alertService.showSuccess("User created successfully!");
  }

  applyFilters(): void {
    // Filters are applied automatically through computed signal
  }

  clearFilters(): void {
    this.searchTerm.set("");
    this.roleFilter.set("");
    this.statusFilter.set("");
  }

  editUser(user: User): void {
    console.log("Edit user:", user);
    // TODO: Implement user editing
  }

  toggleUserStatus(user: User): void {
    console.log("Toggle status for user:", user);
    this.loading.set(true);

    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    this.usersService
      .updateUserStatus(user.id, { status: newStatus })
      .subscribe({
        next: (updatedUser) => {
          // Update the user in the list
          const currentUsers = this.users();
          const updatedUsers = currentUsers.map((u) =>
            u.id === user.id ? updatedUser : u
          );
          this.users.set(updatedUsers);
          this.loadUserStats(); // Refresh stats
          this.loading.set(false);
          this.alertService.showSuccess(
            `User ${
              updatedUser.status === "ACTIVE" ? "activated" : "deactivated"
            } successfully`
          );
        },
        error: (error) => {
          console.error("Failed to update user status:", error);
          this.loading.set(false);
          this.alertService.showError(
            "Failed to update user status",
            error.message
          );
        },
      });
  }

  deleteUser(user: User): void {
    if (
      confirm(
        `Are you sure you want to delete user "${user.name}"? This action cannot be undone.`
      )
    ) {
      this.loading.set(true);

      this.usersService.deleteUser(user.id).subscribe({
        next: () => {
          // Remove the user from the list
          const currentUsers = this.users();
          const updatedUsers = currentUsers.filter((u) => u.id !== user.id);
          this.users.set(updatedUsers);
          this.loadUserStats(); // Refresh stats
          this.loading.set(false);
          this.alertService.showSuccess("User deleted successfully");
        },
        error: (error) => {
          console.error("Failed to delete user:", error);
          this.loading.set(false);
          this.alertService.showError("Failed to delete user", error.message);
        },
      });
    }
  }

  getRoleBadgeClasses(role: string): string {
    const classes = {
      DIRECTOR: "bg-purple-100 text-purple-800",
      MANAGER_FINANCIAL: "bg-green-100 text-green-800",
      MANAGER_FLEET: "bg-blue-100 text-blue-800",
      MANAGER_ONSITE: "bg-yellow-100 text-yellow-800",
      MANAGER_RECRUITMENT: "bg-indigo-100 text-indigo-800",
      DRIVER: "bg-gray-100 text-gray-800",
    };
    return classes[role as keyof typeof classes] || "bg-gray-100 text-gray-800";
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

  private loadMockData(): void {
    // Mock data for demonstration
    this.users.set([
      {
        id: "1",
        email: "admin@triun.co.uk",
        name: "Administrator",
        role: "DIRECTOR",
        status: "ACTIVE",
        phoneNumber: "+44 7700 900001",
        lastLogin: new Date("2024-01-15T10:30:00Z"),
        createdAt: new Date("2024-01-01T09:00:00Z"),
        updatedAt: new Date("2024-01-15T14:30:00Z"),
        twoFactorEnabled: true,
      },
      {
        id: "2",
        email: "finance@triun.co.uk",
        name: "Financial Manager",
        role: "MANAGER_FINANCIAL",
        status: "ACTIVE",
        phoneNumber: "+44 7700 900002",
        lastLogin: new Date("2024-01-14T16:45:00Z"),
        createdAt: new Date("2024-01-02T09:00:00Z"),
        updatedAt: new Date("2024-01-14T16:45:00Z"),
        twoFactorEnabled: false,
      },
      {
        id: "3",
        email: "fleet@triun.co.uk",
        name: "Fleet Manager",
        role: "MANAGER_FLEET",
        status: "ACTIVE",
        lastLogin: new Date("2024-01-13T12:20:00Z"),
        createdAt: new Date("2024-01-03T09:00:00Z"),
        updatedAt: new Date("2024-01-13T12:20:00Z"),
        twoFactorEnabled: false,
      },
    ]);

    this.stats.set({
      totalUsers: 3,
      activeUsers: 3,
      inactiveUsers: 0,
      pendingUsers: 0,
      usersByRole: {
        DIRECTOR: 1,
        MANAGER_FINANCIAL: 1,
        MANAGER_FLEET: 1,
        MANAGER_ONSITE: 0,
        MANAGER_RECRUITMENT: 0,
        DRIVER: 0,
      },
      newUsersThisMonth: 3,
    });
  }
}
