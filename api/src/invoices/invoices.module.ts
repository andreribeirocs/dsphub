import { Module, forwardRef } from "@nestjs/common";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";
import { PrismaModule } from "../prisma/prisma.module";
import { PdfModule } from "../pdf/pdf.module";
import { EmailModule } from "../email/email.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [
    PrismaModule,
    PdfModule,
    EmailModule,
    forwardRef(() => PaymentsModule),
  ],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
