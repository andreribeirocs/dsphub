// src/app/core/services/auth.service.ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

export interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private http = inject(HttpClient);
  private router = inject(Router);

  public currentUser$ = this.currentUserSubject.asObservable();

  public constructor() {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage() {
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('token');

    if (userData && token) {
      this.currentUserSubject.next(JSON.parse(userData));
    }
  }

  public login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API_URL}/login`, { email, password })
      .pipe(
        tap((response) => this.handleAuth(response)),
        catchError((error) => {
          console.error('Login failed', error);
          return throwError(
            () => new Error(error.error?.message || 'Login failed')
          );
        })
      );
  }

  private handleAuth(response: AuthResponse) {
    localStorage.setItem('token', response.access_token);
    localStorage.setItem('refresh_token', response.refresh_token);
    localStorage.setItem('user', JSON.stringify(response.user));
    this.currentUserSubject.next(response.user);
  }

  public logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  public refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem('refresh_token');
    return this.http
      .post<AuthResponse>(`${this.API_URL}/refresh`, { token: refreshToken })
      .pipe(
        tap((response) => this.handleAuth(response)),
        catchError((error) => {
          this.logout();
          return throwError(
            () => new Error('Session expired. Please login again.')
          );
        })
      );
  }

  public get isLoggedIn(): boolean {
    return !!this.currentUserSubject.value;
  }

  public currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get token(): string | null {
    return localStorage.getItem('token');
  }

  public hasRole(roles: string[]): boolean {
    const user = this.currentUserSubject.value;
    return user ? roles.includes(user.role) : false;
  }
}
