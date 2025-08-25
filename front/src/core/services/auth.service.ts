// src/app/core/services/auth.service.ts
import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { environment } from "../../environments/environment";
import { Router } from "@angular/router";

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string; // Base64 encoded avatar image
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
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
    // This avoids circular dependency issues during DI initialization
    setTimeout(() => {
      this.checkAndClearInvalidTokens();
      this.loadUserFromStorage();
    }, 0);
  }

  // Check if tokens are in old format and clear them if needed
  private checkAndClearInvalidTokens(): void {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        // Decode token payload to check format
        const payload = JSON.parse(atob(token.split(".")[1]));

        // If token contains email or role, it's in old format - clear it
        if (payload.email || payload.role) {
          console.log("Detected old token format, clearing tokens...");
          localStorage.removeItem("token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("user");
        }
      } catch {
        console.log("Invalid token format, clearing tokens...");
        localStorage.removeItem("token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
      }
    }
  }

  private loadUserFromStorage() {
    const token = localStorage.getItem("token");

    if (token) {
      this.loadingSubject.next(true);
      // Fetch user profile from backend instead of localStorage
      this.fetchUserProfile().subscribe({
        next: (user) => {
          this.currentUserSubject.next(user);
          this.loadingSubject.next(false);
        },
        error: (err) => {
          console.error("Failed to load user profile:", err);
          this.loadingSubject.next(false);

          // Only logout if it's an authentication error (401/403)
          // For other errors (network issues, server errors), keep the user logged in
          if (err.status === 401 || err.status === 403) {
            console.log("Authentication error - logging out");
            this.logout();
          } else {
            console.log("Network or server error - keeping user logged in");
            // Keep user logged in but set user data to null
            // The user can try to refresh or navigate to trigger another profile fetch
            this.currentUserSubject.next(null);
          }
        },
      });
    } else {
      this.loadingSubject.next(false);
    }
  }

  private fetchUserProfile(): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/profile`);
  }

  public login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API_URL}/login`, { email, password })
      .pipe(
        tap((response) => this.handleAuth(response)),
        catchError((error) => {
          console.error("Login failed", error);
          return throwError(
            () => new Error(error.error?.message || "Login failed")
          );
        })
      );
  }

  private handleAuth(response: AuthResponse) {
    // Only store tokens, not user data
    localStorage.setItem("token", response.access_token);
    localStorage.setItem("refresh_token", response.refresh_token);

    // Fetch complete user profile (including avatar) instead of using login response
    this.fetchUserProfile().subscribe({
      next: (user) => {
        this.currentUserSubject.next(user);
      },
      error: (err) => {
        console.error("Failed to fetch user profile after login:", err);
        // Fallback to login response user data if profile fetch fails
        this.currentUserSubject.next(response.user);
      },
    });
  }

  public logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    this.currentUserSubject.next(null);
    this.router.navigate(["/login"]);
  }

  // Method to force clear all authentication data (useful for debugging token issues)
  public forceLogout() {
    console.log("Force logout - clearing all auth data");
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user"); // Clear any old user data that might still be there
    this.currentUserSubject.next(null);
    this.loadingSubject.next(false);
    this.router.navigate(["/login"]);
  }

  // Method to decode JWT token for debugging (client-side only, not secure)
  public debugToken(): void {
    const token = this.token;
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        console.log("Current token payload:", payload);
        console.log("Token contains:", Object.keys(payload));
      } catch (err) {
        console.error("Failed to decode token:", err);
      }
    } else {
      console.log("No token found");
    }
  }

  public refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem("refresh_token");
    return this.http
      .post<AuthResponse>(`${this.API_URL}/refresh`, { token: refreshToken })
      .pipe(
        tap((response) => this.handleAuth(response)),
        catchError(() => {
          this.logout();
          return throwError(
            () => new Error("Session expired. Please login again.")
          );
        })
      );
  }

  public forgotPassword(phoneNumber: string): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.API_URL}/forgot-password`, {
        phoneNumber,
      })
      .pipe(
        catchError((error) => {
          console.error("Forgot password failed", error);
          return throwError(
            () => new Error(error.error?.message || "Failed to send reset link")
          );
        })
      );
  }

  public verifyResetToken(
    token: string
  ): Observable<{ valid: boolean; message?: string }> {
    return this.http
      .get<{ valid: boolean; message?: string }>(
        `${this.API_URL}/verify-reset-token/${token}`
      )
      .pipe(
        catchError((error) => {
          console.error("Token verification failed", error);
          return throwError(
            () => new Error(error.error?.message || "Token verification failed")
          );
        })
      );
  }

  public resetPassword(
    token: string,
    newPassword: string
  ): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.API_URL}/reset-password`, {
        token,
        newPassword,
      })
      .pipe(
        catchError((error) => {
          console.error("Password reset failed", error);
          return throwError(
            () => new Error(error.error?.message || "Password reset failed")
          );
        })
      );
  }

  public get isLoggedIn(): boolean {
    // User is logged in if they have a token, regardless of whether user data is loaded yet
    // This prevents premature redirects to login during app initialization
    return !!this.token;
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

  public get token(): string | null {
    return localStorage.getItem("token");
  }

  public hasRole(roles: string[]): boolean {
    const user = this.currentUserSubject.value;
    return user ? roles.includes(user.role) : false;
  }

  // Method to refresh user profile data (useful if user data changes)
  public refreshUserProfile(): Observable<User> {
    return this.fetchUserProfile().pipe(
      tap((user) => this.currentUserSubject.next(user))
    );
  }

  // Method to retry loading user profile (useful for recovering from network errors)
  public retryLoadUserProfile(): void {
    const token = localStorage.getItem("token");
    if (token && !this.loadingSubject.value) {
      this.loadingSubject.next(true);
      this.fetchUserProfile().subscribe({
        next: (user) => {
          this.currentUserSubject.next(user);
          this.loadingSubject.next(false);
        },
        error: (err) => {
          console.error("Failed to retry user profile load:", err);
          this.loadingSubject.next(false);

          if (err.status === 401 || err.status === 403) {
            this.logout();
          } else {
            this.currentUserSubject.next(null);
          }
        },
      });
    }
  }
}
