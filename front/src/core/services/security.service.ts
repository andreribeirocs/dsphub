import { Injectable, inject, DOCUMENT } from "@angular/core";

interface SecurityViolation {
  blockedURI?: string;
  disposition?: string;
  documentURI?: string;
  originalPolicy?: string;
  violatedDirective?: string;
  type?: string;
  [key: string]: unknown;
}

@Injectable({
  providedIn: "root",
})
export class SecurityService {
  private document = inject(DOCUMENT);

  constructor() {
    this.initializeSecurityMeasures();
  }

  private initializeSecurityMeasures(): void {
    // 🔒 Initialize all security measures
    this.setupContentSecurityPolicy();
    this.setupSecurityHeaders();
    this.preventClickjacking();
    this.setupCookieSecurity();

    if (this.isDevelopment()) {
      console.log("🔒 Angular 20 Security Service initialized");
      this.logSecurityStatus();
    }
  }

  private setupContentSecurityPolicy(): void {
    // 🛡️ Set up Content Security Policy
    const csp = this.generateCSPDirectives();

    // Create meta tag for CSP
    const metaTag = this.document.createElement("meta");
    metaTag.httpEquiv = "Content-Security-Policy";
    metaTag.content = csp;

    // Add to document head if not already present
    if (
      !this.document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    ) {
      this.document.head.appendChild(metaTag);
    }
  }

  private generateCSPDirectives(): string {
    // 🔧 Generate appropriate CSP based on environment
    const isDev = this.isDevelopment();

    const directives = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""}`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src 'self' https://fonts.gstatic.com`,
      `img-src 'self' data: https: blob:`,
      `connect-src 'self' ${this.getAllowedApiOrigins()}`,
      `frame-ancestors 'none'`,
      `base-uri 'self'`,
      `form-action 'self'`,
      `object-src 'none'`,
      `media-src 'self'`,
      `worker-src 'self' blob:`,
      `manifest-src 'self'`,
      `upgrade-insecure-requests`,
    ];

    return directives.join("; ");
  }

  private getAllowedApiOrigins(): string {
    // 🌐 Define allowed API origins based on environment
    const origins = ["http://localhost:3000", "http://localhost:3002"]; // Your API endpoints

    // Add production origins
    if (this.isProduction()) {
      origins.push("https://dsphub.co.uk");
    }

    return origins.join(" ");
  }

  private setupSecurityHeaders(): void {
    // 🔒 Set up additional security headers via meta tags
    const securityHeaders = [
      { name: "X-Content-Type-Options", content: "nosniff" },
      { name: "X-Frame-Options", content: "DENY" },
      { name: "X-XSS-Protection", content: "1; mode=block" },
      { name: "Referrer-Policy", content: "strict-origin-when-cross-origin" },
      {
        name: "Permissions-Policy",
        content: "camera=(), microphone=(), geolocation=()",
      },
    ];

    securityHeaders.forEach((header) => {
      if (!this.document.querySelector(`meta[http-equiv="${header.name}"]`)) {
        const metaTag = this.document.createElement("meta");
        metaTag.httpEquiv = header.name;
        metaTag.content = header.content;
        this.document.head.appendChild(metaTag);
      }
    });
  }

  private preventClickjacking(): void {
    // 🚫 Prevent clickjacking attacks
    if (window.top !== window.self) {
      // App is being framed - this could be a clickjacking attempt
      window.top!.location.href = window.self.location.href;
    }
  }

  private setupCookieSecurity(): void {
    // 🍪 Ensure secure cookie handling
    this.setCookieDefaults();
  }

  private setCookieDefaults(): void {
    // 🔐 Set secure defaults for cookies
    const originalCookieDescriptor =
      Object.getOwnPropertyDescriptor(Document.prototype, "cookie") ||
      Object.getOwnPropertyDescriptor(HTMLDocument.prototype, "cookie");

    if (originalCookieDescriptor && originalCookieDescriptor.set) {
      Object.defineProperty(this.document, "cookie", {
        set: function (value: string) {
          // 🔒 Automatically add security attributes to cookies
          if (!value.includes("Secure") && location.protocol === "https:") {
            value += "; Secure";
          }
          if (!value.includes("SameSite")) {
            value += "; SameSite=Strict";
          }
          if (!value.includes("HttpOnly") && !value.includes("auth-token")) {
            // Don't add HttpOnly to auth tokens that need to be accessible via JS
            value += "; HttpOnly";
          }

          return originalCookieDescriptor.set!.call(this, value);
        },
        get: originalCookieDescriptor.get,
      });
    }
  }

  // 🔍 Security validation methods
  sanitizeInput(input: string): string {
    // 🧹 Basic input sanitization
    if (!input) return "";

    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove script tags
      .replace(/javascript:/gi, "") // Remove javascript: protocols
      .replace(/on\w+="[^"]*"/gi, "") // Remove event handlers
      .replace(/on\w+='[^']*'/gi, "") // Remove event handlers (single quotes)
      .trim();
  }

  validateURL(url: string): boolean {
    // 🔗 Validate URLs to prevent XSS via href
    try {
      const parsedUrl = new URL(url, window.location.origin);
      const allowedProtocols = ["http:", "https:", "mailto:", "tel:"];
      return allowedProtocols.includes(parsedUrl.protocol);
    } catch {
      return false;
    }
  }

  // 📊 Security monitoring
  private logSecurityStatus(): void {
    console.group("🔒 Angular 20 Security Status");
    console.log(
      "✅ Content Security Policy:",
      this.document
        .querySelector('meta[http-equiv="Content-Security-Policy"]')
        ?.getAttribute("content")
    );
    console.log(
      "✅ X-Frame-Options:",
      this.document
        .querySelector('meta[http-equiv="X-Frame-Options"]')
        ?.getAttribute("content")
    );
    console.log(
      "✅ Environment:",
      this.isDevelopment() ? "Development" : "Production"
    );
    console.log(
      "✅ HTTPS:",
      location.protocol === "https:" ? "Enabled" : "Disabled"
    );
    console.groupEnd();
  }

  reportSecurityViolation(violation: SecurityViolation): void {
    // 🚨 Handle CSP violations and other security events
    console.warn("🚨 Security Violation Detected:", violation);

    // In production, send to monitoring service
    if (this.isProduction()) {
      this.reportToSecurityMonitoring(violation);
    }
  }

  private reportToSecurityMonitoring(violation: SecurityViolation): void {
    // 📊 Report security violations to monitoring service
    const report = {
      type: "security_violation",
      violation: violation,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    };

    // Send to your security monitoring endpoint
    // fetch('/api/security/violations', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(report)
    // }).catch(() => {
    //   // Silently fail if reporting fails
    // });

    console.log("Security Report (would be sent to monitoring):", report);
  }

  private isDevelopment(): boolean {
    return (
      location.hostname === "localhost" || location.hostname === "127.0.0.1"
    );
  }

  private isProduction(): boolean {
    return !this.isDevelopment();
  }
}
