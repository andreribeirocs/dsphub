import { Injectable, Logger } from "@nestjs/common";
import * as Joi from "joi";

export interface EnvironmentVariables {
  readonly NODE_ENV: "development" | "production" | "test";
  readonly PORT: number;
  readonly DATABASE_URL: string;
  readonly JWT_SECRET: string;
  readonly JWT_REFRESH_SECRET?: string;
  readonly CORS_ORIGIN?: string;
  readonly MAX_FILE_SIZE?: number;
  readonly MAX_PDF_SIZE?: number;
  readonly MAX_IMAGE_SIZE?: number;
  readonly MAX_DOCUMENT_SIZE?: number;
  readonly RATE_LIMIT_WINDOW_MS?: number;
  readonly RATE_LIMIT_MAX_REQUESTS?: number;
  readonly BCRYPT_ROUNDS?: number;
  readonly SESSION_SECRET?: string;
}

@Injectable()
export class EnvValidationService {
  private readonly logger = new Logger(EnvValidationService.name);

  // Define the validation schema
  private readonly validationSchema = Joi.object<EnvironmentVariables>({
    NODE_ENV: Joi.string()
      .valid("development", "production", "test")
      .default("development"),

    PORT: Joi.number().port().default(3000),

    DATABASE_URL: Joi.string()
      .pattern(/^postgresql:\/\//)
      .required()
      .description("Must be a valid PostgreSQL connection string"),

    JWT_SECRET: Joi.string()
      .min(32)
      .pattern(/^[A-Za-z0-9@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`!]+$/)
      .required()
      .description(
        "Must be at least 32 characters with mixed alphanumeric and special characters"
      ),

    JWT_REFRESH_SECRET: Joi.string()
      .min(32)
      .pattern(/^[A-Za-z0-9@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`!]+$/)
      .optional()
      .description(
        "Must be at least 32 characters with mixed alphanumeric and special characters"
      ),

    CORS_ORIGIN: Joi.string()
      .pattern(/^https?:\/\/[^\s,]+(,\s*https?:\/\/[^\s,]+)*$/)
      .optional()
      .description("Must be valid HTTP/HTTPS URLs separated by commas"),

    MAX_FILE_SIZE: Joi.number()
      .min(1024) // 1KB minimum
      .max(104857600) // 100MB maximum
      .default(10485760), // 10MB default

    MAX_PDF_SIZE: Joi.number().min(1024).max(104857600).default(25165824), // 24MB default

    MAX_IMAGE_SIZE: Joi.number()
      .min(1024)
      .max(52428800) // 50MB maximum for images
      .default(5242880), // 5MB default

    MAX_DOCUMENT_SIZE: Joi.number().min(1024).max(104857600).default(10485760), // 10MB default

    RATE_LIMIT_WINDOW_MS: Joi.number()
      .min(1000) // 1 second minimum
      .max(3600000) // 1 hour maximum
      .default(60000), // 1 minute default

    RATE_LIMIT_MAX_REQUESTS: Joi.number().min(1).max(10000).default(60),

    BCRYPT_ROUNDS: Joi.number()
      .min(10)
      .max(20)
      .default(12)
      .description("Bcrypt rounds should be between 10-20 for security"),

    SESSION_SECRET: Joi.string()
      .min(32)
      .optional()
      .description("Session secret should be at least 32 characters"),
  });

  validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
    this.logger.log("🔍 Validating environment variables...");

    const { error, value } = this.validationSchema.validate(config, {
      allowUnknown: true, // Allow other environment variables
      abortEarly: false, // Collect all errors
    });

    if (error) {
      const errorMessages = error.details.map((detail) => {
        const key = detail.path.join(".");
        const message = detail.message;
        const description = detail.context?.label || "No description available";
        return `❌ ${key}: ${message} (${description})`;
      });

      this.logger.error("🚨 Environment validation failed:");
      errorMessages.forEach((msg) => this.logger.error(msg));

      throw new Error(
        `Environment validation failed:\n${errorMessages.join("\n")}`
      );
    }

    // Additional security validations
    this.performSecurityChecks(value);

    this.logger.log("✅ Environment validation passed");
    return value;
  }

  private performSecurityChecks(config: EnvironmentVariables): void {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for production security requirements
    if (config.NODE_ENV === "production") {
      if (!config.CORS_ORIGIN) {
        errors.push("CORS_ORIGIN must be set in production");
      }

      if (config.JWT_SECRET.length < 64) {
        warnings.push(
          "JWT_SECRET should be at least 64 characters in production"
        );
      }

      if (!config.JWT_REFRESH_SECRET) {
        warnings.push(
          "JWT_REFRESH_SECRET should be set in production for enhanced security"
        );
      }
    }

    // Check for weak configurations
    if (
      config.JWT_SECRET === config.JWT_REFRESH_SECRET &&
      config.JWT_REFRESH_SECRET
    ) {
      errors.push("JWT_SECRET and JWT_REFRESH_SECRET must be different");
    }

    // Check database URL security
    if (
      config.DATABASE_URL.includes("localhost") &&
      config.NODE_ENV === "production"
    ) {
      warnings.push("Using localhost database connection in production");
    }

    // Only flag weak credentials as errors in production
    if (config.NODE_ENV === "production") {
      if (
        config.DATABASE_URL.includes("123456") ||
        config.DATABASE_URL.includes("password")
      ) {
        errors.push("Database URL contains weak or default credentials in production");
      }
    } else {
      // In development, just warn about weak passwords
      if (
        config.DATABASE_URL.includes("123456") ||
        config.DATABASE_URL.includes("password")
      ) {
        warnings.push("Database URL contains weak credentials (acceptable for development)");
      }
    }

    // Log warnings
    if (warnings.length > 0) {
      this.logger.warn("⚠️  Environment configuration warnings:");
      warnings.forEach((warning) => this.logger.warn(`⚠️  ${warning}`));
    }

    // Throw errors
    if (errors.length > 0) {
      this.logger.error("🚨 Critical environment security issues:");
      errors.forEach((error) => this.logger.error(`❌ ${error}`));
      throw new Error(`Critical security issues found:\n${errors.join("\n")}`);
    }

    // Log security status
    this.logger.log("🔒 Security checks passed");
    this.logConfigurationSummary(config);
  }

  private logConfigurationSummary(config: EnvironmentVariables): void {
    this.logger.log("📋 Configuration Summary:");
    this.logger.log(`   Environment: ${config.NODE_ENV}`);
    this.logger.log(`   Port: ${config.PORT}`);
    this.logger.log(
      `   Database: ${config.DATABASE_URL.split("@")[1]?.split("/")[0] || "configured"}`
    );
    this.logger.log(
      `   CORS Origins: ${config.CORS_ORIGIN ? config.CORS_ORIGIN.split(",").length + " origin(s)" : "None"}`
    );
    this.logger.log(
      `   File Upload Limits: PDF:${Math.round((config.MAX_PDF_SIZE || 0) / 1024 / 1024)}MB, Images:${Math.round((config.MAX_IMAGE_SIZE || 0) / 1024 / 1024)}MB`
    );
    this.logger.log(
      `   Rate Limiting: ${config.RATE_LIMIT_MAX_REQUESTS}req/${Math.round((config.RATE_LIMIT_WINDOW_MS || 0) / 1000)}s`
    );
    this.logger.log(
      `   Security Features: JWT:✅, Bcrypt:${config.BCRYPT_ROUNDS}rounds`
    );
  }
}
