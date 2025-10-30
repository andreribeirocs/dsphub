import { Module } from "@nestjs/common";
import { OrganizationsService } from "./organizations.service";
import { OrganizationsController } from "./organizations.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { BetterAuthModule } from "../auth/better-auth.module";

@Module({
  imports: [PrismaModule, BetterAuthModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
