import { Injectable } from "@angular/core";
import { toast } from "ngx-sonner";

@Injectable({
  providedIn: "root",
})
export class AlertService {
  showSuccess(
    title: string,
    message?: string,
    duration?: number
  ): string | number {
    const toastMessage = message ? `${title}\n${message}` : title;
    return toast.success(toastMessage, {
      duration: duration ?? 3000,
    });
  }

  showError(
    title: string,
    message?: string,
    duration?: number
  ): string | number {
    const toastMessage = message ? `${title}\n${message}` : title;
    return toast.error(toastMessage, {
      duration: duration ?? 5000,
    });
  }

  showWarning(
    title: string,
    message?: string,
    duration?: number
  ): string | number {
    const toastMessage = message ? `${title}\n${message}` : title;
    return toast.warning(toastMessage, {
      duration: duration ?? 4000,
    });
  }

  showInfo(
    title: string,
    message?: string,
    duration?: number
  ): string | number {
    const toastMessage = message ? `${title}\n${message}` : title;
    return toast.info(toastMessage, {
      duration: duration ?? 4000,
    });
  }

  show(message: string, duration?: number): string | number {
    return toast(message, {
      duration: duration ?? 4000,
    });
  }

  showLoading(message: string): string | number {
    return toast.loading(message);
  }

  showPromise<T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ): string | number | undefined {
    return toast.promise(promise, messages);
  }

  dismiss(id: string | number): void {
    toast.dismiss(id);
  }

  dismissAll(): void {
    toast.dismiss();
  }

  // Legacy method for backward compatibility
  removeAlert(id: string): void {
    this.dismiss(id);
  }

  // Legacy method for backward compatibility
  clearAll(): void {
    this.dismissAll();
  }
}
