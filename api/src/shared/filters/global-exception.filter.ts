import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Response } from "express";
import { ThrottlerException } from "@nestjs/throttler";

interface ErrorResponse {
  readonly statusCode: number;
  readonly message: string | string[];
  readonly error: string;
  readonly timestamp: string;
  readonly path: string;
  readonly requestId?: string;
}

interface DetailedErrorLog {
  readonly timestamp: string;
  readonly path: string;
  readonly method: string;
  readonly statusCode: number;
  readonly userAgent?: string;
  readonly ip?: string;
  readonly userId?: string;
  readonly error: {
    readonly name: string;
    readonly message: string;
    readonly stack?: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status = this.getHttpStatus(exception);
    const errorResponse = this.createErrorResponse(exception, request, status);

    // Log detailed error information (server-side only)
    this.logDetailedError(exception, request, status);

    response.status(status).json(errorResponse);
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }

    if (exception instanceof ThrottlerException) {
      return HttpStatus.TOO_MANY_REQUESTS;
    }

    // Default to 500 for unknown errors
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private createErrorResponse(
    exception: unknown,
    request: any,
    status: number
  ): ErrorResponse {
    const timestamp = new Date().toISOString();
    const path = request.url;

    // For HTTP exceptions, we can safely return some information
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        return {
          statusCode: status,
          message: responseObj.message || exception.message,
          error: this.getErrorName(status),
          timestamp,
          path,
        };
      }

      return {
        statusCode: status,
        message: exception.message,
        error: this.getErrorName(status),
        timestamp,
        path,
      };
    }

    // For throttling exceptions
    if (exception instanceof ThrottlerException) {
      return {
        statusCode: status,
        message: "Too many requests. Please try again later.",
        error: "Too Many Requests",
        timestamp,
        path,
      };
    }

    // For unknown/internal errors, return generic message
    return {
      statusCode: status,
      message: "An internal server error occurred. Please try again later.",
      error: "Internal Server Error",
      timestamp,
      path,
    };
  }

  private getErrorName(status: number): string {
    const errorNames: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      405: "Method Not Allowed",
      406: "Not Acceptable",
      408: "Request Timeout",
      409: "Conflict",
      410: "Gone",
      413: "Payload Too Large",
      415: "Unsupported Media Type",
      422: "Unprocessable Entity",
      429: "Too Many Requests",
      500: "Internal Server Error",
      501: "Not Implemented",
      502: "Bad Gateway",
      503: "Service Unavailable",
      504: "Gateway Timeout",
    };

    return errorNames[status] || "Unknown Error";
  }

  private logDetailedError(
    exception: unknown,
    request: any,
    status: number
  ): void {
    const detailedLog: DetailedErrorLog = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      statusCode: status,
      userAgent: request.headers["user-agent"],
      ip: this.getClientIp(request),
      userId: request.user?.id || "anonymous",
      error: {
        name:
          exception instanceof Error
            ? exception.constructor.name
            : "UnknownError",
        message:
          exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      },
    };

    // Log based on severity
    if (status >= 500) {
      this.logger.error(
        "Internal Server Error:",
        JSON.stringify(detailedLog, null, 2)
      );
    } else if (status >= 400) {
      this.logger.warn("Client Error:", JSON.stringify(detailedLog, null, 2));
    } else {
      this.logger.log(
        "Request completed with warnings:",
        JSON.stringify(detailedLog, null, 2)
      );
    }

    // Additional security logging for specific patterns
    this.logSecurityEvents(exception, request, detailedLog);
  }

  private logSecurityEvents(
    exception: unknown,
    request: any,
    detailedLog: DetailedErrorLog
  ): void {
    const suspiciousPatterns = [
      {
        pattern: /sql|union|select|insert|drop|delete/i,
        category: "SQL_INJECTION_ATTEMPT",
      },
      { pattern: /<script|javascript:|onclick/i, category: "XSS_ATTEMPT" },
      { pattern: /\.\.\/|\.\.\\|\.\.\//i, category: "PATH_TRAVERSAL_ATTEMPT" },
      {
        pattern: /exec|eval|system|cmd/i,
        category: "COMMAND_INJECTION_ATTEMPT",
      },
    ];

    const requestData = JSON.stringify({
      body: request.body,
      params: request.params,
      query: request.query,
    });

    suspiciousPatterns.forEach(({ pattern, category }) => {
      if (
        pattern.test(requestData) ||
        (exception instanceof Error && pattern.test(exception.message))
      ) {
        this.logger.error(`SECURITY ALERT - ${category}:`, {
          ...detailedLog,
          suspiciousContent: requestData.substring(0, 200),
        });
      }
    });
  }

  private getClientIp(request: any): string {
    return (
      request.headers["x-forwarded-for"]?.split(",")[0] ||
      request.headers["x-real-ip"] ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      "unknown"
    );
  }
}
