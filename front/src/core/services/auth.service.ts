// src/app/core/services/auth.service.ts
import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { BehaviorSubject, Observable, throwError, of } from "rxjs";
import { catchError, tap, map, finalize, shareReplay, switchMap } from "rxjs/operators";
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

  /** In-flight session lookup, shared by the guard and components */
  private sessionRequest$?: Observable<User | null>;

  public constructor() {
    // Load the session as soon as the app starts (the guard also waits for it)
    setTimeout(() => this.ensureSession().subscribe(), 0);
  }

  private toUser(sessionUser: SessionResponse["user"]): User {
    return {
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      role: sessionUser.role,
      status: sessionUser.status,
      avatar: sessionUser.avatar,
      phoneNumber: sessionUser.phoneNumber,
      lastLogin: sessionUser.lastLogin,
      emailVerified: sessionUser.emailVerified,
      image: sessionUser.image,
      createdAt: sessionUser.createdAt,
      updatedAt: sessionUser.updatedAt,
    };
  }

  /**
   * Ask better-auth for the current session. Returns null when signed out
   * (get-session answers `null`, not an error).
   */
  private fetchSession(skipCookieCache = false): Observable<User | null> {
    this.loadingSubject.next(true);
    return this.http
      .get<SessionResponse | null>(`${this.API_URL}/get-session`, {
        withCredentials: true,
        params: skipCookieCache ? { disableCookieCache: "true" } : {},
      })
      .pipe(
        map((response) => (response?.user ? this.toUser(response.user) : null)),
        catchError(() => of(null)),
        tap((user) => this.currentUserSubject.next(user)),
        finalize(() => this.loadingSubject.next(false))
      );
  }

  /** Current user, loading the session first if needed (used by the route guard) */
  public ensureSession(): Observable<User | null> {
    const current = this.currentUserSubject.value;
    if (current) {
      return of(current);
    }
    if (!this.sessionRequest$) {
      this.sessionRequest$ = this.fetchSession().pipe(
        finalize(() => (this.sessionRequest$ = undefined)),
        shareReplay(1)
      );
    }
    return this.sessionRequest$;
  }

  private checkSession(): void {
    this.fetchSession(true).subscribe();
  }

  public login(email: string, password: string): Observable<User> {
    return this.http
      .post<SignInResponse>(
        `${this.API_URL}/sign-in/email`,
        { email, password },
        { withCredentials: true } // Important for cookies
      )
      .pipe(
        // Sign-in does not return role/status: load the full session before continuing
        switchMap(() => this.fetchSession(true)),
        map((user) => {
          if (!user) {
            throw new Error("Session could not be loaded");
          }
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

  /** Reload the logged-in user (skips the session cookie cache so edits show at once) */
  public refreshUserProfile(): Observable<User> {
    return this.fetchSession(true).pipe(
      map((user) => {
        if (!user) {
          throw new Error("Not signed in");
        }
        return user;
      })
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
