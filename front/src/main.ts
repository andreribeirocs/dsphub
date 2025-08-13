import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";

// 🚀 Angular 20: Suppress AbortError console logs from Zone.js
const originalConsoleError = console.error;
console.error = function (...args: any[]) {
  // Check if this is an AbortError log we want to suppress
  const message = args.join(" ");
  if (message.includes("AbortError") && message.includes("aborted")) {
    // Suppress this specific error log
    return;
  }
  // Call original console.error for all other messages
  return originalConsoleError.apply(console, args);
};

// 🚀 Angular 20: Also suppress unhandled promise rejection logs for AbortError
window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason?.name === "AbortError" &&
    event.reason?.message?.includes("aborted")
  ) {
    event.preventDefault(); // Prevent the default console logging
  }
});

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
