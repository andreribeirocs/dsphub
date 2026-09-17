import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  EnhancedValidationPipe,
  InputLengthValidationPipe,
} from "./shared/pipes/validation.pipe";
import * as express from "express";
import * as cookieParser from "cookie-parser";
import helmet from "helmet";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });

  const isProduction = process.env.NODE_ENV === "production";

  // Security headers (HTTP headers, not <meta> — browsers ignore X-Frame-Options
  // and CSP frame-ancestors when set via <meta>)
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "frame-ancestors": ["'none'"],
          "object-src": ["'none'"],
          "base-uri": ["'self'"],
          // Swagger UI (/api) uses inline styles and data: images
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:"],
          // In dev (http://localhost) upgrading requests to https would break Swagger
          "upgrade-insecure-requests": isProduction ? [] : null,
        },
      },
      frameguard: { action: "deny" },
      // Front (e.g. localhost:4200 / app.domain) loads /uploads images from the API.
      // "same-site" allows sibling subdomains; revisit if a DSP uses a separate domain.
      crossOriginResourcePolicy: { policy: "same-site" },
      hsts: isProduction,
    })
  );

  // Configure body parser for larger payloads (50MB limit for file uploads)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Configure cookie parser for Better Auth session cookies
  app.use(cookieParser());

  // Uploaded files are NOT served statically: avatars go through
  // GET /api/uploads/avatars/:file and invoice PDFs through
  // GET /api/invoices/:id/pdf, both authenticated and scoped to the DSP.

  app.useGlobalPipes(
    new InputLengthValidationPipe(50000000), // 50MB for file uploads
    new EnhancedValidationPipe()
  );

  // Set global prefix for all routes
  app.setGlobalPrefix("api");

  // Configure CORS securely based on environment
  const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : process.env.NODE_ENV === "production"
      ? [] // No origins allowed in production without explicit configuration
      : [
          "http://localhost:4200",
          "http://localhost:3000",
          "http://192.168.2.254:4200",
        ]; // Development defaults

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["X-Total-Count"],
    maxAge: 86400, // 24 hours
  });

  // Behind a reverse proxy, trust X-Forwarded-Host so the DSP is resolved
  // from the domain the visitor used
  if (process.env.TRUST_PROXY === "true") {
    app.getHttpAdapter().getInstance().set("trust proxy", true);
  }

  if (!isProduction) {
    const config = new DocumentBuilder()
      .setTitle("DSPHub API")
      .setDescription("The DSPHub Management System API")
      .setVersion("1.0")
      .addTag("health", "Health check and system status endpoints")
      .addTag("auth", "Authentication endpoints")
      .addTag("session", "Session management endpoints")
      .addTag("users", "User management endpoints")
      .addTag("recruitment", "Recruitment process endpoints")
      .addTag("drivers", "Driver management endpoints")
      .addTag("schedule", "Driver Availability management endpoints")
      .addTag("vans", "Van management endpoints")
      .addTag("parts", "Van parts management endpoints")
      .addTag("maintenance", "Van maintenance endpoints")
      .addTag("contracts", "Contract management endpoints")
      .addTag("payments", "Payment management endpoints")
      .addTag("whatsapp", "WhatsApp messaging endpoints")
      .addTag("PDF", "PDF generation endpoints")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    // API documentation only outside production
    SwaggerModule.setup("api", app, document);
  }

  const port = process.env.PORT || 3002;
  await app.listen(port);

  console.log(`🚀 Application running on port ${port}`);
  if (!isProduction) {
    console.log(`📚 API Documentation: http://localhost:${port}/api`);
  }
  console.log(
    `🔒 CORS Origins: ${allowedOrigins.join(", ") || "None configured"}`
  );
}

bootstrap().catch((error) => {
  console.error("Error starting the application:", error);
  process.exit(1);
});
