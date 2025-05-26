import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Set global prefix for all routes
  app.setGlobalPrefix("api");

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle("TRIUN Logistics API")
    .setDescription("The TRIUN Logistics Management System API")
    .setVersion("1.0")
    .addTag("auth", "Authentication endpoints")
    .addTag("recruitment", "Recruitment process endpoints")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  await app.listen(3002);
}
bootstrap();
