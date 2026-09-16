import { Global, Module } from "@nestjs/common";
import { MESSAGING_PROVIDER } from "./messaging.types";
import { LogOnlyMessagingProvider } from "./providers/log-only.provider";

/**
 * Single place where the messaging provider is chosen.
 * Swap useClass for a real provider implementation when one is selected.
 */
@Global()
@Module({
  providers: [
    {
      provide: MESSAGING_PROVIDER,
      useClass: LogOnlyMessagingProvider,
    },
  ],
  exports: [MESSAGING_PROVIDER],
})
export class MessagingModule {}
