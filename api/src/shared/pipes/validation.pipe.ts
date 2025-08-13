import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ValidationPipe as NestValidationPipe } from "@nestjs/common";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import * as sanitizeHtml from "sanitize-html";

@Injectable()
export class EnhancedValidationPipe extends NestValidationPipe {
  private readonly logger = new Logger(EnhancedValidationPipe.name);

  constructor() {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      validationError: {
        target: false,
        value: false,
      },
    });
  }

  async transform(value: any, metadata: ArgumentMetadata): Promise<any> {
    // Log potentially suspicious input
    this.logSuspiciousInput(value, metadata);

    // Apply basic sanitization before validation
    const sanitizedValue = this.sanitizeInput(value);

    // Call parent validation
    return super.transform(sanitizedValue, metadata);
  }

  private sanitizeInput(value: any): any {
    if (typeof value === "string") {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.sanitizeInput(item));
    }

    if (value !== null && typeof value === "object") {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.sanitizeInput(val);
      }
      return sanitized;
    }

    return value;
  }

  private sanitizeString(input: string): string {
    // Basic XSS protection - remove script tags and dangerous attributes
    const withoutScripts = sanitizeHtml(input, {
      allowedTags: [], // No HTML tags allowed by default
      allowedAttributes: {},
      disallowedTagsMode: "discard",
    });

    // Remove null bytes and other dangerous characters
    return withoutScripts
      .replace(/\0/g, "") // Remove null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // Remove control characters
      .trim();
  }

  private logSuspiciousInput(value: any, metadata: ArgumentMetadata): void {
    if (typeof value === "string") {
      const suspiciousPatterns = [
        { pattern: /<script/gi, name: "Script tag" },
        { pattern: /javascript:/gi, name: "JavaScript protocol" },
        { pattern: /on\w+=/gi, name: "Event handler" },
        { pattern: /union.*select/gi, name: "SQL injection attempt" },
        { pattern: /drop.*table/gi, name: "SQL drop attempt" },
        { pattern: /insert.*into/gi, name: "SQL insert attempt" },
        { pattern: /\.\.\/|\.\.\\|\.\.\//gi, name: "Path traversal" },
      ];

      suspiciousPatterns.forEach(({ pattern, name }) => {
        if (pattern.test(value)) {
          this.logger.warn(
            `Suspicious input detected in ${metadata.data || "unknown"}: ${name}`
          );
          this.logger.warn(
            `Input: ${value.substring(0, 100)}${value.length > 100 ? "..." : ""}`
          );
        }
      });
    }
  }
}

@Injectable()
export class SanitizationPipe implements PipeTransform {
  private readonly logger = new Logger(SanitizationPipe.name);

  transform(value: any, metadata: ArgumentMetadata): any {
    if (
      metadata.type === "body" ||
      metadata.type === "query" ||
      metadata.type === "param"
    ) {
      return this.deepSanitize(value);
    }
    return value;
  }

  private deepSanitize(obj: any): any {
    if (typeof obj === "string") {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepSanitize(item));
    }

    if (obj !== null && typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.deepSanitize(value);
      }
      return sanitized;
    }

    return obj;
  }

  private sanitizeString(input: string): string {
    // Comprehensive sanitization
    return sanitizeHtml(input, {
      allowedTags: ["b", "i", "em", "strong", "p", "br"], // Very limited HTML
      allowedAttributes: {},
      allowedSchemes: ["http", "https", "mailto"],
      disallowedTagsMode: "discard",
      selfClosing: ["br"],
    });
  }
}

@Injectable()
export class InputLengthValidationPipe implements PipeTransform {
  private readonly logger = new Logger(InputLengthValidationPipe.name);

  constructor(
    private readonly maxStringLength: number = 10000,
    private readonly maxArrayLength: number = 1000,
    private readonly maxObjectDepth: number = 10
  ) {}

  transform(value: any, metadata: ArgumentMetadata): any {
    this.validateInputSize(value, 0);
    return value;
  }

  private validateInputSize(obj: any, depth: number): void {
    if (depth > this.maxObjectDepth) {
      throw new BadRequestException(
        "Input object depth exceeds maximum allowed"
      );
    }

    if (typeof obj === "string") {
      if (obj.length > this.maxStringLength) {
        throw new BadRequestException(
          `String length exceeds maximum of ${this.maxStringLength} characters`
        );
      }
    }

    if (Array.isArray(obj)) {
      if (obj.length > this.maxArrayLength) {
        throw new BadRequestException(
          `Array length exceeds maximum of ${this.maxArrayLength} items`
        );
      }
      obj.forEach((item) => this.validateInputSize(item, depth + 1));
    }

    if (obj !== null && typeof obj === "object") {
      const keys = Object.keys(obj);
      if (keys.length > 100) {
        // Prevent objects with too many properties
        throw new BadRequestException("Object has too many properties");
      }
      keys.forEach((key) => {
        if (key.length > 100) {
          throw new BadRequestException("Property name too long");
        }
        this.validateInputSize(obj[key], depth + 1);
      });
    }
  }
}
