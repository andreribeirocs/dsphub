// src/app/core/interceptors/auth.interceptor.ts
import { inject, Injectable } from "@angular/core";
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
} from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { Router } from "@angular/router";

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private router = inject(Router);

  intercept(
    request: HttpRequest<unknown>,
    next: HttpHandler
  ): Observable<HttpEvent<unknown>> {
    // Better Auth uses cookies, so we need to ensure credentials are included
    const modifiedRequest = request.clone({
      withCredentials: true,
    });

    return next.handle(modifiedRequest).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          // Session expired or invalid, redirect to login
          this.router.navigate(["/login"]);
        }
        return throwError(() => error);
      })
    );
  }
}
