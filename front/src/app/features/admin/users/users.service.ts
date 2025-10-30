import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { environment } from "../../../../environments/environment";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  phoneNumber?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  twoFactorEnabled: boolean;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  phoneNumber?: string;
}

export interface UpdateUserRequest {
  name?: string;
  role?: UserRole;
  phoneNumber?: string;
}

export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateStatusRequest {
  status: UserStatus;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingUsers: number;
  usersByRole: Record<string, number>;
  newUsersThisMonth: number;
}

export interface PaginatedUsersResponse {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export type UserRole =
  | "SUPER_ADMIN"
  | "OWNER"
  | "DIRECTOR"
  | "MANAGER_FINANCIAL"
  | "MANAGER_FLEET"
  | "MANAGER_ONSITE"
  | "MANAGER_RECRUITMENT"
  | "DRIVER";

export type UserStatus = "ACTIVE" | "INACTIVE" | "PENDING";

@Injectable({
  providedIn: "root",
})
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/users`;

  /**
   * Get all users with filtering and pagination
   */
  getUsers(params?: GetUsersParams): Observable<PaginatedUsersResponse> {
    const queryParams = new URLSearchParams();

    if (params?.page) queryParams.set("page", params.page.toString());
    if (params?.limit) queryParams.set("limit", params.limit.toString());
    if (params?.search) queryParams.set("search", params.search);
    if (params?.role) queryParams.set("role", params.role);
    if (params?.status) queryParams.set("status", params.status);
    if (params?.sortBy) queryParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) queryParams.set("sortOrder", params.sortOrder);

    const url = queryParams.toString()
      ? `${this.API_URL}?${queryParams.toString()}`
      : this.API_URL;

    return this.http.get<PaginatedUsersResponse>(url).pipe(
      catchError((error) => {
        console.error("Failed to fetch users:", error);
        return throwError(
          () => new Error(error.error?.message || "Failed to fetch users")
        );
      })
    );
  }

  /**
   * Get user statistics
   */
  getUserStats(): Observable<UserStats> {
    return this.http.get<UserStats>(`${this.API_URL}/stats`).pipe(
      catchError((error) => {
        console.error("Failed to fetch user stats:", error);
        return throwError(
          () =>
            new Error(error.error?.message || "Failed to fetch user statistics")
        );
      })
    );
  }

  /**
   * Get a specific user by ID
   */
  getUser(id: string): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/${id}`).pipe(
      catchError((error) => {
        console.error("Failed to fetch user:", error);
        return throwError(
          () => new Error(error.error?.message || "Failed to fetch user")
        );
      })
    );
  }

  /**
   * Create a new user
   */
  createUser(userData: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.API_URL, userData).pipe(
      catchError((error) => {
        console.error("Failed to create user:", error);
        return throwError(
          () => new Error(error.error?.message || "Failed to create user")
        );
      })
    );
  }

  /**
   * Update user information
   */
  updateUser(id: string, userData: UpdateUserRequest): Observable<User> {
    return this.http.patch<User>(`${this.API_URL}/${id}`, userData).pipe(
      catchError((error) => {
        console.error("Failed to update user:", error);
        return throwError(
          () => new Error(error.error?.message || "Failed to update user")
        );
      })
    );
  }

  /**
   * Update user password
   */
  updateUserPassword(
    id: string,
    passwordData: UpdatePasswordRequest
  ): Observable<{ message: string }> {
    return this.http
      .patch<{ message: string }>(
        `${this.API_URL}/${id}/password`,
        passwordData
      )
      .pipe(
        catchError((error) => {
          console.error("Failed to update password:", error);
          return throwError(
            () => new Error(error.error?.message || "Failed to update password")
          );
        })
      );
  }

  /**
   * Update user status
   */
  updateUserStatus(
    id: string,
    statusData: UpdateStatusRequest
  ): Observable<User> {
    return this.http
      .patch<User>(`${this.API_URL}/${id}/status`, statusData)
      .pipe(
        catchError((error) => {
          console.error("Failed to update user status:", error);
          return throwError(
            () =>
              new Error(error.error?.message || "Failed to update user status")
          );
        })
      );
  }

  /**
   * Delete a user
   */
  deleteUser(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/${id}`).pipe(
      catchError((error) => {
        console.error("Failed to delete user:", error);
        return throwError(
          () => new Error(error.error?.message || "Failed to delete user")
        );
      })
    );
  }
}
