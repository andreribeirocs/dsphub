// src/app/app.config.ts
import { ApplicationConfig, importProvidersFrom } from "@angular/core";
import { provideRouter } from "@angular/router";
import {
  HTTP_INTERCEPTORS,
  HttpClientModule,
  provideHttpClient,
  withInterceptorsFromDi,
} from "@angular/common/http";
import { routes } from "./app.routes";
import { AuthInterceptor } from "../core/interceptors/auth.interceptor";
import { provideCharts, withDefaultRegisterables } from "ng2-charts";
import { Chart, registerables } from "chart.js";

// Register Chart.js components
Chart.register(...registerables);

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptorsFromDi()),
    provideCharts(withDefaultRegisterables()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
};
