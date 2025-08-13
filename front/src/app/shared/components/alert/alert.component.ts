import {
  Component,
  input,
  output,
  signal,
  effect,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";

export type AlertType = "success" | "error" | "warning" | "info";

export interface AlertData {
  readonly id: string;
  readonly type: AlertType;
  readonly title: string;
  readonly message?: string;
  readonly duration?: number; // Auto-dismiss duration in milliseconds
  readonly showCloseButton?: boolean;
}

@Component({
  selector: "app-alert",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./alert.component.html",
})
export class AlertComponent {
  readonly alert = input.required<AlertData>();
  readonly closed = output<void>();

  readonly isVisible = signal(true);

  private timeoutId?: number;

  // Auto-dismiss effect
  private readonly autoDismissEffect = effect(() => {
    const alertData = this.alert();
    const duration =
      alertData.duration ?? (alertData.type === "success" ? 3000 : 5000);

    if (duration > 0) {
      this.timeoutId = window.setTimeout(() => {
        this.close();
      }, duration);
    }
  });

  close(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.isVisible.set(false);

    // Wait for animation to complete before emitting close event
    setTimeout(() => {
      this.closed.emit();
    }, 300);
  }
}
