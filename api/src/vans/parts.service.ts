import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { TenantContext } from "../tenancy/tenant-context";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, Part } from "@prisma/client";
import { CreatePartDto, UpdatePartDto, GetPartsDto } from "./dto";

export interface PartsStats {
  readonly total: number;
  readonly active: number;
  readonly lowStock: number;
  readonly categories: number;
  readonly totalValue: number;
}

interface PartsFilters {
  readonly category?: string;
  readonly search?: string;
  readonly supplier?: string;
  readonly activeOnly?: boolean;
  readonly lowStockOnly?: boolean;
  readonly vehicleMake?: string;
}

export interface PartPrice {
  readonly partId: string;
  readonly partName: string;
  readonly fordPrice: number | null;
  readonly mercedesPrice: number | null;
  readonly peugeotPrice: number | null;
}

@Injectable()
export class PartsService {
  private readonly logger = new Logger(PartsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new part
   * @param createPartDto - Part creation data
   * @returns Created part
   */
  async create(createPartDto: CreatePartDto): Promise<Part> {
    try {
      // Organization of the domain the request came from
      const organization = { id: TenantContext.requireOrganizationId() };

      const partData: Prisma.PartCreateInput = {
        organization: { connect: { id: organization.id } },
        name: createPartDto.name,
        category: createPartDto.category,
        fordPrice: createPartDto.fordPrice
          ? parseFloat(createPartDto.fordPrice)
          : undefined,
        mercedesPrice: createPartDto.mercedesPrice
          ? parseFloat(createPartDto.mercedesPrice)
          : undefined,
        peugeotPrice: createPartDto.peugeotPrice
          ? parseFloat(createPartDto.peugeotPrice)
          : undefined,
        partNumber: createPartDto.partNumber,
        supplier: createPartDto.supplier,
        description: createPartDto.description,
        stockLevel: createPartDto.stockLevel || 0,
        minStockLevel: createPartDto.minStockLevel || 0,
        maxStockLevel: createPartDto.maxStockLevel || 100,
        weight: createPartDto.weight
          ? parseFloat(createPartDto.weight)
          : undefined,
        dimensions: createPartDto.dimensions,
        warrantyDays: createPartDto.warrantyDays || 365,
        isActive: createPartDto.isActive !== false, // Default to true
      };

      return await this.prisma.part.create({
        data: partData,
      });
    } catch (error) {
      this.logger.error(`Failed to create part: ${error}`);
      throw error;
    }
  }

  /**
   * Find all parts with filtering
   * @param filters - Filtering options
   * @returns Array of parts
   */
  async findAll(filters?: PartsFilters): Promise<Part[]> {
    const where: Prisma.PartWhereInput = {};

    // Use indexed fields for filtering
    if (filters?.category) {
      where.category = { contains: filters.category, mode: "insensitive" };
    }

    if (filters?.supplier) {
      where.supplier = { contains: filters.supplier, mode: "insensitive" };
    }

    if (filters?.activeOnly !== undefined) {
      where.isActive = filters.activeOnly;
    }

    // Search across multiple fields
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { partNumber: { contains: filters.search, mode: "insensitive" } },
        { category: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Low stock filter - use raw query since Prisma doesn't support field comparison directly
    if (filters?.lowStockOnly) {
      // This will be handled in the query execution with a raw where condition
    }

    // Vehicle make compatibility filter
    if (filters?.vehicleMake) {
      const make = filters.vehicleMake.toLowerCase();
      if (make === "ford") {
        where.fordPrice = { not: null };
      } else if (make === "mercedes") {
        where.mercedesPrice = { not: null };
      } else if (make === "peugeot") {
        where.peugeotPrice = { not: null };
      }
    }

    try {
      // Handle low stock filter separately since Prisma doesn't support field comparison
      if (filters?.lowStockOnly) {
        const lowStockParts = await this.prisma.$queryRaw<Part[]>`
          SELECT * FROM parts 
          WHERE "stockLevel" <= "minStockLevel"
          AND "isActive" = true
          AND "organizationId" = ${TenantContext.requireOrganizationId()}
          ${filters.category ? Prisma.sql`AND LOWER(category) LIKE ${"%" + filters.category.toLowerCase() + "%"}` : Prisma.empty}
          ${filters.supplier ? Prisma.sql`AND LOWER(supplier) LIKE ${"%" + filters.supplier.toLowerCase() + "%"}` : Prisma.empty}
          ${filters.search ? Prisma.sql`AND (LOWER(name) LIKE ${"%" + filters.search.toLowerCase() + "%"} OR LOWER(description) LIKE ${"%" + filters.search.toLowerCase() + "%"})` : Prisma.empty}
          ORDER BY category ASC, name ASC
        `;
        return lowStockParts;
      }

      return await this.prisma.part.findMany({
        where,
        orderBy: [{ category: "asc" }, { name: "asc" }],
      });
    } catch (error) {
      this.logger.error(`Failed to find parts: ${error}`);
      throw error;
    }
  }

  /**
   * Find a part by ID
   * @param id - Part ID
   * @returns Part
   */
  async findOne(id: string): Promise<Part> {
    try {
      const part = await this.prisma.part.findUnique({
        where: { id },
      });

      if (!part) {
        throw new NotFoundException(`Part with ID ${id} not found`);
      }

      return part;
    } catch (error) {
      this.logger.error(`Failed to find part ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Find parts by category
   * @param category - Part category
   * @returns Array of parts in category
   */
  async findByCategory(category: string): Promise<Part[]> {
    try {
      return await this.prisma.part.findMany({
        where: {
          category: { contains: category, mode: "insensitive" },
          isActive: true,
        },
        orderBy: { name: "asc" },
      });
    } catch (error) {
      this.logger.error(
        `Failed to find parts by category ${category}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Update a part
   * @param id - Part ID
   * @param updatePartDto - Update data
   * @returns Updated part
   */
  async update(id: string, updatePartDto: UpdatePartDto): Promise<Part> {
    try {
      // Check if part exists
      await this.findOne(id);

      const updateData: Prisma.PartUpdateInput = {
        ...(updatePartDto.name && { name: updatePartDto.name }),
        ...(updatePartDto.category !== undefined && {
          category: updatePartDto.category,
        }),
        ...(updatePartDto.fordPrice !== undefined && {
          fordPrice: updatePartDto.fordPrice
            ? parseFloat(updatePartDto.fordPrice)
            : null,
        }),
        ...(updatePartDto.mercedesPrice !== undefined && {
          mercedesPrice: updatePartDto.mercedesPrice
            ? parseFloat(updatePartDto.mercedesPrice)
            : null,
        }),
        ...(updatePartDto.peugeotPrice !== undefined && {
          peugeotPrice: updatePartDto.peugeotPrice
            ? parseFloat(updatePartDto.peugeotPrice)
            : null,
        }),
        ...(updatePartDto.partNumber !== undefined && {
          partNumber: updatePartDto.partNumber,
        }),
        ...(updatePartDto.supplier !== undefined && {
          supplier: updatePartDto.supplier,
        }),
        ...(updatePartDto.description !== undefined && {
          description: updatePartDto.description,
        }),
        ...(updatePartDto.stockLevel !== undefined && {
          stockLevel: updatePartDto.stockLevel,
        }),
        ...(updatePartDto.minStockLevel !== undefined && {
          minStockLevel: updatePartDto.minStockLevel,
        }),
        ...(updatePartDto.maxStockLevel !== undefined && {
          maxStockLevel: updatePartDto.maxStockLevel,
        }),
        ...(updatePartDto.weight !== undefined && {
          weight: updatePartDto.weight
            ? parseFloat(updatePartDto.weight)
            : null,
        }),
        ...(updatePartDto.dimensions !== undefined && {
          dimensions: updatePartDto.dimensions,
        }),
        ...(updatePartDto.warrantyDays !== undefined && {
          warrantyDays: updatePartDto.warrantyDays,
        }),
        ...(updatePartDto.isActive !== undefined && {
          isActive: updatePartDto.isActive,
        }),
        lastUpdated: new Date(),
      };

      return await this.prisma.part.update({
        where: { id },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(`Failed to update part ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a part
   * @param id - Part ID
   * @returns Deleted part
   */
  async remove(id: string): Promise<Part> {
    try {
      // Check if part exists
      await this.findOne(id);

      return await this.prisma.part.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Failed to delete part ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Get dashboard statistics for parts
   * @returns Parts statistics
   */
  async getStats(): Promise<PartsStats> {
    try {
      const [
        totalParts,
        activeParts,
        lowStockParts,
        categoriesCount,
        totalValue,
      ] = await Promise.all([
        this.prisma.part.count(),
        this.prisma.part.count({ where: { isActive: true } }),
        this.prisma.$queryRaw<{ count: number }[]>`
          SELECT COUNT(*) as count FROM parts 
          WHERE "stockLevel" <= "minStockLevel" AND "isActive" = true
          AND "organizationId" = ${TenantContext.requireOrganizationId()}
        `,
        this.prisma.part.findMany({
          select: { category: true },
          distinct: ["category"],
          where: { category: { not: null } },
        }),
        this.prisma.$queryRaw<{ total: number }[]>`
          SELECT 
            COALESCE(SUM(
              (COALESCE("fordPrice", 0) +
              COALESCE("mercedesPrice", 0) +
              COALESCE("peugeotPrice", 0)) * "stockLevel"
            ), 0) as total
          FROM parts
          WHERE "isActive" = true
          AND "organizationId" = ${TenantContext.requireOrganizationId()}
        `,
      ]);

      return {
        total: totalParts,
        active: activeParts,
        lowStock: Number(lowStockParts[0]?.count || 0),
        categories: categoriesCount.length,
        totalValue: Number(totalValue[0]?.total || 0),
      };
    } catch (error) {
      this.logger.error(`Failed to get parts stats: ${error}`);
      throw error;
    }
  }

  /**
   * Get parts with low stock
   * @returns Array of parts with low stock
   */
  async getLowStockParts(): Promise<Part[]> {
    try {
      return await this.prisma.$queryRaw<Part[]>`
        SELECT * FROM parts 
        WHERE "stockLevel" <= "minStockLevel"
        AND "isActive" = true
        AND "organizationId" = ${TenantContext.requireOrganizationId()}
        ORDER BY category ASC, name ASC
      `;
    } catch (error) {
      this.logger.error(`Failed to get low stock parts: ${error}`);
      throw error;
    }
  }

  /**
   * Get pricing for all parts by vehicle make
   * @param vehicleMake - Vehicle make (ford, mercedes, peugeot)
   * @returns Array of part prices
   */
  async getPricingByVehicle(vehicleMake: string): Promise<PartPrice[]> {
    try {
      const make = vehicleMake.toLowerCase();
      let priceField: string;

      switch (make) {
        case "ford":
          priceField = '"fordPrice"';
          break;
        case "mercedes":
          priceField = '"mercedesPrice"';
          break;
        case "peugeot":
          priceField = '"peugeotPrice"';
          break;
        default:
          throw new Error(`Invalid vehicle make: ${vehicleMake}`);
      }

      return await this.prisma.$queryRaw<PartPrice[]>`
        SELECT 
          id as "partId",
          name as "partName",
          "fordPrice",
          "mercedesPrice",
          "peugeotPrice"
        FROM parts
        WHERE ${Prisma.raw(priceField)} IS NOT NULL
        AND "isActive" = true
        AND "organizationId" = ${TenantContext.requireOrganizationId()}
        ORDER BY category ASC, name ASC
      `;
    } catch (error) {
      this.logger.error(`Failed to get pricing for ${vehicleMake}: ${error}`);
      throw error;
    }
  }

  /**
   * Update stock level
   * @param id - Part ID
   * @param quantity - Quantity to add/subtract (positive to add, negative to subtract)
   * @returns Updated part
   */
  async updateStock(id: string, quantity: number): Promise<Part> {
    try {
      const part = await this.findOne(id);
      const newStockLevel = Math.max(0, part.stockLevel + quantity);

      return await this.prisma.part.update({
        where: { id },
        data: {
          stockLevel: newStockLevel,
          lastUpdated: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update stock for part ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Get all unique categories
   * @returns Array of category names
   */
  async getCategories(): Promise<string[]> {
    try {
      const categories = await this.prisma.part.findMany({
        select: { category: true },
        distinct: ["category"],
        where: {
          category: { not: null },
          isActive: true,
        },
        orderBy: { category: "asc" },
      });

      return categories.map((c) => c.category).filter(Boolean) as string[];
    } catch (error) {
      this.logger.error(`Failed to get categories: ${error}`);
      throw error;
    }
  }

  /**
   * Bulk update prices for a vehicle make
   * @param vehicleMake - Vehicle make
   * @param priceUpdates - Array of {partId, price}
   * @returns Number of parts updated
   */
  async bulkUpdatePrices(
    vehicleMake: string,
    priceUpdates: Array<{ partId: string; price: number }>
  ): Promise<number> {
    try {
      const make = vehicleMake.toLowerCase();
      let priceField: string;

      switch (make) {
        case "ford":
          priceField = "fordPrice";
          break;
        case "mercedes":
          priceField = "mercedesPrice";
          break;
        case "peugeot":
          priceField = "peugeotPrice";
          break;
        default:
          throw new Error(`Invalid vehicle make: ${vehicleMake}`);
      }

      let updateCount = 0;

      for (const update of priceUpdates) {
        await this.prisma.part.update({
          where: { id: update.partId },
          data: {
            [priceField]: update.price,
            lastUpdated: new Date(),
          },
        });
        updateCount++;
      }

      return updateCount;
    } catch (error) {
      this.logger.error(
        `Failed to bulk update prices for ${vehicleMake}: ${error}`
      );
      throw error;
    }
  }
}
