import {
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  HttpException,
} from "@nestjs/common";

export class SecureErrorUtil {
  private static readonly logger = new Logger(SecureErrorUtil.name);

  /**
   * Creates a secure error response that doesn't leak internal information
   */
  static createSecureError(
    error: unknown,
    context: string,
    fallbackMessage: string = "An error occurred"
  ): HttpException {
    // Log the actual error for debugging (server-side only)
    this.logError(error, context);

    // Return safe, generic errors to clients
    if (error instanceof HttpException) {
      // Re-throw known HTTP exceptions as they are already safe
      return error;
    }

    if (error instanceof Error) {
      // Check if it's a known safe error pattern
      if (this.isSafeErrorMessage(error.message)) {
        return new BadRequestException(error.message);
      }
    }

    // For all other errors, return a generic message
    return new InternalServerErrorException(fallbackMessage);
  }

  /**
   * Database operation error handler
   */
  static handleDatabaseError(error: unknown, operation: string): HttpException {
    this.logger.error(`Database ${operation} error:`, error);

    if (error instanceof Error) {
      // Handle specific database errors without exposing details
      if (error.message.includes("Unique constraint")) {
        return new BadRequestException("This record already exists");
      }

      if (error.message.includes("Foreign key constraint")) {
        return new BadRequestException(
          "Cannot complete operation due to related data"
        );
      }

      if (error.message.includes("Record to update not found")) {
        return new NotFoundException("Record not found");
      }

      if (error.message.includes("Authentication failed")) {
        return new UnauthorizedException("Database authentication failed");
      }
    }

    return new InternalServerErrorException(
      `Failed to ${operation}. Please try again later.`
    );
  }

  /**
   * External service error handler
   */
  static handleExternalServiceError(
    error: unknown,
    serviceName: string,
    operation: string
  ): HttpException {
    this.logger.error(
      `${serviceName} service error during ${operation}:`,
      error
    );

    if (error instanceof Error) {
      // Handle specific external service errors
      if (
        error.message.includes("timeout") ||
        error.message.includes("TIMEOUT")
      ) {
        return new BadRequestException(
          `${serviceName} service is temporarily unavailable`
        );
      }

      if (
        error.message.includes("rate limit") ||
        error.message.includes("RATE_LIMIT")
      ) {
        return new BadRequestException(
          `Too many requests to ${serviceName} service`
        );
      }

      if (
        error.message.includes("authentication") ||
        error.message.includes("unauthorized")
      ) {
        return new InternalServerErrorException(
          `${serviceName} service configuration error`
        );
      }
    }

    return new InternalServerErrorException(
      `${serviceName} service is currently unavailable. Please try again later.`
    );
  }

  /**
   * File processing error handler
   */
  static handleFileProcessingError(
    error: unknown,
    operation: string
  ): HttpException {
    this.logger.error(`File ${operation} error:`, error);

    if (error instanceof Error) {
      if (
        error.message.includes("ENOENT") ||
        error.message.includes("file not found")
      ) {
        return new NotFoundException("File not found");
      }

      if (
        error.message.includes("EACCES") ||
        error.message.includes("permission denied")
      ) {
        return new BadRequestException("File access denied");
      }

      if (error.message.includes("size") || error.message.includes("SIZE")) {
        return new BadRequestException("File size exceeds allowed limit");
      }

      if (
        error.message.includes("format") ||
        error.message.includes("invalid")
      ) {
        return new BadRequestException("Invalid file format");
      }
    }

    return new BadRequestException(
      `Failed to process file. Please ensure the file is valid and try again.`
    );
  }

  /**
   * Validation error handler for better user experience
   */
  static handleValidationError(error: unknown): HttpException {
    if (error instanceof HttpException) {
      return error; // Already a proper validation error
    }

    this.logger.warn("Unexpected validation error:", error);
    return new BadRequestException("Invalid input provided");
  }

  /**
   * Authentication error handler
   */
  static handleAuthError(error: unknown, context: string): HttpException {
    this.logger.warn(`Authentication error in ${context}:`, error);

    if (error instanceof Error) {
      if (
        error.message.includes("expired") ||
        error.message.includes("invalid token")
      ) {
        return new UnauthorizedException("Authentication token has expired");
      }

      if (
        error.message.includes("malformed") ||
        error.message.includes("invalid format")
      ) {
        return new UnauthorizedException("Invalid authentication format");
      }
    }

    return new UnauthorizedException("Authentication failed");
  }

  /**
   * Check if an error message is safe to expose to clients
   */
  private static isSafeErrorMessage(message: string): boolean {
    // Messages that are safe to show to users
    const safePatterns = [
      /^Invalid .+ format$/,
      /^.+ is required$/,
      /^.+ must be .+$/,
      /^Please provide .+$/,
      /^.+ not found$/,
      /^.+ already exists$/,
      /^Access denied$/,
      /^Unauthorized$/,
      /^Forbidden$/,
    ];

    // Messages that should never be exposed
    const unsafePatterns = [
      /password/i,
      /secret/i,
      /key/i,
      /token/i,
      /database/i,
      /sql/i,
      /connection/i,
      /server/i,
      /internal/i,
      /stack trace/i,
      /error at/i,
      /\.js:/,
      /\.ts:/,
      /node_modules/i,
    ];

    // Check if message contains unsafe content
    if (unsafePatterns.some((pattern) => pattern.test(message))) {
      return false;
    }

    // Check if message matches safe patterns
    return safePatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Log errors securely with context
   */
  private static logError(error: unknown, context: string): void {
    const errorInfo = {
      context,
      timestamp: new Date().toISOString(),
      error: {
        name: error instanceof Error ? error.constructor.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
    };

    if (error instanceof HttpException) {
      this.logger.warn(`HTTP Exception in ${context}:`, errorInfo);
    } else {
      this.logger.error(`Unhandled error in ${context}:`, errorInfo);
    }
  }

  /**
   * Create user-friendly error messages for common HTTP status codes
   */
  static getUserFriendlyMessage(statusCode: number): string {
    const messages: Record<number, string> = {
      400: "The request contains invalid data. Please check your input and try again.",
      401: "Authentication is required. Please log in and try again.",
      403: "You do not have permission to perform this action.",
      404: "The requested resource was not found.",
      405: "This operation is not allowed.",
      409: "This action conflicts with existing data.",
      413: "The file or data is too large.",
      415: "The file type is not supported.",
      422: "The data provided is not valid.",
      429: "Too many requests. Please wait a moment and try again.",
      500: "An internal server error occurred. Please try again later.",
      502: "The service is temporarily unavailable.",
      503: "The service is under maintenance. Please try again later.",
      504: "The request timed out. Please try again.",
    };

    return (
      messages[statusCode] ||
      "An unexpected error occurred. Please try again later."
    );
  }
}
