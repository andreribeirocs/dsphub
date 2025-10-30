import { Module, Global } from "@nestjs/common";
import { BetterAuthService } from "./better-auth.service";
import { BetterAuthController } from "./better-auth.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Global()
@Module({
  imports: [PrismaModule],
  providers: [BetterAuthService],
  controllers: [BetterAuthController],
  exports: [BetterAuthService],
})
export class BetterAuthModule {}
