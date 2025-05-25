import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';
import { WhatsAppGateway } from './whatsapp.gateway';
import { SendMessageDto } from './dto/send-message.dto';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  direction: 'inbound' | 'outbound';
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
}

export interface WhatsAppConversation {
  id: string;
  driverPhone: string;
  driverName: string;
  driverAvatar?: string;
  messages: WhatsAppMessage[];
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
}

export interface TwilioWebhookPayload {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  MessageStatus: string;
  Timestamp?: string;
  AccountSid: string;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private twilioClient: twilio.Twilio;
  private readonly conversations = new Map<string, WhatsAppConversation>();

  constructor(
    private configService: ConfigService,
    private whatsAppGateway: WhatsAppGateway,
  ) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (!accountSid || !authToken) {
      this.logger.warn(
        'Twilio credentials not configured. WhatsApp service will use mock mode.',
      );
      return;
    }

    this.twilioClient = twilio(accountSid, authToken);
    this.logger.log('WhatsApp service initialized with Twilio');
  }

  async sendMessage(sendMessageDto: SendMessageDto): Promise<WhatsAppMessage> {
    const { to, body } = sendMessageDto;

    // Ensure phone number is in proper E.164 format
    const formattedTo = this.formatPhoneNumber(to);

    const twilioFrom =
      this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') ||
      'whatsapp:+14155238886';

    // Log the numbers being used for debugging
    this.logger.debug(
      `Sending WhatsApp message from ${twilioFrom} to ${formattedTo}`,
    );

    try {
      if (!this.twilioClient) {
        // Mock mode for development
        const mockMessage: WhatsAppMessage = {
          id: `mock_${Date.now()}`,
          from: twilioFrom,
          to: formattedTo,
          body,
          timestamp: new Date(),
          direction: 'outbound',
          status: 'sent',
        };

        this.logger.log(`Mock message sent to ${formattedTo}: ${body}`);
        this.addMessageToConversation(mockMessage);
        this.whatsAppGateway.emitMessage(mockMessage);

        return mockMessage;
      }

      // Check if conversation exists for this phone number
      const normalizedPhone = this.normalizePhoneNumber(formattedTo);
      const existingConversation = this.conversations.get(normalizedPhone);

      // If no conversation exists, we need to send template message first
      if (!existingConversation || existingConversation.messages.length === 0) {
        this.logger.log(
          `No existing conversation found for ${formattedTo}. Sending template message first.`,
        );

        // Send template message first
        await this.sendTemplateMessage(formattedTo, twilioFrom);

        // Wait a moment to ensure template is processed
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Now send the actual message
      const message = await this.twilioClient.messages.create({
        from: twilioFrom,
        to: formattedTo,
        body,
      });

      const whatsAppMessage: WhatsAppMessage = {
        id: message.sid,
        from: twilioFrom,
        to: formattedTo,
        body,
        timestamp: new Date(),
        direction: 'outbound',
        status: 'sent',
      };

      this.addMessageToConversation(whatsAppMessage);
      this.whatsAppGateway.emitMessage(whatsAppMessage);

      this.logger.log(
        `Message sent to ${formattedTo} with SID: ${message.sid}`,
      );
      return whatsAppMessage;
    } catch (error) {
      this.logger.error(`Failed to send message to ${formattedTo}:`, error);

      // Handle specific Twilio errors
      if (
        error instanceof Error &&
        error.message.includes('Invalid From and To pair')
      ) {
        const errorMsg =
          'Invalid From and To pair. This usually means:\n' +
          '1. You are using Twilio sandbox number but the recipient has not joined the sandbox\n' +
          '2. Both numbers must be WhatsApp-enabled\n' +
          '3. For sandbox: recipient must first send "join <sandbox-word>" to your sandbox number\n' +
          `Current from: ${twilioFrom}, to: ${formattedTo}`;
        throw new Error(errorMsg);
      }

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to send WhatsApp message: ${errorMessage}`);
    }
  }

  private async sendTemplateMessage(
    to: string,
    from: string,
  ): Promise<WhatsAppMessage> {
    const templateSid = this.configService.get<string>(
      'TWILIO_WHATSAPP_TEMPLATE_HELLO_THERE',
    );

    if (!templateSid) {
      throw new Error(
        'TWILIO_WHATSAPP_TEMPLATE_HELLO_THERE is not configured in environment variables',
      );
    }

    try {
      this.logger.log(
        `Sending template message to ${to} using template: ${templateSid}`,
      );

      const message = await this.twilioClient.messages.create({
        from: from,
        to: to,
        contentSid: templateSid,
      });

      const templateMessage: WhatsAppMessage = {
        id: message.sid,
        from: from,
        to: to,
        body: 'Hello there!', // Template message content
        timestamp: new Date(),
        direction: 'outbound',
        status: 'sent',
      };

      this.addMessageToConversation(templateMessage);
      this.whatsAppGateway.emitMessage(templateMessage);

      this.logger.log(
        `Template message sent to ${to} with SID: ${message.sid}`,
      );
      return templateMessage;
    } catch (error) {
      this.logger.error(`Failed to send template message to ${to}:`, error);
      throw new Error(
        `Failed to send template message: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendTemplateMessageManually(to: string): Promise<WhatsAppMessage> {
    const formattedTo = this.formatPhoneNumber(to);
    const twilioFrom =
      this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') ||
      'whatsapp:+14155238886';

    if (!this.twilioClient) {
      // Mock mode for development
      const mockMessage: WhatsAppMessage = {
        id: `mock_template_${Date.now()}`,
        from: twilioFrom,
        to: formattedTo,
        body: 'Hello there!',
        timestamp: new Date(),
        direction: 'outbound',
        status: 'sent',
      };

      this.logger.log(`Mock template message sent to ${formattedTo}`);
      this.addMessageToConversation(mockMessage);
      this.whatsAppGateway.emitMessage(mockMessage);

      return mockMessage;
    }

    return this.sendTemplateMessage(formattedTo, twilioFrom);
  }

  handleIncomingMessage(payload: TwilioWebhookPayload): WhatsAppMessage {
    const incomingMessage: WhatsAppMessage = {
      id: payload.MessageSid,
      from: payload.From,
      to: payload.To,
      body: payload.Body,
      timestamp: payload.Timestamp ? new Date(payload.Timestamp) : new Date(),
      direction: 'inbound',
      status: 'delivered',
    };

    this.addMessageToConversation(incomingMessage);
    this.whatsAppGateway.emitMessage(incomingMessage);

    this.logger.log(`Received message from ${payload.From}: ${payload.Body}`);
    return incomingMessage;
  }

  handleStatusUpdate(payload: TwilioWebhookPayload): void {
    const { MessageSid, MessageStatus } = payload;

    // Update message status in conversation
    for (const conversation of this.conversations.values()) {
      const message = conversation.messages.find(
        (msg) => msg.id === MessageSid,
      );
      if (message) {
        message.status = MessageStatus as
          | 'sent'
          | 'delivered'
          | 'read'
          | 'failed'
          | 'pending';
        this.whatsAppGateway.emitStatusUpdate({
          messageId: MessageSid,
          status: MessageStatus,
        });
        break;
      }
    }

    this.logger.log(
      `Message ${MessageSid} status updated to: ${MessageStatus}`,
    );
  }

  getConversations(): WhatsAppConversation[] {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime(),
    );
  }

  getConversation(phoneNumber: string): WhatsAppConversation | undefined {
    return this.conversations.get(this.normalizePhoneNumber(phoneNumber));
  }

  private addMessageToConversation(message: WhatsAppMessage): void {
    const phoneNumber =
      message.direction === 'inbound'
        ? this.normalizePhoneNumber(message.from)
        : this.normalizePhoneNumber(message.to);

    let conversation = this.conversations.get(phoneNumber);

    if (!conversation) {
      conversation = {
        id: phoneNumber,
        driverPhone: phoneNumber,
        driverName: this.getDriverNameByPhone(phoneNumber),
        messages: [],
        lastMessage: '',
        lastMessageTime: new Date(),
        unreadCount: 0,
      };
      this.conversations.set(phoneNumber, conversation);
    }

    conversation.messages.push(message);
    conversation.lastMessage = message.body;
    conversation.lastMessageTime = message.timestamp;

    if (message.direction === 'inbound') {
      conversation.unreadCount++;
    }
  }

  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any existing whatsapp: prefix
    let formatted = phoneNumber.replace('whatsapp:', '');

    // Ensure it starts with + for E.164 format
    if (!formatted.startsWith('+')) {
      formatted = '+' + formatted;
    }

    // Add whatsapp: prefix for Twilio
    return `whatsapp:${formatted}`;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove 'whatsapp:' prefix if present and ensure E.164 format
    let normalized = phoneNumber.replace('whatsapp:', '');
    if (!normalized.startsWith('+')) {
      normalized = '+' + normalized;
    }
    return normalized;
  }

  private getDriverNameByPhone(phoneNumber: string): string {
    // In a real implementation, you would fetch this from the database
    // For now, return a placeholder
    return `Driver ${phoneNumber.slice(-4)}`;
  }

  markConversationAsRead(phoneNumber: string): void {
    const conversation = this.conversations.get(
      this.normalizePhoneNumber(phoneNumber),
    );
    if (conversation) {
      conversation.unreadCount = 0;
    }
  }

  deleteConversation(phoneNumber: string): boolean {
    return this.conversations.delete(this.normalizePhoneNumber(phoneNumber));
  }
}
