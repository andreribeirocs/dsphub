// src/app/core/interceptors/auth.interceptor.ts
import { inject, Injectable, Injector } from "@angular/core";
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
  HttpClient,
} from "@angular/common/http";
import { Observable, throwError, BehaviorSubject } from "rxjs";
import { catchError, filter, switchMap, take } from "rxjs/operators";
import { Router } from "@angular/router";
import { environment } from "../../environments/environment";

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: Record<string, unknown>;
}

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);
  private router = inject(Router);
  private injector = inject(Injector);

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem("token");

    if (token) {
      request = this.addToken(request, token);
    }

    return next.handle(request).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handle401Error(request, next);
        }
        return throwError(() => error);
      })
    );
  }

  private addToken(request: HttpRequest<unknown>, token: string) {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  private handle401Error(request: HttpRequest<unknown>, next: HttpHandler) {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      const refreshToken = localStorage.getItem("refresh_token");

      if (!refreshToken) {
        this.clearTokensAndRedirect();
        return throwError(() => new Error("No refresh token available"));
      }

      // Get HttpClient from injector to avoid injection context issues
      const http = this.injector.get(HttpClient);

      return http
        .post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, {
          token: refreshToken,
        })
        .pipe(
          switchMap((response) => {
            this.isRefreshing = false;
            this.refreshTokenSubject.next(response.access_token);

            // Update tokens in localStorage
            localStorage.setItem("token", response.access_token);
            localStorage.setItem("refresh_token", response.refresh_token);

            return next.handle(this.addToken(request, response.access_token));
          }),
          catchError((error) => {
            this.isRefreshing = false;
            this.clearTokensAndRedirect();
            return throwError(() => error);
          })
        );
    }

    return this.refreshTokenSubject.pipe(
      filter((token) => token !== null),
      take(1),
      switchMap((token) => next.handle(this.addToken(request, token!)))
    );
  }

  private clearTokensAndRedirect() {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    this.router.navigate(["/login"]);
  }
}
