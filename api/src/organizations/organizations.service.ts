import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOrganizationDto } from "./dto/create-organization.dto";
import { UpdateOrganizationDto } from "./dto/update-organization.dto";
import { BetterAuthService } from "../auth/better-auth.service";

@Injectable()
export class OrganizationsService {
  constructor(
    private prisma: PrismaService,
    private betterAuthService: BetterAuthService
  ) {}

  /**
   * Create a new organization (SUPER_ADMIN only)
   */
  async create(dto: CreateOrganizationDto, userId: string) {
    // Check if slug already exists
    const existing = await this.betterAuthService.getOrganizationBySlug(
      dto.slug
    );
    if (existing) {
      throw new BadRequestException(
        `Organization with slug '${dto.slug}' already exists`
      );
    }

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        address: dto.address,
        city: dto.city,
        postcode: dto.postcode,
        country: dto.country || "United Kingdom",
        phone: dto.phone,
        email: dto.email,
        website: dto.website,
        taxId: dto.taxId,
        registrationNumber: dto.registrationNumber,
        vatNumber: dto.vatNumber,
        companyRegNumber: dto.companyRegNumber,
        logoBase64: dto.logoBase64,
        bankName: dto.bankName,
        bankAccountNumber: dto.bankAccountNumber,
        bankSortCode: dto.bankSortCode,
        iban: dto.iban,
        swiftCode: dto.swiftCode,
        termsAndConditions: dto.termsAndConditions,
        footerText: dto.footerText,
        invoicePrefix: dto.invoicePrefix,
        invoiceFooter: dto.invoiceFooter,
        depots: dto.depots,
        isActive: true,
      },
    });

    return organization;
  }

  /**
   * Get all organizations (SUPER_ADMIN only)
   */
  async findAll() {
    return this.prisma.organization.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            members: true,
            drivers: true,
            invoices: true,
          },
        },
      },
    });
  }

  /**
   * Get organization by ID
   */
  async findOne(id: string, userId: string, isSuperAdmin: boolean) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            members: true,
            drivers: true,
            candidates: true,
            driverPayments: true,
            invoices: true,
            vans: true,
            contracts: true,
            parts: true,
            maintenanceRecords: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    // Check access
    if (!isSuperAdmin) {
      const hasAccess = await this.betterAuthService.hasOrganizationAccess(
        userId,
        id
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          "You do not have access to this organization"
        );
      }
    }

    return organization;
  }

  /**
   * Update organization
   */
  async update(
    id: string,
    dto: UpdateOrganizationDto,
    userId: string,
    isSuperAdmin: boolean
  ) {
    // Check if organization exists
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    // Check access
    if (!isSuperAdmin) {
      const hasAccess = await this.betterAuthService.hasOrganizationAccess(
        userId,
        id
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          "You do not have access to this organization"
        );
      }
    }

    // If slug is being changed, check it's not taken
    if (dto.slug && dto.slug !== organization.slug) {
      const existing = await this.betterAuthService.getOrganizationBySlug(
        dto.slug
      );
      if (existing) {
        throw new BadRequestException(
          `Organization with slug '${dto.slug}' already exists`
        );
      }
    }

    // Update organization
    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.postcode !== undefined && { postcode: dto.postcode }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.registrationNumber !== undefined && {
          registrationNumber: dto.registrationNumber,
        }),
        ...(dto.vatNumber !== undefined && { vatNumber: dto.vatNumber }),
        ...(dto.companyRegNumber !== undefined && {
          companyRegNumber: dto.companyRegNumber,
        }),
        ...(dto.logoBase64 !== undefined && { logoBase64: dto.logoBase64 }),
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.bankAccountNumber !== undefined && {
          bankAccountNumber: dto.bankAccountNumber,
        }),
        ...(dto.bankSortCode !== undefined && {
          bankSortCode: dto.bankSortCode,
        }),
        ...(dto.iban !== undefined && { iban: dto.iban }),
        ...(dto.swiftCode !== undefined && { swiftCode: dto.swiftCode }),
        ...(dto.termsAndConditions !== undefined && {
          termsAndConditions: dto.termsAndConditions,
        }),
        ...(dto.footerText !== undefined && { footerText: dto.footerText }),
        ...(dto.invoicePrefix !== undefined && {
          invoicePrefix: dto.invoicePrefix,
        }),
        ...(dto.invoiceFooter !== undefined && {
          invoiceFooter: dto.invoiceFooter,
        }),
        ...(dto.depots !== undefined && { depots: dto.depots }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  /**
   * Deactivate organization (SUPER_ADMIN only)
   */
  async remove(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException("Organization not found");
    }

    // Soft delete by setting isActive to false
    return this.prisma.organization.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get organization members
   */
  async getMembers(id: string, userId: string, isSuperAdmin: boolean) {
    // Check access
    if (!isSuperAdmin) {
      const hasAccess = await this.betterAuthService.hasOrganizationAccess(
        userId,
        id
      );
      if (!hasAccess) {
        throw new ForbiddenException(
          "You do not have access to this organization"
        );
      }
    }

    const members = await this.prisma.$queryRaw<any[]>`
      SELECT 
        m.id,
        m.role as "memberRole",
        m."createdAt",
        u.id as "userId",
        u.email,
        u.name,
        u.role as "userRole",
        u.status
      FROM "member" m
      JOIN "user" u ON u.id = m."userId"
      WHERE m."organizationId" = ${id}
      ORDER BY u.name
    `;

    return members;
  }
}
