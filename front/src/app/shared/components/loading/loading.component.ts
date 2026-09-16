import { Component, input, ChangeDetectionStrategy } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-loading",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./loading.component.html",
})
export class LoadingComponent {
  readonly size = input<"sm" | "md" | "lg">("md");
  readonly message = input("");
  readonly color = input<"blue" | "green" | "gray" | "white">("blue");
  readonly center = input(true);
  readonly showSpinner = input(true);
  readonly fullHeight = input(false);

  get containerClass(): string {
    const baseClass = "flex items-center";
    const centerClass = this.center() ? "justify-center" : "";
    const heightClass = this.fullHeight() ? "h-full" : "";
    const spacingClass = this.message() && this.showSpinner() ? "gap-3" : "";

    return `${baseClass} ${centerClass} ${heightClass} ${spacingClass}`.trim();
  }

  get spinnerClass(): string {
    const sizeClasses = {
      sm: "h-4 w-4",
      md: "h-5 w-5",
      lg: "h-8 w-8",
    };

    return `animate-spin ${sizeClasses[this.size()]}`;
  }

  get spinnerColor(): string {
    const colorClasses = {
      blue: "text-blue-600",
      green: "text-green-600",
      gray: "text-gray-600",
      white: "text-white",
    };

    return colorClasses[this.color()];
  }

  get messageClass(): string {
    const colorClasses = {
      blue: "text-blue-600",
      green: "text-green-600",
      gray: "text-gray-600",
      white: "text-white",
    };

    return `text-sm font-medium ${colorClasses[this.color()]}`;
  }
}
