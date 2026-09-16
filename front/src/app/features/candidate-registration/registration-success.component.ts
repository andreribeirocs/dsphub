import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";

@Component({
  selector: "app-registration-success",
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: "./registration-success.component.html",
})
export class RegistrationSuccessComponent {}
