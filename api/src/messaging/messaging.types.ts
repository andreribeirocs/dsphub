/**
 * Provider-agnostic messaging contract (WhatsApp / SMS).
 *
 * To plug in a real provider (e.g. Meta WhatsApp Cloud API, 360dialog, Vonage):
 *  1. Create a class in ./providers implementing MessagingProvider.
 *  2. Bind it to MESSAGING_PROVIDER in messaging.module.ts.
 *  3. If the provider sends webhooks, add a controller that verifies the
 *     provider's signature, maps the payload to InboundMessage and calls
 *     WhatsAppService.handleIncomingMessage().
 * No other module should import a provider SDK directly.
 */

export const MESSAGING_PROVIDER = Symbol("MESSAGING_PROVIDER");

export type MessageChannel = "whatsapp" | "sms";

export interface OutboundMessage {
  channel: MessageChannel;
  /** E.164 phone number, e.g. +447700900123 (see toE164 in phone.util.ts) */
  to: string;
  /** Free-text body (WhatsApp only allows this inside the 24h customer window) */
  body?: string;
  /** Pre-approved template (required by WhatsApp to start a conversation) */
  template?: {
    name: string;
    language?: string;
    variables: string[];
  };
}

export type SendStatus = "sent" | "queued" | "failed" | "not_configured";

export interface SendResult {
  success: boolean;
  status: SendStatus;
  providerMessageId?: string;
  error?: string;
}

export interface InboundMessage {
  channel: MessageChannel;
  /** E.164 phone number */
  from: string;
  to: string;
  body: string;
  providerMessageId?: string;
  receivedAt: Date;
}

export interface MessagingProvider {
  /** Short identifier shown in health checks and logs */
  readonly name: string;
  isConfigured(): boolean;
  send(message: OutboundMessage): Promise<SendResult>;
}
