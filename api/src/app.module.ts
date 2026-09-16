import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD, APP_FILTER } from "@nestjs/core";
import { EnvValidationService } from "./config/env-validation.service";
import { GlobalExceptionFilter } from "./shared/filters/global-exception.filter";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { BetterAuthModule } from "./auth/better-auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { OrganizationMiddleware } from "./common/middleware/organization.middleware";
import { UsersModule } from "./users/users.module";
import { RecruitmentModule } from "./recruitment/recruitment.module";
import { DriversModule } from "./drivers/drivers.module";
import { MessagingModule } from "./messaging/messaging.module";
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { PdfModule } from "./pdf/pdf.module";
import { PaymentsModule } from "./payments/payments.module";
import { VansModule } from "./vans/vans.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { EmailModule } from "./email/email.module";
import { InvoicesModule } from "./invoices/invoices.module";
import { SchedulerModule } from "./scheduler/scheduler.module";

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
    BetterAuthModule, // New Better Auth module
    OrganizationsModule, // New Organizations module
    UsersModule,
    RecruitmentModule,
    DriversModule,
    MessagingModule, // WhatsApp/SMS provider (none configured yet)
    WhatsAppModule,
    PdfModule,
    PaymentsModule,
    VansModule,
    DashboardModule,
    EmailModule,
    InvoicesModule,
    SchedulerModule,
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
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply organization middleware to all routes
    // NestJS 11: named wildcard; "{*splat}" also matches the root path
    consumer.apply(OrganizationMiddleware).forRoutes("{*splat}");
  }
}
