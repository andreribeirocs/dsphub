// src/app/app.config.ts
import { ApplicationConfig, isDevMode, ErrorHandler } from "@angular/core";
import { provideRouter } from "@angular/router";
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
  withFetch,
} from "@angular/common/http";
import { routes } from "./app.routes";
import { AuthInterceptor } from "../core/interceptors/auth.interceptor";
import { GlobalErrorHandler } from "../core/services/error-handler.service";
import { provideCharts, withDefaultRegisterables } from "ng2-charts";
import { Chart, registerables } from "chart.js";
// Note: ngx-sonner doesn't require a provider, it works standalone

// Angular 20 Security and Performance Imports
import {
  provideBrowserGlobalErrorListeners,
  provideCheckNoChangesConfig,
} from "@angular/core";

// Register Chart.js components
Chart.register(...registerables);

export const appConfig: ApplicationConfig = {
  providers: [
    // 🔥 Angular 20: Global Error Handling (catches unhandled errors & promise rejections)
    provideBrowserGlobalErrorListeners(),

    // 🚀 Angular 20: Zoneless Change Detection
    // Note: Temporarily disabled to avoid zone.js conflicts during development
    // To enable: import { provideZonelessChangeDetection } from '@angular/core'
    // and add: provideZonelessChangeDetection(),

    // 🛡️ Angular 20: Enhanced Change Detection Debugging (Development Only)
    ...(isDevMode()
      ? [
          provideCheckNoChangesConfig({
            exhaustive: true,
            interval: 5000, // Check every 5 seconds in development
          }),
        ]
      : []),

    // 🔒 Custom Error Handler (works with Angular 20 global listeners)
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler,
    },

    // Router and HTTP Configuration
    provideRouter(routes),

    // 🔥 Angular 20: Enhanced HTTP with Fetch API (better performance & security)
    provideHttpClient(
      withInterceptorsFromDi(),
      withFetch() // Angular 20: Uses Fetch API for better performance and security
    ),

    // Chart.js Configuration
    provideCharts(withDefaultRegisterables()),

    // Note: ngx-sonner works standalone, no provider needed

    // Interceptors
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
};
