import {
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { WhatsAppGateway } from "./whatsapp.gateway";
import {
  InboundMessage,
  MESSAGING_PROVIDER,
  MessagingProvider,
} from "../messaging/messaging.types";
import { toE164 } from "../messaging/phone.util";

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

export type MessageStatus = "sent" | "delivered" | "read" | "failed";

const NOT_CONFIGURED_MESSAGE =
  "WhatsApp messaging is not configured yet. No message was sent.";

/**
 * WhatsApp conversations (in-memory for now) on top of the provider-agnostic
 * messaging layer. The actual delivery is done by MESSAGING_PROVIDER.
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly conversations = new Map<string, WhatsAppConversation>();

  constructor(
    @Inject(MESSAGING_PROVIDER)
    private readonly messagingProvider: MessagingProvider,
    private readonly whatsAppGateway: WhatsAppGateway
  ) {
    this.logger.log(
      `WhatsApp service using messaging provider: ${this.messagingProvider.name}` +
        (this.messagingProvider.isConfigured() ? "" : " (not configured)")
    );
  }

  get providerName(): string {
    return this.messagingProvider.name;
  }

  isConfigured(): boolean {
    return this.messagingProvider.isConfigured();
  }

  /**
   * Send a free-text WhatsApp message
   * @throws ServiceUnavailableException when no provider is configured
   */
  async sendMessage(messageData: {
    to: string;
    body: string;
  }): Promise<WhatsAppMessage> {
    const to = toE164(messageData.to);

    const result = await this.messagingProvider.send({
      channel: "whatsapp",
      to,
      body: messageData.body,
    });

    if (result.status === "not_configured") {
      throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);
    }

    const message: WhatsAppMessage = {
      id: result.providerMessageId || `local_${Date.now()}`,
      from: this.providerName,
      to,
      body: messageData.body,
      timestamp: new Date(),
      direction: "outbound",
      status: result.success ? "sent" : "failed",
      type: "text",
    };

    this.recordMessage(message);

    if (!result.success) {
      this.logger.error(`Failed to send WhatsApp message: ${result.error}`);
      throw new Error(result.error || "Failed to send WhatsApp message");
    }

    return message;
  }

  /**
   * Send a pre-approved WhatsApp template
   * @returns true when the provider accepted the message
   * @throws ServiceUnavailableException when no provider is configured
   */
  async sendTemplate(
    to: string,
    templateName: string,
    variables: string[]
  ): Promise<boolean> {
    const formattedTo = toE164(to);

    const result = await this.messagingProvider.send({
      channel: "whatsapp",
      to: formattedTo,
      template: { name: templateName, variables },
    });

    if (result.status === "not_configured") {
      throw new ServiceUnavailableException(NOT_CONFIGURED_MESSAGE);
    }

    if (result.success) {
      this.recordMessage({
        id: result.providerMessageId || `local_${Date.now()}`,
        from: this.providerName,
        to: formattedTo,
        body: `Template "${templateName}": ${variables.join(", ")}`,
        timestamp: new Date(),
        direction: "outbound",
        status: "sent",
        type: "template",
        templateId: templateName,
      });
    } else {
      this.logger.error(`Failed to send WhatsApp template: ${result.error}`);
    }

    return result.success;
  }

  /**
   * Entry point for inbound messages. A provider webhook controller should map
   * its payload to InboundMessage and call this method.
   */
  handleIncomingMessage(inbound: InboundMessage): void {
    this.recordMessage({
      id: inbound.providerMessageId || `incoming_${Date.now()}`,
      from: inbound.from,
      to: inbound.to,
      body: inbound.body,
      timestamp: inbound.receivedAt,
      direction: "inbound",
      status: "delivered",
      type: "text",
    });
  }

  getConversations(): WhatsAppConversation[] {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );
  }

  getConversation(phoneNumber: string): WhatsAppConversation | undefined {
    return this.conversations.get(this.normalizePhoneNumber(phoneNumber));
  }

  private recordMessage(message: WhatsAppMessage): void {
    const counterpart =
      message.direction === "inbound" ? message.from : message.to;
    const key = this.normalizePhoneNumber(counterpart);

    let conversation = this.conversations.get(key);
    if (!conversation) {
      conversation = {
        phoneNumber: key,
        messages: [],
        lastMessageAt: message.timestamp,
        unreadCount: 0,
      };
      this.conversations.set(key, conversation);
    }

    conversation.messages.push(message);
    conversation.lastMessageAt = message.timestamp;
    if (message.direction === "inbound") {
      conversation.unreadCount++;
    }

    this.whatsAppGateway.emitNewMessage(key, message);
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    return phoneNumber.replace(/\D/g, "");
  }
}
