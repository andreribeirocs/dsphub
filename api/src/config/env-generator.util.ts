import * as crypto from "crypto";

export class EnvGenerator {
  /**
   * Generate a cryptographically secure random string
   * @param length - Length of the string to generate
   * @param includeSpecialChars - Whether to include special characters
   * @returns Secure random string
   */
  static generateSecureSecret(
    length: number = 64,
    includeSpecialChars: boolean = true
  ): string {
    const alphanumeric =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const specialChars = "@#$%^&*()_+-=[]{}|;:,.<>?";
    const charset = includeSpecialChars
      ? alphanumeric + specialChars
      : alphanumeric;

    let result = "";
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, charset.length);
      result += charset[randomIndex];
    }

    return result;
  }

  /**
   * Generate JWT secrets with high entropy
   * @returns Object with JWT_SECRET and JWT_REFRESH_SECRET
   */
  static generateJWTSecrets(): {
    JWT_SECRET: string;
    JWT_REFRESH_SECRET: string;
  } {
    return {
      JWT_SECRET: this.generateSecureSecret(64),
      JWT_REFRESH_SECRET: this.generateSecureSecret(64),
    };
  }

  /**
   * Generate session secret
   * @returns Secure session secret
   */
  static generateSessionSecret(): string {
    return this.generateSecureSecret(64);
  }

  /**
   * Generate a complete secure environment template
   * @param environment - Target environment
   * @returns Environment variable template
   */
  static generateEnvironmentTemplate(
    environment: "development" | "production" = "development"
  ): string {
    const jwtSecrets = this.generateJWTSecrets();
    const sessionSecret = this.generateSessionSecret();

    const template = `# Generated Environment Configuration for ${environment.toUpperCase()}
# Generated on: ${new Date().toISOString()}

# Environment
NODE_ENV=${environment}
PORT=3000

# Database Configuration
# ${
      environment === "production"
        ? 'DATABASE_URL="postgresql://username:password@hostname:5432/database_name?sslmode=require"'
        : 'DATABASE_URL="postgresql://username:password@localhost:5432/database_name"'
    }

# JWT Configuration
JWT_SECRET="${jwtSecrets.JWT_SECRET}"
JWT_REFRESH_SECRET="${jwtSecrets.JWT_REFRESH_SECRET}"

# Session Configuration
SESSION_SECRET="${sessionSecret}"

# CORS Configuration
${
  environment === "production"
    ? 'CORS_ORIGIN="https://yourdomain.com,https://api.yourdomain.com"'
    : 'CORS_ORIGIN="http://localhost:4200,http://localhost:3000"'
}

# Messaging (WhatsApp/SMS) — no provider connected yet, see src/messaging
# RECRUITMENT_INVITE_TEMPLATE="registration_link"

# Security Configuration
BCRYPT_ROUNDS=${environment === "production" ? "14" : "12"}

# File Upload Limits (bytes)
MAX_FILE_SIZE=10485760      # 10MB
MAX_PDF_SIZE=25165824       # 24MB
MAX_IMAGE_SIZE=5242880      # 5MB
MAX_DOCUMENT_SIZE=10485760  # 10MB

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=60000      # 1 minute
RATE_LIMIT_MAX_REQUESTS=${environment === "production" ? "30" : "60"}
`;

    return template;
  }

  /**
   * Validate if a string has sufficient entropy for cryptographic use
   * @param secret - Secret to validate
   * @param minLength - Minimum required length
   * @returns Validation result
   */
  static validateSecretStrength(
    secret: string,
    minLength: number = 32
  ): {
    isValid: boolean;
    score: number;
    feedback: string[];
  } {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (secret.length < minLength) {
      feedback.push(`Secret should be at least ${minLength} characters long`);
    } else {
      score += 2;
    }

    // Character diversity checks
    if (/[a-z]/.test(secret)) score += 1;
    if (/[A-Z]/.test(secret)) score += 1;
    if (/[0-9]/.test(secret)) score += 1;
    if (/[^a-zA-Z0-9]/.test(secret)) score += 2;

    // Entropy estimation (simplified)
    const uniqueChars = new Set(secret).size;
    const entropyScore = uniqueChars / secret.length;
    if (entropyScore > 0.6) score += 2;
    else if (entropyScore > 0.4) score += 1;
    else feedback.push("Secret has low character diversity");

    // Common patterns check
    if (/(.)\1{2,}/.test(secret)) {
      feedback.push("Secret contains repeated characters");
      score -= 1;
    }

    if (/123|abc|qwerty|password/i.test(secret)) {
      feedback.push("Secret contains common patterns");
      score -= 2;
    }

    const isValid = score >= 6 && secret.length >= minLength;

    if (isValid) {
      feedback.push("Secret strength is acceptable");
    }

    return {
      isValid,
      score: Math.max(0, Math.min(10, score)),
      feedback,
    };
  }

  /**
   * CLI utility to generate new secrets
   */
  static logNewSecrets(): void {
    console.log("🔐 Generated Secure Environment Variables:");
    console.log("");

    const jwtSecrets = this.generateJWTSecrets();
    console.log(`JWT_SECRET="${jwtSecrets.JWT_SECRET}"`);
    console.log(`JWT_REFRESH_SECRET="${jwtSecrets.JWT_REFRESH_SECRET}"`);
    console.log(`SESSION_SECRET="${this.generateSessionSecret()}"`);

    console.log("");
    console.log(
      "⚠️  Store these securely and never commit them to version control!"
    );
  }
}
