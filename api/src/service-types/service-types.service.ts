import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenancy/tenant-context";
import {
  CreateServiceTypeDto,
  UpdateServiceTypeDto,
} from "./dto/service-type.dto";

/**
 * Service types a DSP offers. Scoped to the current organization by the Prisma
 * tenant extension and, in the database, by the service_type RLS policy.
 *
 * Rows created by the migration carry a `code` matching a RouteType enum value.
 * That code is the bridge back to the payment tables, which still store the
 * enum, so it cannot be edited once the row exists.
 */
@Injectable()
export class ServiceTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive = false) {
    return this.prisma.serviceType.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async findOne(id: string) {
    const serviceType = await this.prisma.serviceType.findUnique({
      where: { id },
    });
    if (!serviceType) {
      throw new NotFoundException("Service type not found");
    }
    return serviceType;
  }

  async create(dto: CreateServiceTypeDto) {
    try {
      return await this.prisma.serviceType.create({
        data: {
          organizationId: TenantContext.requireOrganizationId(),
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          hours: dto.hours ?? null,
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (error) {
      throw this.translateError(error);
    }
  }

  async update(id: string, dto: UpdateServiceTypeDto) {
    await this.findOne(id);
    try {
      return await this.prisma.serviceType.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.hours !== undefined && { hours: dto.hours }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        },
      });
    } catch (error) {
      throw this.translateError(error);
    }
  }

  /**
   * Deactivate rather than delete: payment history references these types by
   * code, and a DSP that stops offering a service still has last month's pay
   * runs to show.
   */
  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.serviceType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private translateError(error: unknown): Error {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return new ConflictException(
        "This DSP already has a service type with that code"
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
