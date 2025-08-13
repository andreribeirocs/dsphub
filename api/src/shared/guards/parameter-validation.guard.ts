import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class ParameterValidationGuard implements CanActivate {
  private readonly logger = new Logger(ParameterValidationGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    // Validate URL parameters
    this.validateParameters(request.params, "URL parameter");

    // Validate query parameters
    this.validateParameters(request.query, "Query parameter");

    return true;
  }

  private validateParameters(params: any, type: string): void {
    if (!params || typeof params !== "object") {
      return;
    }

    Object.entries(params).forEach(([key, value]) => {
      this.validateParameterKey(key, type);
      this.validateParameterValue(value, key, type);
    });
  }

  private validateParameterKey(key: string, type: string): void {
    // Check key length
    if (key.length > 100) {
      throw new BadRequestException(`${type} key too long: ${key}`);
    }

    // Check for dangerous characters in parameter names
    const dangerousKeyPattern = /[<>'";&\\]/;
    if (dangerousKeyPattern.test(key)) {
      this.logger.warn(`Suspicious parameter key detected: ${key}`);
      throw new BadRequestException(
        `Invalid character in ${type.toLowerCase()} key`
      );
    }

    // Check for SQL injection patterns in keys
    const sqlPattern =
      /\b(union|select|insert|update|delete|drop|create|alter|exec|script)\b/i;
    if (sqlPattern.test(key)) {
      this.logger.warn(`SQL injection attempt in parameter key: ${key}`);
      throw new BadRequestException(`Invalid ${type.toLowerCase()} key`);
    }
  }

  private validateParameterValue(value: any, key: string, type: string): void {
    if (value === null || value === undefined) {
      return;
    }

    const stringValue = String(value);

    // Check value length
    if (stringValue.length > 1000) {
      throw new BadRequestException(`${type} value too long for key: ${key}`);
    }

    // Check for XSS patterns
    const xssPatterns = [
      /<script\b/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe\b/i,
      /<object\b/i,
      /<embed\b/i,
    ];

    if (xssPatterns.some((pattern) => pattern.test(stringValue))) {
      this.logger.warn(
        `XSS attempt detected in ${type.toLowerCase()}: ${key}=${stringValue.substring(0, 50)}`
      );
      throw new BadRequestException(`Invalid content in ${type.toLowerCase()}`);
    }

    // Check for SQL injection patterns
    const sqlPatterns = [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec)\b.*\b(from|where|into)\b)/i,
      /('.*'|".*").*(\bor\b|\band\b)/i,
      /\b(exec|execute)\s*\(/i,
      /\bdrop\s+table\b/i,
    ];

    if (sqlPatterns.some((pattern) => pattern.test(stringValue))) {
      this.logger.warn(
        `SQL injection attempt in ${type.toLowerCase()}: ${key}=${stringValue.substring(0, 50)}`
      );
      throw new BadRequestException(`Invalid content in ${type.toLowerCase()}`);
    }

    // Check for path traversal
    const pathTraversalPattern = /\.\.\/|\.\.\\|\.\.\\/;
    if (pathTraversalPattern.test(stringValue)) {
      this.logger.warn(
        `Path traversal attempt in ${type.toLowerCase()}: ${key}=${stringValue}`
      );
      throw new BadRequestException(`Invalid path in ${type.toLowerCase()}`);
    }

    // Check for command injection
    const commandInjectionPattern = /[;&|`$(){}[\]]/;
    if (commandInjectionPattern.test(stringValue)) {
      this.logger.warn(
        `Command injection attempt in ${type.toLowerCase()}: ${key}=${stringValue.substring(0, 50)}`
      );
      throw new BadRequestException(
        `Invalid characters in ${type.toLowerCase()}`
      );
    }
  }
}
