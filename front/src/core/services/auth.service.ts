// src/app/core/services/auth.service.ts
import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, throwError, of } from "rxjs";
import { catchError, tap, map } from "rxjs/operators";
import { environment } from "../../environments/environment";
import { Router } from "@angular/router";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  avatar: string | null;
  phoneNumber?: string | null;
  lastLogin?: string | null;
  emailVerified?: boolean;
  image?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// Better Auth session response
export interface SessionResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    emailVerified: boolean;
    avatar: string | null;
    phoneNumber?: string | null;
    lastLogin?: string | null;
    image?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: string;
    token: string;
    activeOrganizationId?: string;
  };
}

// Better Auth sign-in response
export interface SignInResponse {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
    role: string;
    status: string;
    phoneNumber: string | null;
    lastLogin: string | null;
    avatar: string | null;
  };
  token: string;
  redirect: boolean;
}

@Injectable({
  providedIn: "root",
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private loadingSubject = new BehaviorSubject<boolean>(false);
  private http = inject(HttpClient);
  private router = inject(Router);

  public currentUser$ = this.currentUserSubject.asObservable();
  public loading$ = this.loadingSubject.asObservable();

  public constructor() {
    // Use setTimeout to defer HTTP calls until after constructor completes
    setTimeout(() => {
      this.checkSession();
    }, 0);
  }

  // Check current session with Better Auth
  private checkSession(): void {
    this.loadingSubject.next(true);
    this.http
      .get<SessionResponse>(`${this.API_URL}/get-session`, {
        withCredentials: true, // Important for cookies
      })
      .subscribe({
        next: (response) => {
          // Explicitly map to User interface to preserve all fields
          const user: User = {
            id: response.user.id,
            email: response.user.email,
            name: response.user.name,
            role: response.user.role,
            status: response.user.status,
            avatar: response.user.avatar,
            phoneNumber: response.user.phoneNumber,
            lastLogin: response.user.lastLogin,
            emailVerified: response.user.emailVerified,
            image: response.user.image,
            createdAt: response.user.createdAt,
            updatedAt: response.user.updatedAt,
          };

          this.currentUserSubject.next(user);
          this.loadingSubject.next(false);
        },
        error: () => {
          this.loadingSubject.next(false);
          this.currentUserSubject.next(null);
        },
      });
  }

  public login(email: string, password: string): Observable<User> {
    return this.http
      .post<SignInResponse>(
        `${this.API_URL}/sign-in/email`,
        { email, password },
        { withCredentials: true } // Important for cookies
      )
      .pipe(
        tap(() => {
          // Better Auth sign-in doesn't return additional fields (role, status, etc.)
          // Immediately fetch full session data to get role and other additional fields
          this.checkSession();
        }),
        map((response) => {
          // Return basic user (role will be updated by checkSession)
          const user: User = {
            id: response.user.id,
            email: response.user.email,
            name: response.user.name,
            role: "", // Will be filled by checkSession
            status: "", // Will be filled by checkSession
            avatar: response.user.avatar,
            phoneNumber: response.user.phoneNumber,
            lastLogin: response.user.lastLogin,
            emailVerified: response.user.emailVerified,
            image: response.user.image,
            createdAt: response.user.createdAt,
            updatedAt: response.user.updatedAt,
          };
          return user;
        }),
        catchError((error) => {
          console.error("Login failed", error);
          return throwError(
            () => new Error(error.error?.message || "Login failed")
          );
        })
      );
  }

  public logout(): Observable<void> {
    return this.http
      .post<void>(`${this.API_URL}/sign-out`, {}, { withCredentials: true })
      .pipe(
        tap(() => {
          this.currentUserSubject.next(null);
          this.router.navigate(["/login"]);
        }),
        catchError(() => {
          // Even if logout fails, clear local state
          this.currentUserSubject.next(null);
          this.router.navigate(["/login"]);
          return of(void 0);
        })
      );
  }

  public get isLoggedIn(): boolean {
    // User is logged in if we have user data
    return !!this.currentUserSubject.value;
  }

  public get isLoading(): boolean {
    return this.loadingSubject.value;
  }

  public get isUserDataLoaded(): boolean {
    return !!this.currentUserSubject.value;
  }

  public currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public hasRole(roles: string[]): boolean {
    const user = this.currentUserSubject.value;
    return user ? roles.includes(user.role) : false;
  }

  // Refresh session data
  public refreshUserProfile(): Observable<User> {
    return this.http
      .get<SessionResponse>(`${this.API_URL}/session`, {
        withCredentials: true,
      })
      .pipe(
        tap((response) => this.currentUserSubject.next(response.user)),
        map((response) => response.user)
      );
  }

  // For backward compatibility - these methods are no longer used with Better Auth
  public forceLogout(): void {
    this.logout().subscribe();
  }

  public get token(): string | null {
    // Better Auth uses cookies, no token in localStorage
    return null;
  }

  public refreshToken(): Observable<any> {
    // Better Auth handles token refresh automatically via cookies
    return this.refreshUserProfile();
  }

  public forgotPassword(_phoneNumber: string): Observable<{ message: string }> {
    // TODO: Implement with Better Auth password reset flow
    return throwError(() => new Error("Not implemented yet"));
  }

  public verifyResetToken(
    _token: string
  ): Observable<{ valid: boolean; message?: string }> {
    // TODO: Implement with Better Auth password reset flow
    return throwError(() => new Error("Not implemented yet"));
  }

  public resetPassword(
    _token: string,
    _newPassword: string
  ): Observable<{ message: string }> {
    // TODO: Implement with Better Auth password reset flow
    return throwError(() => new Error("Not implemented yet"));
  }

  public retryLoadUserProfile(): void {
    this.checkSession();
  }
}
