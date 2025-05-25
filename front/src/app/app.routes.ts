// src/app/app.routes.ts
import { Routes } from '@angular/router';

import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { authGuard } from '../core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent
      ),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          ),
      },
      {
        path: 'pdf',
        loadComponent: () =>
          import('./features/pdf/pdf.component').then((m) => m.PdfComponent),
      },
      {
        path: 'recruitment',
        loadComponent: () =>
          import('./features/recruitment/recruitment.component').then(
            (m) => m.RecruitmentComponent
          ),
        data: { roles: ['DIRECTOR', 'MANAGER_RECRUITMENT'] },
      },
      {
        path: 'candidates',
        loadComponent: () =>
          import('./features/recruitment/candidates/candidates.component').then(
            (m) => m.CandidatesComponent
          ),
        data: { roles: ['DIRECTOR', 'MANAGER_RECRUITMENT'] },
      },
      {
        path: 'drivers',
        loadComponent: () =>
          import('./features/drivers/drivers.component').then(
            (m) => m.DriversComponent
          ),
      },
      // Add more routes as needed
    ],
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/errors/unauthorized/unauthorized.component').then(
        (m) => m.UnauthorizedComponent
      ),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/errors/not-found/not-found.component').then(
        (m) => m.NotFoundComponent
      ),
  },
];
