import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";
import { Transform } from "class-transformer";
import * as sanitizeHtml from "sanitize-html";
import * as validator from "validator";

// XSS Prevention Validator
@ValidatorConstraint({ name: "noXSS", async: false })
export class NoXSSConstraint implements ValidatorConstraintInterface {
  validate(text: string): boolean {
    if (!text) return true; // Allow empty strings, handle with other validators

    // Check for common XSS patterns
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // onclick, onload, etc.
      /<object\b/gi,
      /<embed\b/gi,
      /<applet\b/gi,
      /<meta\b/gi,
      /<link\b/gi,
    ];

    return !xssPatterns.some((pattern) => pattern.test(text));
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} contains potentially dangerous content`;
  }
}

// Safe HTML Validator (allows specific tags)
@ValidatorConstraint({ name: "safeHtml", async: false })
export class SafeHtmlConstraint implements ValidatorConstraintInterface {
  validate(text: string): boolean {
    if (!text) return true;

    const clean = sanitizeHtml(text, {
      allowedTags: ["b", "i", "em", "strong", "p", "br"],
      allowedAttributes: {},
    });

    // If sanitized version is different, it contained dangerous content
    return clean === text;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} contains disallowed HTML tags or attributes`;
  }
}

// Phone Number Validator
@ValidatorConstraint({ name: "phoneNumber", async: false })
export class PhoneNumberConstraint implements ValidatorConstraintInterface {
  validate(phone: string): boolean {
    if (!phone) return true;

    // Remove all non-digit characters except +
    const cleaned = phone.replace(/[^\d+]/g, "");

    // Must start with + followed by 7-15 digits
    return /^\+[1-9]\d{6,14}$/.test(cleaned);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid international phone number (e.g., +447700900123)`;
  }
}

// Strong Password Validator
@ValidatorConstraint({ name: "strongPassword", async: false })
export class StrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(password: string): boolean {
    if (!password) return true;

    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongPasswordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be at least 8 characters with uppercase, lowercase, number, and special character`;
  }
}

// SQL Injection Pattern Validator
@ValidatorConstraint({ name: "noSqlInjection", async: false })
export class NoSqlInjectionConstraint implements ValidatorConstraintInterface {
  validate(text: string): boolean {
    if (!text) return true;

    // Common SQL injection patterns
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
      /('|(\\')|(;)|(\\;)|(\|\|)|(\/\*))/gi,
      /((\%27)|(\'))\s*((\%6F)|o|(\%4F))\s*((\%72)|r|(\%52))/gi, // ' or
      /(\%27)|(\')(\s)*UNION/gi,
    ];

    return !sqlPatterns.some((pattern) => pattern.test(text));
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} contains potentially dangerous SQL patterns`;
  }
}

// Custom Validation Decorators
export function NoXSS(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoXSSConstraint,
    });
  };
}

export function SafeHtml(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: SafeHtmlConstraint,
    });
  };
}

export function IsPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: PhoneNumberConstraint,
    });
  };
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: StrongPasswordConstraint,
    });
  };
}

export function NoSqlInjection(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoSqlInjectionConstraint,
    });
  };
}

// Sanitization Transforms
export function SanitizeHtml(options?: sanitizeHtml.IOptions) {
  const sanitizeOptions = options || {
    allowedTags: ["b", "i", "em", "strong", "p", "br"],
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  };

  return Transform(({ value }) => {
    if (typeof value === "string") {
      return sanitizeHtml(value, sanitizeOptions);
    }
    return value;
  });
}

export function TrimWhitespace() {
  return Transform(({ value }) => {
    if (typeof value === "string") {
      return value.trim();
    }
    return value;
  });
}

export function NormalizePhone() {
  return Transform(({ value }) => {
    if (typeof value === "string") {
      // Remove all non-digit characters except +
      let cleaned = value.replace(/[^\d+]/g, "");

      // If it doesn't start with +, add +44 for UK numbers starting with 0
      if (cleaned.startsWith("0")) {
        cleaned = "+44" + cleaned.substring(1);
      } else if (!cleaned.startsWith("+")) {
        // If no + and doesn't start with 0, assume it needs +44
        cleaned = "+44" + cleaned;
      }

      return cleaned;
    }
    return value;
  });
}

export function NormalizeEmail() {
  return Transform(({ value }) => {
    if (typeof value === "string") {
      return (
        validator.normalizeEmail(value, {
          gmail_lowercase: true,
          gmail_remove_dots: false,
          gmail_remove_subaddress: false,
          outlookdotcom_lowercase: true,
          outlookdotcom_remove_subaddress: false,
          yahoo_lowercase: true,
          yahoo_remove_subaddress: false,
          icloud_lowercase: true,
          icloud_remove_subaddress: false,
        }) || value
      );
    }
    return value;
  });
}
