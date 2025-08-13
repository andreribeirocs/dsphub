import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { EnvValidationService } from "./config/env-validation.service";
import { GlobalExceptionFilter } from "./shared/filters/global-exception.filter";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { RecruitmentModule } from "./recruitment/recruitment.module";
import { DriversModule } from "./drivers/drivers.module";
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { PdfModule } from "./pdf/pdf.module";
import { PaymentsModule } from "./payments/payments.module";
import { VansModule } from "./vans/vans.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const envValidation = new EnvValidationService();
        return envValidation.validateEnvironment(config);
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"), // 1 minute
        limit: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "60"), // 60 requests per minute default
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    RecruitmentModule,
    DriversModule,
    WhatsAppModule,
    PdfModule,
    PaymentsModule,
    VansModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
