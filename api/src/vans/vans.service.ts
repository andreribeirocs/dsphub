import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { TenantContext } from "../tenancy/tenant-context";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, Van, VanStatus, VanCondition } from "@prisma/client";
import { CreateVanDto, UpdateVanDto, GetVansDto } from "./dto";

// Constants
const MOT_WARNING_DAYS = 30;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export interface VanStats {
  readonly total: number;
  readonly active: number;
  readonly booked: number;
  readonly maintenance: number;
  readonly expiringMot: number;
  readonly alerts: number;
  readonly totalRental: number;
}

interface VanFilters {
  readonly status?: VanStatus;
  readonly condition?: VanCondition;
  readonly depot?: string;
  readonly depotId?: string;
  readonly contract?: string;
  readonly search?: string;
  readonly expiringMot?: boolean;
  readonly maintenanceAlerts?: boolean;
  readonly make?: string;
}

@Injectable()
export class VansService {
  private readonly logger = new Logger(VansService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new van
   * @param createVanDto - Van creation data
   * @returns Created van
   */
  async create(createVanDto: CreateVanDto): Promise<Van> {
    try {
      if (createVanDto.depotId) {
        const depot = await this.prisma.depot.findUnique({ where: { id: createVanDto.depotId } });
        if (!depot) {
          throw new BadRequestException("Depot not found");
        }
        (createVanDto as { depot?: string }).depot = depot.name;
      }

      // Organization of the domain the request came from
      const organization = { id: TenantContext.requireOrganizationId() };

      const vanData: Prisma.VanCreateInput = {
        organization: {
          connect: { id: organization.id },
        },
        vanNumber: createVanDto.vanNumber,
        registration: createVanDto.registration,
        make: createVanDto.make,
        model: createVanDto.model,
        year: createVanDto.year,
        status: createVanDto.status,
        condition: createVanDto.condition,
        motExpiry: createVanDto.motExpiry
          ? new Date(createVanDto.motExpiry)
          : undefined,
        monthlyRental: createVanDto.monthlyRental
          ? parseFloat(createVanDto.monthlyRental)
          : undefined,
        vin: createVanDto.vin,
        engineNumber: createVanDto.engineNumber,
        fuelType: createVanDto.fuelType,
        capacity: createVanDto.capacity,
        depot: createVanDto.depot,
        ...(createVanDto.depotId && { depotRef: { connect: { id: createVanDto.depotId } } }),
        assignedDriver: createVanDto.assignedDriver,
        mileage: createVanDto.mileage,
        lastService: createVanDto.lastService
          ? new Date(createVanDto.lastService)
          : undefined,
        nextService: createVanDto.nextService
          ? new Date(createVanDto.nextService)
          : undefined,
        comments: createVanDto.comments,
        motReminder: createVanDto.motReminder,
        contract: createVanDto.contractId
          ? {
              connect: { id: createVanDto.contractId },
            }
          : undefined,
      };

      return await this.prisma.van.create({
        data: vanData,
        include: {
          contract: true,
          maintenanceRecords: {
            where: { status: "SCHEDULED" },
            orderBy: { scheduledDate: "asc" },
            take: 5,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create van: ${error}`);
      throw error;
    }
  }

  /**
   * Find all vans with optimized filtering using indexes
   * @param filters - Filtering options
   * @returns Array of vans with related data
   */
  async findAll(filters?: VanFilters): Promise<Van[]> {
    const where: Prisma.VanWhereInput = {};

    // Use indexed fields for filtering
    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.condition) {
      where.condition = filters.condition;
    }

    if (filters?.depotId) {
      where.depotId = filters.depotId;
    } else if (filters?.depot) {
      where.depot = filters.depot;
    }

    if (filters?.make) {
      where.make = { contains: filters.make, mode: "insensitive" };
    }

    // Contract filtering
    if (filters?.contract) {
      where.contract = {
        name: { contains: filters.contract, mode: "insensitive" },
      };
    }

    // Search across multiple fields
    if (filters?.search) {
      where.OR = [
        { vanNumber: { contains: filters.search, mode: "insensitive" } },
        { registration: { contains: filters.search, mode: "insensitive" } },
        { make: { contains: filters.search, mode: "insensitive" } },
        { model: { contains: filters.search, mode: "insensitive" } },
        { assignedDriver: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Expiring MOT filter
    if (filters?.expiringMot) {
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + MOT_WARNING_DAYS);

      where.motExpiry = {
        lte: warningDate,
        gte: new Date(), // Only future dates
      };
    }

    // Maintenance alerts filter
    if (filters?.maintenanceAlerts) {
      where.OR = [
        { condition: { in: ["POOR", "NEEDS_ATTENTION"] } },
        {
          maintenanceRecords: {
            some: {
              status: "OVERDUE",
            },
          },
        },
      ];
    }

    try {
      return await this.prisma.van.findMany({
        where,
        include: {
          contract: true,
          maintenanceRecords: {
            where: {
              OR: [{ status: "SCHEDULED" }, { status: "OVERDUE" }],
            },
            orderBy: { scheduledDate: "asc" },
            take: 3,
          },
        },
        orderBy: [{ vanNumber: "asc" }, { registration: "asc" }],
      });
    } catch (error) {
      this.logger.error(`Failed to find vans: ${error}`);
      throw error;
    }
  }

  /**
   * Find a van by ID with full related data
   * @param id - Van ID
   * @returns Van with related data
   */
  async findOne(id: string): Promise<Van> {
    try {
      const van = await this.prisma.van.findUnique({
        where: { id },
        include: {
          contract: true,
          maintenanceRecords: {
            orderBy: { scheduledDate: "desc" },
            take: 10,
          },
        },
      });

      if (!van) {
        throw new NotFoundException(`Van with ID ${id} not found`);
      }

      return van;
    } catch (error) {
      this.logger.error(`Failed to find van ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Find a van by van number
   * @param vanNumber - Van number (e.g., "03")
   * @returns Van with related data
   */
  async findByVanNumber(vanNumber: string): Promise<Van> {
    try {
      // Organization of the domain the request came from
      const organization = { id: TenantContext.requireOrganizationId() };

      const van = await this.prisma.van.findUnique({
        where: {
          organizationId_vanNumber: {
            organizationId: organization.id,
            vanNumber,
          },
        },
        include: {
          contract: true,
          maintenanceRecords: {
            orderBy: { scheduledDate: "desc" },
            take: 10,
          },
        },
      });

      if (!van) {
        throw new NotFoundException(`Van with number ${vanNumber} not found`);
      }

      return van;
    } catch (error) {
      this.logger.error(`Failed to find van by number ${vanNumber}: ${error}`);
      throw error;
    }
  }

  /**
   * Update a van
   * @param id - Van ID
   * @param updateVanDto - Update data
   * @returns Updated van
   */
  async update(id: string, updateVanDto: UpdateVanDto): Promise<Van> {
    try {
      // Check if van exists
      await this.findOne(id);

      const updateData: Prisma.VanUpdateInput = {
        ...(updateVanDto.vanNumber && { vanNumber: updateVanDto.vanNumber }),
        ...(updateVanDto.registration && {
          registration: updateVanDto.registration,
        }),
        ...(updateVanDto.make && { make: updateVanDto.make }),
        ...(updateVanDto.model && { model: updateVanDto.model }),
        ...(updateVanDto.year !== undefined && { year: updateVanDto.year }),
        ...(updateVanDto.status && { status: updateVanDto.status }),
        ...(updateVanDto.condition && { condition: updateVanDto.condition }),
        ...(updateVanDto.motExpiry && {
          motExpiry: new Date(updateVanDto.motExpiry),
        }),
        ...(updateVanDto.monthlyRental && {
          monthlyRental: parseFloat(updateVanDto.monthlyRental),
        }),
        ...(updateVanDto.vin && { vin: updateVanDto.vin }),
        ...(updateVanDto.engineNumber && {
          engineNumber: updateVanDto.engineNumber,
        }),
        ...(updateVanDto.fuelType && { fuelType: updateVanDto.fuelType }),
        ...(updateVanDto.capacity && { capacity: updateVanDto.capacity }),
        ...(updateVanDto.depot && { depot: updateVanDto.depot }),
        ...(updateVanDto.assignedDriver && {
          assignedDriver: updateVanDto.assignedDriver,
        }),
        ...(updateVanDto.mileage !== undefined && {
          mileage: updateVanDto.mileage,
        }),
        ...(updateVanDto.lastService && {
          lastService: new Date(updateVanDto.lastService),
        }),
        ...(updateVanDto.nextService && {
          nextService: new Date(updateVanDto.nextService),
        }),
        ...(updateVanDto.comments !== undefined && {
          comments: updateVanDto.comments,
        }),
        ...(updateVanDto.motReminder !== undefined && {
          motReminder: updateVanDto.motReminder,
        }),
      };

      if (updateVanDto.depotId !== undefined) {
        if (updateVanDto.depotId) {
          const depot = await this.prisma.depot.findUnique({ where: { id: updateVanDto.depotId } });
          if (!depot) {
            throw new BadRequestException("Depot not found");
          }
          updateData.depotRef = { connect: { id: depot.id } };
          updateData.depot = depot.name;
        } else {
          updateData.depotRef = { disconnect: true };
          updateData.depot = null;
        }
      }

      // Handle contract assignment
      if (updateVanDto.contractId !== undefined) {
        updateData.contract = updateVanDto.contractId
          ? {
              connect: { id: updateVanDto.contractId },
            }
          : {
              disconnect: true,
            };
      }

      return await this.prisma.van.update({
        where: { id },
        data: updateData,
        include: {
          contract: true,
          maintenanceRecords: {
            where: { status: "SCHEDULED" },
            orderBy: { scheduledDate: "asc" },
            take: 5,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update van ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a van
   * @param id - Van ID
   * @returns Deleted van
   */
  async remove(id: string): Promise<Van> {
    try {
      // Check if van exists
      await this.findOne(id);

      return await this.prisma.van.delete({
        where: { id },
        include: {
          contract: true,
          maintenanceRecords: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to delete van ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Get dashboard statistics for vans
   * @returns Van statistics
   */
  async getStats(): Promise<VanStats> {
    try {
      const [
        totalVans,
        activeVans,
        bookedVans,
        maintenanceVans,
        expiringMotVans,
        poorConditionVans,
        rentalSum,
      ] = await Promise.all([
        this.prisma.van.count(),
        this.prisma.van.count({
          where: { status: { in: ["AVAILABLE", "BOOKED", "DELIVERED"] } },
        }),
        this.prisma.van.count({ where: { status: "BOOKED" } }),
        this.prisma.van.count({ where: { status: "MAINTENANCE" } }),
        this.prisma.van.count({
          where: {
            motExpiry: {
              lte: new Date(
                Date.now() + MOT_WARNING_DAYS * MILLISECONDS_PER_DAY
              ),
              gte: new Date(),
            },
          },
        }),
        this.prisma.van.count({
          where: { condition: { in: ["POOR", "NEEDS_ATTENTION"] } },
        }),
        this.prisma.van.aggregate({
          _sum: { monthlyRental: true },
          where: { monthlyRental: { not: null } },
        }),
      ]);

      return {
        total: totalVans,
        active: activeVans,
        booked: bookedVans,
        maintenance: maintenanceVans,
        expiringMot: expiringMotVans,
        alerts: poorConditionVans + expiringMotVans,
        totalRental: rentalSum._sum.monthlyRental?.toNumber() || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get van stats: ${error}`);
      throw error;
    }
  }

  /**
   * Get vans with expiring MOT
   * @param days - Warning days (default 30)
   * @returns Vans with expiring MOT
   */
  async getExpiringMot(days: number = MOT_WARNING_DAYS): Promise<Van[]> {
    try {
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + days);

      return await this.prisma.van.findMany({
        where: {
          motExpiry: {
            lte: warningDate,
            gte: new Date(),
          },
        },
        include: {
          contract: true,
        },
        orderBy: { motExpiry: "asc" },
      });
    } catch (error) {
      this.logger.error(`Failed to get vans with expiring MOT: ${error}`);
      throw error;
    }
  }
}
