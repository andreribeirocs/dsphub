import { Injectable, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { apiErrorMessage } from "../../../shared/utils/api-error";
import { Observable, throwError, OperatorFunction } from "rxjs";
import { catchError } from "rxjs/operators";
import { environment } from "../../../../environments/environment";

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

export type UserSortField = "name" | "email" | "role" | "status" | "createdAt" | "lastLogin";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: UserStatus;
  phoneNumber: string | null;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  twoFactorEnabled: boolean;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  phoneNumber?: string;
}

/** Matches api UpdateUserDto (status is changed through PATCH /users/:id/status) */
export interface UpdateUserRequest {
  name?: string;
  email?: string;
  role?: UserRole;
  phoneNumber?: string;
}

export interface UpdatePasswordRequest {
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
  role?: UserRole | "";
  status?: UserStatus | "";
  sortBy?: UserSortField;
  sortOrder?: "asc" | "desc";
}

export interface DepotOption {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
}

/** GET /api/depots/members/:userId */
export interface MemberDepotsResponse {
  allDepots: boolean;
  depots: DepotOption[];
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  DIRECTOR: "Director",
  MANAGER_FINANCIAL: "Financial Manager",
  MANAGER_FLEET: "Fleet Manager",
  MANAGER_ONSITE: "Onsite Manager",
  MANAGER_RECRUITMENT: "Recruitment Manager",
  DRIVER: "Driver",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS) as UserRole[];

export const isManagerRole = (role: string | null | undefined): boolean =>
  !!role && role.startsWith("MANAGER_");

export { apiErrorMessage };

@Injectable({
  providedIn: "root",
})
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/users`;
  private readonly DEPOTS_URL = `${environment.apiUrl}/depots`;

  private fail<T>(fallback: string): OperatorFunction<T, T> {
    return catchError((error: unknown) =>
      throwError(() => new Error(apiErrorMessage(error, fallback)))
    );
  }

  getUsers(params: GetUsersParams = {}): Observable<PaginatedUsersResponse> {
    let httpParams = new HttpParams();
    if (params.page) httpParams = httpParams.set("page", params.page);
    if (params.limit) httpParams = httpParams.set("limit", params.limit);
    if (params.search) httpParams = httpParams.set("search", params.search);
    if (params.role) httpParams = httpParams.set("role", params.role);
    if (params.status) httpParams = httpParams.set("status", params.status);
    if (params.sortBy) httpParams = httpParams.set("sortBy", params.sortBy);
    if (params.sortOrder) httpParams = httpParams.set("sortOrder", params.sortOrder);

    return this.http
      .get<PaginatedUsersResponse>(this.API_URL, { params: httpParams })
      .pipe(this.fail("Failed to load users"));
  }

  getUserStats(): Observable<UserStats> {
    return this.http
      .get<UserStats>(`${this.API_URL}/stats`)
      .pipe(this.fail("Failed to load user statistics"));
  }

  createUser(userData: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.API_URL, userData).pipe(this.fail("Failed to create user"));
  }

  updateUser(id: string, userData: UpdateUserRequest): Observable<User> {
    return this.http
      .patch<User>(`${this.API_URL}/${id}`, userData)
      .pipe(this.fail("Failed to update user"));
  }

  /** Admin password reset (no current password required) */
  updateUserPassword(id: string, data: UpdatePasswordRequest): Observable<{ message: string }> {
    return this.http
      .patch<{ message: string }>(`${this.API_URL}/${id}/password`, data)
      .pipe(this.fail("Failed to reset password"));
  }

  updateUserStatus(id: string, data: UpdateStatusRequest): Observable<User> {
    return this.http
      .patch<User>(`${this.API_URL}/${id}/status`, data)
      .pipe(this.fail("Failed to update user status"));
  }

  /** Removes the user from the current DSP */
  deleteUser(id: string): Observable<{ message: string }> {
    return this.http
      .delete<{ message: string }>(`${this.API_URL}/${id}`)
      .pipe(this.fail("Failed to remove user"));
  }

  getDepots(): Observable<DepotOption[]> {
    return this.http.get<DepotOption[]>(this.DEPOTS_URL).pipe(this.fail("Failed to load depots"));
  }

  getMemberDepots(userId: string): Observable<MemberDepotsResponse> {
    return this.http
      .get<MemberDepotsResponse>(`${this.DEPOTS_URL}/members/${userId}`)
      .pipe(this.fail("Failed to load depot access"));
  }

  /** Empty array = access to every depot */
  setMemberDepots(userId: string, depotIds: string[]): Observable<MemberDepotsResponse> {
    return this.http
      .put<MemberDepotsResponse>(`${this.DEPOTS_URL}/members/${userId}`, { depotIds })
      .pipe(this.fail("Failed to update depot access"));
  }
}
