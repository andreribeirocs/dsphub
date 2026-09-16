import { Injectable, Logger } from "@nestjs/common";
import {
  MessagingProvider,
  OutboundMessage,
  SendResult,
} from "../messaging.types";

/**
 * Default provider while no real messaging platform is connected.
 * Sends nothing: logs the attempt and reports "not_configured" so callers
 * can tell the user instead of pretending the message was delivered.
 */
@Injectable()
export class LogOnlyMessagingProvider implements MessagingProvider {
  readonly name = "none";
  private readonly logger = new Logger(LogOnlyMessagingProvider.name);

  isConfigured(): boolean {
    return false;
  }

  send(message: OutboundMessage): Promise<SendResult> {
    const what = message.template
      ? `template "${message.template.name}"`
      : "text message";
    this.logger.warn(
      `No messaging provider configured — ${message.channel} ${what} to ${maskPhone(message.to)} was NOT sent`
    );
    return Promise.resolve({ success: false, status: "not_configured" });
  }
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 4 ? `***${digits.slice(-4)}` : "***";
}
