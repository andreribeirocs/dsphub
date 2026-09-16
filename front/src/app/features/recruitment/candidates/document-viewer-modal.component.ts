import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-document-viewer-modal",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./document-viewer-modal.component.html",
})
export class DocumentViewerModalComponent {
  readonly isOpen = input(false);
  readonly documentUrl = input<string | null>(null);
  readonly documentTitle = input("Document");
  readonly closed = output<void>();

  closeModal(): void {
    console.log("Closing modal");
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closeModal();
    }
  }

  downloadDocument(): void {
    const url = this.documentUrl();
    if (!url) return;

    const link = document.createElement("a");
    link.href = url;
    link.download = `${this.documentTitle()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  onImageError(): void {
    console.error("Failed to load document image");
  }
}
