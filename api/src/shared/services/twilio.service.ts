import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as twilio from "twilio";

interface TwilioError {
  message?: string;
  code?: string | number;
  moreInfo?: string;
  status?: number;
}

@Injectable()
export class WhatsAppService {
  private client: twilio.Twilio;
  private readonly logger = new Logger(WhatsAppService.name);
  private isDev: boolean;

  constructor(private configService: ConfigService) {
    this.isDev = this.configService.get<string>("NODE_ENV") !== "production";

    const accountSid = this.configService.get<string>("TWILIO_ACCOUNT_SID");
    const authToken = this.configService.get<string>("TWILIO_AUTH_TOKEN");

    if (!accountSid || !authToken) {
      this.logger.error(
        "Twilio credentials are missing. Check your environment variables."
      );
      return;
    }

    this.logger.debug(
      `Initializing Twilio WhatsApp with SID: ${accountSid.substring(0, 5)}...`
    );

    try {
      this.client = twilio(accountSid, authToken);

      if (this.isDev) {
        this.client.api
          .accounts(accountSid)
          .fetch()
          .then((account) =>
            this.logger.log(
              `Twilio WhatsApp account authenticated: ${account.friendlyName}`
            )
          )
          .catch((err: unknown) => {
            const errorMessage =
              err instanceof Error ? err.message : "Unknown error";
            this.logger.error(
              `Twilio WhatsApp authentication test failed: ${errorMessage}`
            );
          });
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Failed to initialize Twilio WhatsApp client: ${errorMessage}`
      );
    }
  }

  async sendWhatsAppMessage(to: string, body: string): Promise<boolean> {
    if (
      this.isDev &&
      this.configService.get<string>("TWILIO_MOCK") === "true"
    ) {
      this.logger.log(`[MOCK WHATSAPP] To: ${to}, Message: ${body}`);
      return true;
    }

    if (!this.client) {
      this.logger.error(
        "Twilio WhatsApp client not initialized. Cannot send WhatsApp message."
      );
      return false;
    }

    try {
      const fromNumber = this.configService.get<string>(
        "TWILIO_WHATSAPP_NUMBER"
      );

      if (!fromNumber) {
        this.logger.error(
          "TWILIO_WHATSAPP_NUMBER is not defined in environment variables"
        );
        return false;
      }

      // Format phone numbers for WhatsApp (must include whatsapp: prefix)
      const whatsappTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
      const whatsappFrom = fromNumber.startsWith("whatsapp:")
        ? fromNumber
        : `whatsapp:${fromNumber}`;

      this.logger.log(
        `Sending WhatsApp message to ${whatsappTo} from ${whatsappFrom}`
      );

      const message = await this.client.messages.create({
        body,
        to: whatsappTo,
        from: whatsappFrom,
      });

      this.logger.log(`WhatsApp message sent successfully: ${message.sid}`);
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to send WhatsApp message: ${errorMessage}`);

      // Handle Twilio-specific error properties with type safety
      if (error && typeof error === "object") {
        const twilioError = error as TwilioError;

        if (twilioError.code) {
          this.logger.error(`Twilio Error Code: ${twilioError.code}`);
        }

        if (twilioError.moreInfo) {
          this.logger.error(`More Info: ${twilioError.moreInfo}`);
        }

        if (twilioError.status) {
          this.logger.error(`HTTP Status: ${twilioError.status}`);
        }
      }

      if (this.isDev) {
        this.logger.error(
          "Full error details:",
          JSON.stringify(error, null, 2)
        );
      }

      return false;
    }
  }

  async sendWhatsAppTemplate(
    to: string,
    templateSid: string,
    contentVariables: string[]
  ): Promise<boolean> {
    if (
      this.isDev &&
      this.configService.get<string>("TWILIO_MOCK") === "true"
    ) {
      this.logger.log(
        `[MOCK WHATSAPP TEMPLATE] To: ${to}, Template: ${templateSid}, Variables: ${JSON.stringify(contentVariables)}`
      );
      return true;
    }

    if (!this.client) {
      this.logger.error(
        "Twilio WhatsApp client not initialized. Cannot send WhatsApp template."
      );
      return false;
    }

    try {
      const fromNumber = this.configService.get<string>(
        "TWILIO_WHATSAPP_NUMBER"
      );

      if (!fromNumber) {
        this.logger.error(
          "TWILIO_WHATSAPP_NUMBER is not defined in environment variables"
        );
        return false;
      }

      // Format phone numbers for WhatsApp (must include whatsapp: prefix)
      const whatsappTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
      const whatsappFrom = fromNumber.startsWith("whatsapp:")
        ? fromNumber
        : `whatsapp:${fromNumber}`;

      this.logger.log(
        `Sending WhatsApp template to ${whatsappTo} from ${whatsappFrom}, Template: ${templateSid}`
      );

      // Format contentVariables as an object with numbered keys (required format for Twilio)
      const formattedVariables: Record<string, string> = {};
      contentVariables.forEach((variable, index) => {
        formattedVariables[`${index + 1}`] = variable;
      });

      // Log the complete request payload
      this.logger.debug("WhatsApp template request payload:", {
        from: whatsappFrom,
        to: whatsappTo,
        contentSid: templateSid,
        contentVariables: formattedVariables,
      });

      const message = await this.client.messages.create({
        from: whatsappFrom,
        to: whatsappTo,
        contentSid: templateSid,
        contentVariables: JSON.stringify(formattedVariables),
      });

      // Log the successful response
      this.logger.log(`WhatsApp template sent successfully: ${message.sid}`);
      this.logger.debug("WhatsApp template response:", {
        sid: message.sid,
        status: message.status,
        direction: message.direction,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      });
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to send WhatsApp template: ${errorMessage}`);

      // Handle Twilio-specific error properties with type safety
      if (error && typeof error === "object") {
        const twilioError = error as TwilioError;

        if (twilioError.code) {
          this.logger.error(`Twilio Error Code: ${twilioError.code}`);
        }

        if (twilioError.moreInfo) {
          this.logger.error(`More Info: ${twilioError.moreInfo}`);
        }

        if (twilioError.status) {
          this.logger.error(`HTTP Status: ${twilioError.status}`);
        }
      }

      if (this.isDev) {
        this.logger.error(
          "Full error details:",
          JSON.stringify(error, null, 2)
        );
      }

      return false;
    }
  }

  async verifyCredentials(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const accountSid = this.configService.get<string>("TWILIO_ACCOUNT_SID");
      if (!accountSid) {
        throw new Error(
          "TWILIO_ACCOUNT_SID is not defined in environment variables"
        );
      }
      const account = await this.client.api.accounts(accountSid).fetch();

      this.logger.log(
        `Verified Twilio WhatsApp account: ${account.friendlyName}`
      );
      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `WhatsApp credential verification failed: ${errorMessage}`
      );
      return false;
    }
  }
}
