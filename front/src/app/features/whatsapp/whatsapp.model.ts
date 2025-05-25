export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus =
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed';

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  timestamp: Date;
  direction: MessageDirection;
  status: MessageStatus;
  messageType?: 'text' | 'image' | 'document' | 'audio';
  mediaUrl?: string;
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
  MessageStatus?: MessageStatus;
  Timestamp?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  category: 'greeting' | 'reminder' | 'confirmation' | 'emergency';
}
