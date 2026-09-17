// src/app/core/guards/auth.guard.ts
import { inject } from "@angular/core";
import { Router, CanActivateFn } from "@angular/router";
import { map } from "rxjs/operators";
import { AuthService } from "../services/auth.service";

/**
 * Waits for the session to load (so a page refresh does not bounce the user
 * to the login screen), then checks the roles declared in the route data.
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return authService.ensureSession().pipe(
    map((user) => {
      if (!user) {
        return router.createUrlTree(["/login"], { queryParams: { returnUrl: state.url } });
      }
      const roles = route.data["roles"] as string[] | undefined;
      if (roles && !authService.hasRole(roles)) {
        return router.createUrlTree(["/unauthorized"]);
      }
      return true;
    })
  );
};
