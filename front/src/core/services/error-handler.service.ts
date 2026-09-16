import { Injectable, inject, ErrorHandler } from "@angular/core";
import { Router } from "@angular/router";

@Injectable({
  providedIn: "root",
})
export class GlobalErrorHandler implements ErrorHandler {
  private router = inject(Router);

  handleError(error: any): void {
    // 🚀 Angular 20: Handle all types of expected cancellation errors
    if (this.isExpectedCancellationError(error)) {
      // These are normal during navigation/component changes - completely ignore them
      return;
    }

    // 🛡️ Security: Never expose sensitive information to users
    const secureMessage = this.getSafeErrorMessage(error);

    // 📊 Development: Log detailed error information
    if (this.isDevelopment()) {
      console.group("🚨 Angular 20 Global Error Handler");
      console.error("Original Error:", error);
      console.error("Stack Trace:", error?.stack);
      console.error("User-Safe Message:", secureMessage);
      console.groupEnd();
    }

    // 🔒 Production: Log minimal, safe information
    if (this.isProduction()) {
      console.error("Application Error:", secureMessage);

      // Send to monitoring service (implement your analytics here)
      this.reportToMonitoring(error, secureMessage);
    }

    // 🚨 Handle critical errors with user-friendly messages
    this.handleCriticalErrors(error, secureMessage);
  }

  private getSafeErrorMessage(error: any): string {
    // 🔒 Security: Sanitize error messages to prevent information leakage
    // Note: AbortError is now filtered out earlier in handleError()

    if (
      error?.name === "ChunkLoadError" ||
      error?.message?.includes("Loading chunk")
    ) {
      return "The application needs to be refreshed. Please reload the page.";
    }

    if (
      error?.status === 0 ||
      error?.message?.includes("Http failure response")
    ) {
      return "Network connection error. Please check your internet connection.";
    }

    if (error?.status >= 400 && error?.status < 500) {
      return "There was a problem with your request. Please try again.";
    }

    if (error?.status >= 500) {
      return "The server is temporarily unavailable. Please try again later.";
    }

    // Generic safe message for unknown errors
    return "An unexpected error occurred. Please try again or contact support if the problem persists.";
  }

  private handleCriticalErrors(error: any, safeMessage: string): void {
    // 🚨 Handle specific critical errors
    if (error?.name === "ChunkLoadError") {
      // Show user-friendly reload prompt
      this.showReloadDialog(safeMessage);
      return;
    }

    if (error?.status === 401) {
      // Redirect to login on authentication errors
      this.router.navigate(["/login"]);
      return;
    }

    if (error?.status === 403) {
      // Redirect to unauthorized page
      this.router.navigate(["/unauthorized"]);
      return;
    }

    // For other errors, show a non-intrusive notification
    this.showErrorNotification(safeMessage);
  }

  private showReloadDialog(message: string): void {
    // 💡 Show user-friendly reload dialog
    if (confirm(`${message}\n\nWould you like to reload the page now?`)) {
      window.location.reload();
    }
  }

  private showErrorNotification(message: string): void {
    // 📢 Show non-intrusive error notification
    // You can integrate this with your notification service
    console.warn("User Notification:", message);

    // Example: Create a simple toast notification
    this.createToastNotification(message);
  }

  private createToastNotification(message: string): void {
    // 🍞 Simple toast notification implementation
    const toast = document.createElement("div");
    toast.className = "error-toast";
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      z-index: 10000;
      max-width: 400px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      opacity: 0;
      transform: translateX(100%);
      transition: all 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateX(0)";
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  private reportToMonitoring(error: any, safeMessage: string): void {
    // 📊 Report to your monitoring service (Sentry, LogRocket, etc.)
    // Example implementation:

    const errorReport = {
      message: safeMessage,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      // Don't include sensitive error details in production
      errorType: error?.name || "UnknownError",
    };

    // Send to your monitoring endpoint
    // fetch('/api/errors', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(errorReport)
    // }).catch(() => {
    //   // Silently fail if error reporting fails
    // });

    console.log("Error Report (would be sent to monitoring):", errorReport);
  }

  private isExpectedCancellationError(error: any): boolean {
    // 🚀 Angular 20: Identify various types of expected cancellation errors

    // Standard AbortError from Fetch API cancellations
    if (error?.name === "AbortError" && error?.message?.includes("aborted")) {
      return true;
    }

    // Angular HTTP Client cancellation errors
    if (
      error?.name === "AbortError" &&
      error?.message?.includes("The user aborted a request")
    ) {
      return true;
    }

    // Promise rejection during navigation
    if (
      error?.message?.includes("Navigation cancelled") ||
      error?.message?.includes("Request cancelled")
    ) {
      return true;
    }

    // Zone.js promise rejections during component destruction
    if (error?.rejection?.name === "AbortError") {
      return true;
    }

    return false;
  }

  private isDevelopment(): boolean {
    return !this.isProduction();
  }

  private isProduction(): boolean {
    return (
      location.hostname !== "localhost" && location.hostname !== "127.0.0.1"
    );
  }
}
