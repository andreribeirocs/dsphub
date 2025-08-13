import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as twilio from "twilio";
import { WhatsAppGateway } from "./whatsapp.gateway";

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  direction: "inbound" | "outbound";
  status: "sent" | "delivered" | "read" | "failed";
  type?: "text" | "media" | "template";
  mediaUrl?: string;
  templateId?: string;
}

export interface WhatsAppConversation {
  phoneNumber: string;
  name?: string;
  messages: WhatsAppMessage[];
  lastMessageAt: Date;
  unreadCount: number;
}

export interface TwilioWebhookPayload {
  AccountSid: string;
  From: string;
  To: string;
  Body?: string;
  MessageSid?: string;
  MessageStatus?: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
}

export type MessageStatus = "sent" | "delivered" | "read" | "failed";

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private twilioClient: twilio.Twilio;
  private readonly conversations = new Map<string, WhatsAppConversation>();

  constructor(
    private configService: ConfigService,
    private whatsAppGateway: WhatsAppGateway
  ) {
    const accountSid = this.configService.get<string>("TWILIO_ACCOUNT_SID");
    const authToken = this.configService.get<string>("TWILIO_AUTH_TOKEN");

    if (!accountSid || !authToken) {
      this.logger.warn(
        "Twilio credentials not configured. WhatsApp service will use mock mode."
      );
      return;
    }

    this.twilioClient = twilio(accountSid, authToken);
    this.logger.log("WhatsApp service initialized with Twilio");

    // Initialize mock conversations for development
    this.initializeMockConversations();
  }

  /**
   * Send a WhatsApp message
   * @param messageData - Message data
   * @returns Promise<WhatsAppMessage>
   */
  async sendMessage(messageData: {
    to: string;
    body: string;
  }): Promise<WhatsAppMessage> {
    const { to, body } = messageData;
    const formattedTo = this.formatPhoneNumber(to);

    if (!this.twilioClient) {
      // Mock mode for development
      const mockMessage: WhatsAppMessage = {
        id: `mock_${Date.now()}`,
        from:
          this.configService.get<string>("TWILIO_WHATSAPP_NUMBER") ||
          "whatsapp:+14155238886",
        to: formattedTo,
        body,
        timestamp: new Date(),
        direction: "outbound",
        status: "sent",
      };

      this.logger.log(`Mock message sent to ${formattedTo}: ${body}`);
      this.addMessageToConversation(mockMessage);

      // Extract phone number for the room
      const phoneNumber = this.normalizePhoneNumber(formattedTo);
      this.whatsAppGateway.emitNewMessage(phoneNumber, mockMessage);

      return mockMessage;
    }

    // Check if conversation exists for this phone number
    const normalizedPhone = this.normalizePhoneNumber(formattedTo);
    const existingConversation = this.conversations.get(normalizedPhone);

    try {
      const whatsAppNumber = this.configService.get<string>(
        "TWILIO_WHATSAPP_NUMBER"
      );

      if (!whatsAppNumber) {
        throw new Error("TWILIO_WHATSAPP_NUMBER is not configured");
      }

      this.logger.debug(
        `Sending message from ${whatsAppNumber} to ${formattedTo}: ${body}`
      );

      const message = await this.twilioClient.messages.create({
        body,
        from: whatsAppNumber,
        to: formattedTo,
      });

      const whatsAppMessage: WhatsAppMessage = {
        id: message.sid,
        from: whatsAppNumber,
        to: formattedTo,
        body,
        timestamp: new Date(),
        direction: "outbound",
        status: "sent",
      };

      this.addMessageToConversation(whatsAppMessage);
      this.whatsAppGateway.emitNewMessage(normalizedPhone, whatsAppMessage);

      this.logger.log(`Message sent successfully: ${message.sid}`);
      return whatsAppMessage;
    } catch (error) {
      this.logger.error("Failed to send WhatsApp message:", error);

      // Create error message for consistency
      const errorMessage: WhatsAppMessage = {
        id: `error_${Date.now()}`,
        from:
          this.configService.get<string>("TWILIO_WHATSAPP_NUMBER") ||
          "whatsapp:+14155238886",
        to: formattedTo,
        body,
        timestamp: new Date(),
        direction: "outbound",
        status: "failed",
      };

      this.addMessageToConversation(errorMessage);
      this.whatsAppGateway.emitNewMessage(normalizedPhone, errorMessage);

      throw error;
    }
  }

  /**
   * Send a WhatsApp template message
   * @param to - Recipient phone number
   * @param templateSid - Template SID
   * @param variables - Template variables
   * @returns Promise<boolean>
   */
  async sendWhatsAppTemplate(
    to: string,
    templateSid: string,
    variables: string[]
  ): Promise<boolean> {
    const formattedTo = this.formatPhoneNumber(to);

    if (!this.twilioClient) {
      this.logger.log(
        `Mock template message sent to ${formattedTo} using template ${templateSid}`
      );
      return true;
    }

    try {
      const whatsAppNumber = this.configService.get<string>(
        "TWILIO_WHATSAPP_NUMBER"
      );

      if (!whatsAppNumber) {
        throw new Error("TWILIO_WHATSAPP_NUMBER is not configured");
      }

      const message = await this.twilioClient.messages.create({
        contentSid: templateSid,
        contentVariables: JSON.stringify(variables),
        from: whatsAppNumber,
        to: formattedTo,
      });

      const templateMessage: WhatsAppMessage = {
        id: message.sid,
        from: whatsAppNumber,
        to: formattedTo,
        body: `Template message with variables: ${variables.join(", ")}`,
        timestamp: new Date(),
        direction: "outbound",
        status: "sent",
        type: "template",
        templateId: templateSid,
      };

      this.addMessageToConversation(templateMessage);

      const normalizedPhone = this.normalizePhoneNumber(formattedTo);
      this.whatsAppGateway.emitNewMessage(normalizedPhone, templateMessage);

      this.logger.log(`Template message sent successfully: ${message.sid}`);
      return true;
    } catch (error) {
      this.logger.error("Failed to send WhatsApp template message:", error);
      return false;
    }
  }

  /**
   * Handle incoming message from Twilio webhook
   * @param payload - Twilio webhook payload
   */
  handleIncomingMessage(payload: TwilioWebhookPayload): void {
    try {
      if (!payload.Body || !payload.From) {
        this.logger.warn("Invalid webhook payload - missing required fields");
        return;
      }

      const incomingMessage: WhatsAppMessage = {
        id: payload.MessageSid || `incoming_${Date.now()}`,
        from: payload.From,
        to: payload.To,
        body: payload.Body,
        timestamp: new Date(),
        direction: "inbound",
        status: "delivered",
      };

      this.addMessageToConversation(incomingMessage);

      // Mock reply for development
      if (!this.twilioClient) {
        const mockMessage: WhatsAppMessage = {
          id: `mock_reply_${Date.now()}`,
          from: payload.To,
          to: payload.From,
          body: `Thank you for your message: "${payload.Body}". We will get back to you soon.`,
          timestamp: new Date(),
          direction: "outbound",
          status: "sent",
        };

        this.addMessageToConversation(mockMessage);

        const normalizedPhone = this.normalizePhoneNumber(payload.From);
        this.whatsAppGateway.emitNewMessage(normalizedPhone, mockMessage);
      }

      const normalizedPhone = this.normalizePhoneNumber(payload.From);
      this.whatsAppGateway.emitNewMessage(normalizedPhone, incomingMessage);

      this.logger.log(`Processed incoming message from ${payload.From}`);
    } catch (error) {
      this.logger.error("Error processing incoming message:", error);
    }
  }

  /**
   * Handle message status update from Twilio webhook
   * @param payload - Twilio webhook payload
   */
  handleStatusUpdate(payload: TwilioWebhookPayload): void {
    try {
      if (!payload.MessageSid || !payload.MessageStatus) {
        this.logger.warn("Invalid status update payload");
        return;
      }

      const normalizedPhone = this.normalizePhoneNumber(payload.To);
      this.whatsAppGateway.emitMessageStatusUpdate(
        normalizedPhone,
        payload.MessageSid,
        payload.MessageStatus
      );

      this.logger.debug(
        `Status update: ${payload.MessageSid} -> ${payload.MessageStatus}`
      );
    } catch (error) {
      this.logger.error("Error processing status update:", error);
    }
  }

  /**
   * Get all conversations
   * @returns Array of conversations
   */
  getConversations(): WhatsAppConversation[] {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );
  }

  /**
   * Get conversation by phone number
   * @param phoneNumber - Phone number
   * @returns Conversation or undefined
   */
  getConversation(phoneNumber: string): WhatsAppConversation | undefined {
    const normalized = this.normalizePhoneNumber(phoneNumber);
    return this.conversations.get(normalized);
  }

  /**
   * Add message to conversation
   * @private
   */
  private addMessageToConversation(message: WhatsAppMessage): void {
    const phoneNumber =
      message.direction === "inbound" ? message.from : message.to;
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    let conversation = this.conversations.get(normalizedPhone);

    if (!conversation) {
      conversation = {
        phoneNumber: normalizedPhone,
        messages: [],
        lastMessageAt: message.timestamp,
        unreadCount: 0,
      };
      this.conversations.set(normalizedPhone, conversation);
    }

    conversation.messages.push(message);
    conversation.lastMessageAt = message.timestamp;

    if (message.direction === "inbound") {
      conversation.unreadCount++;
    }
  }

  /**
   * Format phone number for WhatsApp
   * @private
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any existing whatsapp: prefix
    let cleaned = phoneNumber.replace(/^whatsapp:/, "");

    // Remove any non-digit characters
    cleaned = cleaned.replace(/\D/g, "");

    // Add country code if not present (assuming UK +44 for this project)
    if (!cleaned.startsWith("44") && cleaned.length === 10) {
      cleaned = "44" + cleaned.substring(1);
    }

    return `whatsapp:+${cleaned}`;
  }

  /**
   * Normalize phone number for storage
   * @private
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/^whatsapp:\+?/, "").replace(/\D/g, "");
  }

  /**
   * Initialize mock conversations for development
   * @private
   */
  private initializeMockConversations(): void {
    if (process.env.NODE_ENV === "development") {
      const mockConversations = [
        {
          phoneNumber: "447123456789",
          name: "John Doe",
          messages: [
            {
              id: "mock_1",
              from: "whatsapp:+447123456789",
              to: "whatsapp:+14155238886",
              body: "Hello, I'm interested in the driver position",
              timestamp: new Date(Date.now() - 3600000),
              direction: "inbound" as const,
              status: "delivered" as const,
            },
            {
              id: "mock_2",
              from: "whatsapp:+14155238886",
              to: "whatsapp:+447123456789",
              body: "Thank you for your interest! Please complete the registration at this link: https://example.com/register",
              timestamp: new Date(Date.now() - 3000000),
              direction: "outbound" as const,
              status: "delivered" as const,
            },
          ],
          lastMessageAt: new Date(Date.now() - 3000000),
          unreadCount: 0,
        },
      ];

      mockConversations.forEach((conv) => {
        this.conversations.set(conv.phoneNumber, conv);
      });

      this.logger.log("Mock conversations initialized for development");
    }
  }
}
