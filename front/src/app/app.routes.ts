// src/app/app.routes.ts
import { Routes } from "@angular/router";

import { MainLayoutComponent } from "./layout/main-layout/main-layout.component";
import { authGuard } from "../core/guards/auth.guard";

export const routes: Routes = [
  {
    path: "",
    redirectTo: "dashboard",
    pathMatch: "full",
  },
  {
    path: "login",
    loadComponent: () =>
      import("./features/auth/login/login.component").then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: "forgot-password",
    loadComponent: () =>
      import("./features/auth/forgot-password/forgot-password.component").then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  {
    path: "reset-password",
    loadComponent: () =>
      import("./features/auth/reset-password/reset-password.component").then(
        (m) => m.ResetPasswordComponent
      ),
  },
  {
    path: "register/:token",
    loadComponent: () =>
      import(
        "./features/candidate-registration/candidate-registration.component"
      ).then((m) => m.CandidateRegistrationComponent),
  },
  {
    path: "registration-success",
    loadComponent: () =>
      import(
        "./features/candidate-registration/registration-success.component"
      ).then((m) => m.RegistrationSuccessComponent),
  },
  {
    path: "",
    component: MainLayoutComponent,
    canActivate: [authGuard],
    // Also runs for each child so the "roles" in route data are enforced
    canActivateChild: [authGuard],
    children: [
      {
        path: "dashboard",
        loadComponent: () =>
          import("./features/dashboard/dashboard.component").then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: "pdf",
        loadComponent: () =>
          import("./features/pdf/pdf.component").then((m) => m.PdfComponent),
      },
      {
        path: "recruitment",
        loadComponent: () =>
          import("./features/recruitment/recruitment.component").then(
            (m) => m.RecruitmentComponent
          ),
        data: {
          roles: ["SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_RECRUITMENT"],
        },
      },
      {
        path: "recruitment/:stage",
        loadComponent: () => import("./features/recruitment/workflow/recruitment-workspace.component").then(m => m.RecruitmentWorkspaceComponent),
        data: { roles: ["SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_RECRUITMENT"] },
      },
      {
        path: "candidates",
        children: [
          {
            path: "",
            loadComponent: () =>
              import(
                "./features/recruitment/candidates/candidates.component"
              ).then((m) => m.CandidatesComponent),
            data: {
              roles: [
                "SUPER_ADMIN",
                "OWNER",
                "DIRECTOR",
                "MANAGER_RECRUITMENT",
              ],
            },
          },
          {
            path: ":id",
            loadComponent: () =>
              import(
                "./features/recruitment/candidates/candidate-detail.component"
              ).then((m) => m.CandidateDetailComponent),
            data: {
              roles: [
                "SUPER_ADMIN",
                "OWNER",
                "DIRECTOR",
                "MANAGER_RECRUITMENT",
              ],
            },
          },
        ],
      },
      {
        path: "drivers",
        children: [
          {
            path: "",
            loadComponent: () =>
              import("./features/drivers/drivers.component").then(
                (m) => m.DriversComponent
              ),
          },
          {
            path: "schedule",
            loadComponent: () =>
              import("./features/drivers/driver-schedule.component").then(
                (m) => m.DriverScheduleComponent
              ),
          },
          {
            path: ":id",
            loadComponent: () =>
              import("./features/drivers/driver-details.component").then(
                (m) => m.DriverDetailsComponent
              ),
          },
        ],
      },
      {
        path: "payments",
        loadComponent: () =>
          import("./features/payments/payment-dashboard.component").then(
            (m) => m.PaymentDashboardComponent
          ),
        data: {
          roles: [
            "SUPER_ADMIN",
            "OWNER",
            "DIRECTOR",
            "MANAGER_FINANCIAL",
            "MANAGER_FLEET",
            "MANAGER_ONSITE",
          ],
        },
      },
      {
        path: "daily-payment",
        loadComponent: () =>
          import("./features/payments/daily-payment.component").then(
            (m) => m.DailyPaymentComponent
          ),
        data: {
          roles: [
            "SUPER_ADMIN",
            "OWNER",
            "DIRECTOR",
            "MANAGER_FINANCIAL",
            "MANAGER_FLEET",
            "MANAGER_ONSITE",
          ],
        },
      },
      {
        path: "vans",
        children: [
          {
            path: "",
            loadComponent: () =>
              import("./features/vans/van-dashboard.component").then(
                (m) => m.VanDashboardComponent
              ),
            data: {
              roles: ["SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FLEET"],
            },
          },
        ],
      },
      {
        path: "invoices",
        children: [
          {
            path: "",
            loadComponent: () =>
              import("./features/invoices/invoices.component").then(
                (m) => m.InvoicesComponent
              ),
            data: {
              roles: ["SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL"],
            },
          },
          {
            path: "generate",
            loadComponent: () =>
              import("./features/invoices/invoice-generation.component").then(
                (m) => m.InvoiceGenerationComponent
              ),
            data: {
              roles: ["SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL"],
            },
          },
          {
            path: ":id",
            loadComponent: () =>
              import("./features/invoices/invoice-details.component").then(
                (m) => m.InvoiceDetailsComponent
              ),
            data: {
              roles: ["SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL"],
            },
          },
        ],
      },
      {
        path: "profile",
        loadComponent: () =>
          import("./features/profile/profile.component").then(
            (m) => m.ProfileComponent
          ),
      },
      {
        path: "organizations",
        loadComponent: () =>
          import("./features/organizations/organizations.component").then(
            (m) => m.OrganizationsComponent
          ),
        data: { roles: ["SUPER_ADMIN"] },
      },
      {
        path: "admin",
        children: [
          {
            path: "users",
            loadComponent: () =>
              import("./features/admin/users/users.component").then(
                (m) => m.UsersComponent
              ),
            data: { roles: ["SUPER_ADMIN", "OWNER", "DIRECTOR"] },
          },
          {
            path: "settings",
            loadComponent: () =>
              import("./features/admin/settings/settings.component").then(
                (m) => m.SettingsComponent
              ),
            data: { roles: ["SUPER_ADMIN", "OWNER", "DIRECTOR"] },
          },
          {
            path: "audit-logs",
            loadComponent: () =>
              import("./features/admin/audit-logs/audit-logs.component").then(
                (m) => m.AuditLogsComponent
              ),
            data: { roles: ["SUPER_ADMIN", "OWNER", "DIRECTOR"] },
          },
        ],
      },
      // Add more routes as needed
    ],
  },
  {
    path: "unauthorized",
    loadComponent: () =>
      import("./features/errors/unauthorized/unauthorized.component").then(
        (m) => m.UnauthorizedComponent
      ),
  },
  {
    path: "**",
    loadComponent: () =>
      import("./features/errors/not-found/not-found.component").then(
        (m) => m.NotFoundComponent
      ),
  },
];
