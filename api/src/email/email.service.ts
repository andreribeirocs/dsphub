import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type {
  SendEmailDto,
  BulkEmailDto,
  SendEmailResult,
  BulkEmailResult,
  EmailAttachment,
} from "./dto/send-email.dto";
import {
  generateInvoiceEmail,
  generateInvoiceEmailSubject,
} from "./email.templates";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private readonly isConfigured: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isConfigured = this.initializeTransporter();
  }

  private initializeTransporter(): boolean {
    try {
      const smtpHost = this.configService.get<string>("SMTP_HOST");
      const smtpPort = this.configService.get<number>("SMTP_PORT");
      const smtpUser = this.configService.get<string>("SMTP_USER");
      const smtpPassword = this.configService.get<string>("SMTP_PASSWORD");

      if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
        this.logger.warn(
          "SMTP configuration incomplete. Email sending will be disabled."
        );
        return false;
      }

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: this.configService.get<boolean>("SMTP_SECURE") || false,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

      this.logger.log(
        `Email service initialized with SMTP host: ${smtpHost}:${smtpPort}`
      );
      return true;
    } catch (error) {
      this.logger.error("Failed to initialize email transporter:", error);
      return false;
    }
  }

  async sendEmail(emailData: SendEmailDto): Promise<SendEmailResult> {
    if (!this.isConfigured || !this.transporter) {
      this.logger.error("Email service is not configured");
      return {
        success: false,
        error: "Email service is not configured",
      };
    }

    try {
      const fromName =
        this.configService.get<string>("SMTP_FROM_NAME") || "Driver Hub";
      const fromEmail =
        this.configService.get<string>("SMTP_FROM_EMAIL") ||
        this.configService.get<string>("SMTP_USER");

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        attachments: emailData.attachments?.map((att) => ({
          filename: att.filename,
          content: att.content,
          contentType: att.contentType,
        })),
      };

      const info = await this.transporter.sendMail(mailOptions);

      this.logger.log(
        `Email sent successfully to ${emailData.to}: ${info.messageId}`
      );

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send email to ${emailData.to}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async sendBulkEmails(bulkData: BulkEmailDto): Promise<BulkEmailResult> {
    const results = await Promise.all(
      bulkData.recipients.map(async (recipient) => {
        const result = await this.sendEmail({
          to: recipient,
          subject: bulkData.subject,
          html: bulkData.html,
          text: bulkData.text,
          attachments: bulkData.attachments,
        });

        return {
          email: recipient,
          success: result.success,
          error: result.error,
        };
      })
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    this.logger.log(
      `Bulk email completed: ${successful} successful, ${failed} failed out of ${results.length} total`
    );

    return {
      total: results.length,
      successful,
      failed,
      results,
    };
  }

  async sendInvoiceEmail(
    driverEmail: string,
    driverName: string,
    invoiceNumber: string,
    weekStart: string,
    weekEnd: string,
    totalAmount: string,
    currency: string,
    pdfBuffer: Buffer
  ): Promise<SendEmailResult> {
    const subject = generateInvoiceEmailSubject(
      invoiceNumber,
      weekStart,
      weekEnd
    );

    const html = generateInvoiceEmail({
      driverName,
      invoiceNumber,
      weekStart,
      weekEnd,
      totalAmount,
      currency,
    });

    const attachments: EmailAttachment[] = [
      {
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];

    return this.sendEmail({
      to: driverEmail,
      subject,
      html,
      text: `Please find attached your weekly invoice ${invoiceNumber} for the period ${weekStart} to ${weekEnd}. Total amount: ${currency}${totalAmount}`,
      attachments,
    });
  }

  isEmailServiceConfigured(): boolean {
    return this.isConfigured;
  }
}
