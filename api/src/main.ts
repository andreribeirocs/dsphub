import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import {
  EnhancedValidationPipe,
  InputLengthValidationPipe,
} from "./shared/pipes/validation.pipe";
import * as express from "express";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
  });

  // Configure body parser for larger payloads (50MB limit for file uploads)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

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
      : ["http://localhost:4200", "http://localhost:3000"]; // Development defaults

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["X-Total-Count"],
    maxAge: 86400, // 24 hours
  });

  const config = new DocumentBuilder()
    .setTitle("DSPHub API")
    .setDescription("The DSPHub Management System API")
    .setVersion("1.0")
    .addTag("auth", "Authentication endpoints")
    .addTag("recruitment", "Recruitment process endpoints")
    .addTag("drivers", "Driver management endpoints")
    .addTag("schedule", "Driver Availability management endpoints")
    .addTag("payments", "Payment management endpoints")
    .addTag("whatsapp", "WhatsApp messaging endpoints")
    .addTag("pdf", "PDF generation endpoints")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  const port = process.env.PORT || 3002;
  await app.listen(port);

  console.log(`🚀 Application running on port ${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api`);
  console.log(
    `🔒 CORS Origins: ${allowedOrigins.join(", ") || "None configured"}`
  );
}

bootstrap().catch((error) => {
  console.error("Error starting the application:", error);
  process.exit(1);
});
