import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { UpdateDriverDto } from "./dto/update-driver.dto";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, Driver } from "@prisma/client";

// Constants
const EXPIRY_WARNING_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

interface DriverStats {
  readonly total: number;
  readonly active: number;
  readonly expiring: number;
  readonly pending: number;
}

interface DriverFilters {
  readonly status?: string;
  readonly depot?: string;
  readonly depotId?: string;
  readonly search?: string;
  readonly expiringOnly?: boolean;
}

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Find all drivers with optimized filtering using indexes
   * @param filters - Filtering options
   * @returns Array of drivers
   */
  async findAll(filters?: DriverFilters): Promise<Driver[]> {
    const where: Prisma.DriverWhereInput = {};

    // Use indexed fields for filtering
    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.depotId) {
      where.homeDepotId = filters.depotId;
    } else if (filters?.depot) {
      where.depot = filters.depot;
    }

    // Optimized search using indexed fields
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Filter for expiring documents using indexed date fields
    if (filters?.expiringOnly) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + EXPIRY_WARNING_DAYS);

      where.AND = [
        {
          OR: [
            { passportExpiry: { lte: expiryDate } },
            { licenseExpiry: { lte: expiryDate } },
            { rtwExpiry: { lte: expiryDate } },
          ],
        },
      ];
    }

    return this.prisma.driver.findMany({
      where,
      include: { homeDepot: { select: { id: true, code: true, name: true } } },
      orderBy: [
        { status: "asc" }, // Use indexed field for ordering
        { name: "asc" },
      ],
    });
  }

  /**
   * Find drivers by depot (optimized with index)
   * @param depot - Depot name
   * @returns Array of drivers in the depot
   */
  async findByDepot(depot: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: { depot },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Find drivers by status (optimized with index)
   * @param status - Driver status
   * @returns Array of drivers with the specified status
   */
  async findByStatus(status: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: { status },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Find drivers with expiring documents (optimized with indexed date fields)
   * @param days - Days ahead to check for expiry
   * @returns Array of drivers with expiring documents
   */
  async findExpiringDocuments(
    days: number = EXPIRY_WARNING_DAYS
  ): Promise<Driver[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    return this.prisma.driver.findMany({
      where: {
        OR: [
          { passportExpiry: { lte: expiryDate } },
          { licenseExpiry: { lte: expiryDate } },
          { rtwExpiry: { lte: expiryDate } },
        ],
      },
      orderBy: { passportExpiry: "asc" }, // Order by soonest expiry
    });
  }

  /**
   * Find a single driver by ID
   * @param id - Driver ID
   * @returns Driver object or null if not found
   */
  async findOne(id: string): Promise<Driver> {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        homeDepot: { select: { id: true, code: true, name: true } },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
          },
        },
        schedules: {
          orderBy: { date: "desc" },
          take: 30, // Last 30 schedule entries
        },
      },
    });
    if (!driver) {
      throw new NotFoundException("Driver not found");
    }
    return driver;
  }

  /**
   * Create a new driver
   * @param data - Driver creation data
   * @returns Created driver
   */
  async create(data: Prisma.DriverCreateInput): Promise<Driver> {
    try {
      return await this.prisma.driver.create({
        data,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              status: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error("Failed to create driver:", error);
      throw error;
    }
  }

  /**
   * Update a driver
   * @param id - Driver ID
   * @param data - Update data
   * @returns Updated driver
   */
  async update(id: string, dto: UpdateDriverDto): Promise<Driver> {
    const existing = await this.prisma.driver.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException("Driver not found");
    }

    const data: Prisma.DriverUncheckedUpdateInput = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.phone !== undefined && { phone: dto.phone.trim() }),
      ...(dto.email !== undefined && { email: dto.email.trim().toLowerCase() }),
      ...(dto.corporateEmail !== undefined && {
        // Empty string clears the field rather than storing ""
        corporateEmail: dto.corporateEmail.trim()
          ? dto.corporateEmail.trim().toLowerCase()
          : null,
      }),
      ...(dto.address !== undefined && { address: dto.address }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.transporterId !== undefined && { transporterId: dto.transporterId.trim() }),
      ...(dto.citizenship !== undefined && { citizenship: dto.citizenship }),
      ...(dto.contractType !== undefined && { contractType: dto.contractType }),
      ...(dto.licenseNumber !== undefined && { licenseNumber: dto.licenseNumber }),
      ...(dto.licenseExpiry !== undefined && { licenseExpiry: new Date(dto.licenseExpiry) }),
      ...(dto.passportExpiry !== undefined && { passportExpiry: new Date(dto.passportExpiry) }),
      ...(dto.rtwExpiry !== undefined && { rtwExpiry: new Date(dto.rtwExpiry) }),
      ...(dto.nextCheck !== undefined && { nextCheck: new Date(dto.nextCheck) }),
      ...(dto.points !== undefined && { points: dto.points }),
      ...(dto.hasEndorsements !== undefined && { hasEndorsements: dto.hasEndorsements }),
    };

    if (dto.homeDepotId !== undefined) {
      const depot = await this.prisma.depot.findUnique({
        where: { id: dto.homeDepotId },
        select: { id: true, name: true, isActive: true },
      });
      if (!depot || !depot.isActive) {
        throw new BadRequestException("Depot not found");
      }
      data.homeDepotId = depot.id;
      data.depot = depot.name;
    }

    try {
      return await this.prisma.driver.update({
        where: { id },
        data,
        include: {
          homeDepot: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, email: true, name: true, role: true, status: true } },
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new BadRequestException("Another driver already uses this Transporter ID");
      }
      this.logger.error(`Failed to update driver ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a driver
   * @param id - Driver ID
   * @returns Deleted driver
   */
  async delete(id: string): Promise<Driver> {
    // Drivers are never hard-deleted: payments and self-billing invoices must be
    // kept for record keeping. "Delete" deactivates the driver.
    const existing = await this.prisma.driver.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundException("Driver not found");
    }
    return this.prisma.driver.update({ where: { id }, data: { status: "INACTIVE" } });
  }

  /**
   * Get optimized driver statistics using indexed fields
   * @returns Driver statistics
   */
  async getStats(): Promise<DriverStats> {
    try {
      // Use Promise.all for parallel queries on indexed fields
      const [total, activeCount, expiring, pendingCount] = await Promise.all([
        this.prisma.driver.count(),
        this.prisma.driver.count({ where: { status: "ACTIVE" } }),
        this.getExpiringCount(),
        this.prisma.driver.count({ where: { status: "PENDING" } }),
      ]);

      return {
        total,
        active: activeCount,
        expiring,
        pending: pendingCount,
      };
    } catch (error) {
      this.logger.error("Failed to get driver statistics:", error);
      throw error;
    }
  }

  /**
   * Get count of drivers with expiring documents (using indexed date fields)
   * @private
   */
  private async getExpiringCount(): Promise<number> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + EXPIRY_WARNING_DAYS);

    return this.prisma.driver.count({
      where: {
        OR: [
          { passportExpiry: { lte: expiryDate } },
          { licenseExpiry: { lte: expiryDate } },
          { rtwExpiry: { lte: expiryDate } },
        ],
      },
    });
  }
}
