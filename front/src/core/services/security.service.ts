import { Injectable } from "@angular/core";

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
  constructor() {
    this.initializeSecurityMeasures();
  }

  private initializeSecurityMeasures(): void {
    // Security headers (CSP, X-Frame-Options, frame-ancestors, nosniff, Referrer-Policy)
    // must be sent as HTTP headers by whatever serves the app: helmet in the API,
    // angular.json "serve.options.headers" in dev, and the web server/CDN in production.
    // Browsers ignore X-Frame-Options and frame-ancestors in <meta>, so they are not set here.
    this.preventClickjacking();

    if (this.isDevelopment()) {
      console.log("🔒 Angular 20 Security Service initialized");
      this.logSecurityStatus();
    }
  }

  private preventClickjacking(): void {
    // Fallback only — the real protection is the frame-ancestors / X-Frame-Options header
    if (window.top !== window.self) {
      window.top!.location.href = window.self.location.href;
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
