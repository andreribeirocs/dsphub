import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { AlertComponent } from "../alert/alert.component";
import { AlertService } from "../../services/alert.service";

@Component({
  selector: "app-alert-container",
  standalone: true,
  imports: [CommonModule, AlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./alert-container.component.html",
})
export class AlertContainerComponent {
  readonly alertService = inject(AlertService);
}
