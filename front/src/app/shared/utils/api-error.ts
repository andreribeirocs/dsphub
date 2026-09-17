import { HttpErrorResponse } from "@angular/common/http";

interface ValidationErrorItem {
  readonly field?: string;
  readonly constraints?: Record<string, string>;
}

/**
 * Human readable message from a NestJS error response.
 * Handles `message: string | string[]` and the API's validation shape
 * `{ message: "Validation failed", errors: [{ field, constraints }] }`.
 */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (err.status === 0) {
    return "Could not reach the server. Check your connection.";
  }
  if (err.status === 403) {
    return "You do not have permission to do this.";
  }

  const body: unknown = err.error;
  if (typeof body === "string" && body.trim()) {
    return body;
  }
  if (body && typeof body === "object") {
    const { message, errors } = body as { message?: unknown; errors?: unknown };
    if (Array.isArray(errors) && errors.length > 0) {
      const details = (errors as ValidationErrorItem[])
        .map((item) => {
          const constraints = item.constraints ? Object.values(item.constraints).join(", ") : "";
          return [item.field, constraints].filter(Boolean).join(": ");
        })
        .filter(Boolean);
      if (details.length > 0) {
        return details.join("\n");
      }
    }
    if (Array.isArray(message) && message.length > 0) {
      return message.map(String).join("\n");
    }
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}
