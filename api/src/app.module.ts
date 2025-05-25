import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecruitmentModule } from './recruitment/recruitment.module';
import { DriversModule } from './drivers/drivers.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { PdfModule } from './pdf/pdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RecruitmentModule,
    DriversModule,
    WhatsAppModule,
    PdfModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
