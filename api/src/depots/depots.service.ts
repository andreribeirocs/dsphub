import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenancy/tenant-context";
import { CreateDepotDto, UpdateDepotDto } from "./dto/depot.dto";

@Injectable()
export class DepotsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Depots of the current DSP visible to the current user */
  async findAll(includeInactive = false) {
    return this.prisma.depot.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ isActive: "desc" }, { code: "asc" }],
      include: { _count: { select: { homeDrivers: true, vans: true } } },
    });
  }

  async findOne(id: string) {
    const depot = await this.prisma.depot.findUnique({ where: { id } });
    if (!depot) {
      throw new NotFoundException("Depot not found");
    }
    return depot;
  }

  async create(dto: CreateDepotDto) {
    try {
      return await this.prisma.depot.create({
        data: {
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          address: dto.address?.trim() || null,
          postcode: dto.postcode?.trim().toUpperCase() || null,
          organizationId: TenantContext.requireOrganizationId(),
        },
      });
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async update(id: string, dto: UpdateDepotDto) {
    const current = await this.findOne(id);
    try {
      const depot = await this.prisma.depot.update({
        where: { id },
        data: {
          ...(dto.code !== undefined && { code: dto.code.trim().toUpperCase() }),
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.address !== undefined && { address: dto.address.trim() || null }),
          ...(dto.postcode !== undefined && { postcode: dto.postcode.trim().toUpperCase() || null }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      // Keep the legacy free-text depot names in sync
      if (dto.name !== undefined && dto.name.trim() !== current.name) {
        await this.prisma.driver.updateMany({
          where: { homeDepotId: id },
          data: { depot: depot.name },
        });
        await this.prisma.van.updateMany({ where: { depotId: id }, data: { depot: depot.name } });
      }

      return depot;
    } catch (error) {
      throw this.translateError(error);
    }
  }

  /** Replace the depots a member of this DSP is limited to */
  async setMemberDepots(userId: string, depotIds: string[]) {
    const member = await this.prisma.member.findFirst({ where: { userId } });
    if (!member) {
      throw new NotFoundException("User not found");
    }

    if (depotIds.length > 0) {
      const found = await this.prisma.depot.count({ where: { id: { in: depotIds } } });
      if (found !== depotIds.length) {
        throw new BadRequestException("One or more depots do not exist");
      }
    }

    await this.prisma.tenantTransaction(async (tx) => {
      await tx.memberDepot.deleteMany({ where: { memberId: member.id } });
      for (const depotId of depotIds) {
        await tx.memberDepot.create({ data: { memberId: member.id, depotId } });
      }
    });

    return this.getMemberDepots(userId);
  }

  async getMemberDepots(userId: string) {
    const rows = await this.prisma.memberDepot.findMany({
      where: { member: { userId } },
      include: { depot: { select: { id: true, code: true, name: true } } },
    });
    return {
      allDepots: rows.length === 0,
      depots: rows.map((row) => row.depot),
    };
  }

  private translateError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return new ConflictException("A depot with this code already exists");
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
