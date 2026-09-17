import { Controller, Get, NotFoundException, Param, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { join } from "path";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenancy/tenant-context";

const AVATAR_FILE = /^avatar-[\w-]+\.(jpg|jpeg|png|gif|webp)$/i;

/**
 * Serves avatar images only to logged-in members of a DSP the avatar's owner
 * also belongs to. Replaces the old public /uploads static route.
 */
@Controller("uploads")
@UseGuards(BetterAuthGuard)
export class AvatarsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("avatars/:file")
  async avatar(@Param("file") file: string, @Res() res: Response): Promise<void> {
    if (!AVATAR_FILE.test(file)) {
      throw new NotFoundException();
    }

    const owner = await this.prisma.user.findFirst({
      where: {
        avatar: { in: [`/api/uploads/avatars/${file}`, `/uploads/avatars/${file}`] },
        members: { some: { organizationId: TenantContext.requireOrganizationId() } },
      },
      select: { id: true },
    });
    if (!owner) {
      throw new NotFoundException();
    }

    res.setHeader("Cache-Control", "private, max-age=3600");
    res.sendFile(join(process.cwd(), "uploads", "avatars", file), (error) => {
      if (error && !res.headersSent) {
        res.status(404).end();
      }
    });
  }
}
