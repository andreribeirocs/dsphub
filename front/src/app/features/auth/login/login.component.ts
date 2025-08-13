import { Component, inject, signal, effect } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms";
import { Router, ActivatedRoute } from "@angular/router";
import { AuthService } from "../../../../core/services/auth.service";

@Component({
  selector: "app-login",
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: "./login.component.html",
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  readonly loginForm: FormGroup = this.formBuilder.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", Validators.required],
    rememberMe: [false],
  });

  readonly loading = signal(false);
  readonly error = signal("");
  readonly passwordVisible = signal(false);

  private readonly returnUrl: string =
    this.route.snapshot.queryParams["returnUrl"] || "/dashboard";

  // Auto-redirect effect if already logged in
  private readonly redirectEffect = effect(() => {
    if (this.authService.isLoggedIn) {
      this.router.navigate(["/dashboard"]);
    }
  });

  togglePasswordVisibility(): void {
    this.passwordVisible.update((value) => !value);
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      return;
    }

    this.loading.set(true);
    this.error.set("");

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: () => {
        this.router.navigate([this.returnUrl]);
      },
      error: (error) => {
        this.error.set(error.message || "Login failed");
        this.loading.set(false);
      },
    });
  }
}
