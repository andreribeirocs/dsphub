import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { AvatarsController } from "./avatars.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [AvatarsController, UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
