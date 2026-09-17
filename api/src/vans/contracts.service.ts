import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { TenantContext } from "../tenancy/tenant-context";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, Contract, ContractStatus } from "@prisma/client";
import { CreateContractDto, UpdateContractDto, GetContractsDto } from "./dto";

export interface ContractStats {
  readonly total: number;
  readonly active: number;
  readonly expired: number;
  readonly broken: number;
  readonly totalRevenue: number;
}

interface ContractFilters {
  readonly status?: ContractStatus;
  readonly depot?: string;
  readonly supplier?: string;
  readonly search?: string;
}

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new contract
   * @param createContractDto - Contract creation data
   * @returns Created contract
   */
  async create(createContractDto: CreateContractDto): Promise<Contract> {
    try {
      // Organization of the domain the request came from
      const organization = { id: TenantContext.requireOrganizationId() };

      const contractData: Prisma.ContractCreateInput = {
        organization: {
          connect: { id: organization.id },
        },
        name: createContractDto.name,
        depot: createContractDto.depot,
        hireName: createContractDto.hireName,
        rentalRate: parseFloat(createContractDto.rentalRate),
        startDate: new Date(createContractDto.startDate),
        status: createContractDto.status,
        hasInsurance: createContractDto.hasInsurance,
        supplier: createContractDto.supplier,
        endDate: createContractDto.endDate
          ? new Date(createContractDto.endDate)
          : undefined,
        contactEmail: createContractDto.contactEmail,
        contactPhone: createContractDto.contactPhone,
        description: createContractDto.description,
      };

      return await this.prisma.contract.create({
        data: contractData,
        include: {
          vans: {
            select: {
              id: true,
              vanNumber: true,
              registration: true,
              make: true,
              model: true,
              status: true,
              condition: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create contract: ${error}`);
      throw error;
    }
  }

  /**
   * Find all contracts with filtering
   * @param filters - Filtering options
   * @returns Array of contracts with related data
   */
  async findAll(filters?: ContractFilters): Promise<Contract[]> {
    const where: Prisma.ContractWhereInput = {};

    // Use indexed fields for filtering
    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.depot) {
      where.depot = { contains: filters.depot, mode: "insensitive" };
    }

    if (filters?.supplier) {
      where.supplier = { contains: filters.supplier, mode: "insensitive" };
    }

    // Search across multiple fields
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { hireName: { contains: filters.search, mode: "insensitive" } },
        { depot: { contains: filters.search, mode: "insensitive" } },
        { supplier: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    try {
      return await this.prisma.contract.findMany({
        where,
        include: {
          vans: {
            select: {
              id: true,
              vanNumber: true,
              registration: true,
              make: true,
              model: true,
              status: true,
              condition: true,
            },
          },
        },
        orderBy: [{ name: "asc" }, { startDate: "desc" }],
      });
    } catch (error) {
      this.logger.error(`Failed to find contracts: ${error}`);
      throw error;
    }
  }

  /**
   * Find a contract by ID
   * @param id - Contract ID
   * @returns Contract with related data
   */
  async findOne(id: string): Promise<Contract> {
    try {
      const contract = await this.prisma.contract.findUnique({
        where: { id },
        include: {
          vans: {
            include: {
              maintenanceRecords: {
                where: {
                  status: { in: ["SCHEDULED", "IN_PROGRESS"] },
                },
                take: 3,
                orderBy: { scheduledDate: "asc" },
              },
            },
          },
        },
      });

      if (!contract) {
        throw new NotFoundException(`Contract with ID ${id} not found`);
      }

      return contract;
    } catch (error) {
      this.logger.error(`Failed to find contract ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Find a contract by name
   * @param name - Contract name
   * @returns Contract with related data
   */
  async findByName(name: string): Promise<Contract> {
    try {
      // Organization of the domain the request came from
      const organization = { id: TenantContext.requireOrganizationId() };

      const contract = await this.prisma.contract.findUnique({
        where: {
          organizationId_name: {
            organizationId: organization.id,
            name,
          },
        },
        include: {
          vans: {
            include: {
              maintenanceRecords: {
                where: {
                  status: { in: ["SCHEDULED", "IN_PROGRESS"] },
                },
                take: 3,
                orderBy: { scheduledDate: "asc" },
              },
            },
          },
        },
      });

      if (!contract) {
        throw new NotFoundException(`Contract with name ${name} not found`);
      }

      return contract;
    } catch (error) {
      this.logger.error(`Failed to find contract by name ${name}: ${error}`);
      throw error;
    }
  }

  /**
   * Update a contract
   * @param id - Contract ID
   * @param updateContractDto - Update data
   * @returns Updated contract
   */
  async update(
    id: string,
    updateContractDto: UpdateContractDto
  ): Promise<Contract> {
    try {
      // Check if contract exists
      await this.findOne(id);

      const updateData: Prisma.ContractUpdateInput = {
        ...(updateContractDto.name && { name: updateContractDto.name }),
        ...(updateContractDto.depot && { depot: updateContractDto.depot }),
        ...(updateContractDto.hireName && {
          hireName: updateContractDto.hireName,
        }),
        ...(updateContractDto.rentalRate && {
          rentalRate: parseFloat(updateContractDto.rentalRate),
        }),
        ...(updateContractDto.startDate && {
          startDate: new Date(updateContractDto.startDate),
        }),
        ...(updateContractDto.status && { status: updateContractDto.status }),
        ...(updateContractDto.hasInsurance !== undefined && {
          hasInsurance: updateContractDto.hasInsurance,
        }),
        ...(updateContractDto.supplier !== undefined && {
          supplier: updateContractDto.supplier,
        }),
        ...(updateContractDto.endDate && {
          endDate: new Date(updateContractDto.endDate),
        }),
        ...(updateContractDto.contactEmail !== undefined && {
          contactEmail: updateContractDto.contactEmail,
        }),
        ...(updateContractDto.contactPhone !== undefined && {
          contactPhone: updateContractDto.contactPhone,
        }),
        ...(updateContractDto.description !== undefined && {
          description: updateContractDto.description,
        }),
      };

      return await this.prisma.contract.update({
        where: { id },
        data: updateData,
        include: {
          vans: {
            select: {
              id: true,
              vanNumber: true,
              registration: true,
              make: true,
              model: true,
              status: true,
              condition: true,
            },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update contract ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a contract
   * @param id - Contract ID
   * @returns Deleted contract
   */
  async remove(id: string): Promise<Contract> {
    try {
      // Check if contract exists
      await this.findOne(id);

      // Disconnect vans before deletion
      await this.prisma.van.updateMany({
        where: { contractId: id },
        data: { contractId: null },
      });

      return await this.prisma.contract.delete({
        where: { id },
        include: {
          vans: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to delete contract ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Get dashboard statistics for contracts
   * @returns Contract statistics
   */
  async getStats(): Promise<ContractStats> {
    try {
      const [
        totalContracts,
        activeContracts,
        expiredContracts,
        brokenContracts,
        revenueSum,
      ] = await Promise.all([
        this.prisma.contract.count(),
        this.prisma.contract.count({ where: { status: "ACTIVE" } }),
        this.prisma.contract.count({ where: { status: "EXPIRED" } }),
        this.prisma.contract.count({ where: { status: "BROKEN_DOWN" } }),
        this.prisma.contract.aggregate({
          _sum: { rentalRate: true },
          where: { status: "ACTIVE" },
        }),
      ]);

      return {
        total: totalContracts,
        active: activeContracts,
        expired: expiredContracts,
        broken: brokenContracts,
        totalRevenue: revenueSum._sum.rentalRate?.toNumber() || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get contract stats: ${error}`);
      throw error;
    }
  }

  /**
   * Get contracts expiring soon
   * @param days - Warning days (default 30)
   * @returns Contracts expiring soon
   */
  async getExpiringSoon(days: number = 30): Promise<Contract[]> {
    try {
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + days);

      return await this.prisma.contract.findMany({
        where: {
          endDate: {
            lte: warningDate,
            gte: new Date(),
          },
          status: "ACTIVE",
        },
        include: {
          vans: {
            select: {
              id: true,
              vanNumber: true,
              registration: true,
              status: true,
            },
          },
        },
        orderBy: { endDate: "asc" },
      });
    } catch (error) {
      this.logger.error(`Failed to get expiring contracts: ${error}`);
      throw error;
    }
  }

  /**
   * Assign van to contract
   * @param contractId - Contract ID
   * @param vanId - Van ID
   * @returns Updated contract
   */
  async assignVan(contractId: string, vanId: string): Promise<Contract> {
    try {
      // Verify contract exists
      await this.findOne(contractId);

      // Update van with contract assignment
      await this.prisma.van.update({
        where: { id: vanId },
        data: { contractId },
      });

      return await this.findOne(contractId);
    } catch (error) {
      this.logger.error(
        `Failed to assign van ${vanId} to contract ${contractId}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Remove van from contract
   * @param contractId - Contract ID
   * @param vanId - Van ID
   * @returns Updated contract
   */
  async removeVan(contractId: string, vanId: string): Promise<Contract> {
    try {
      // Verify contract exists
      await this.findOne(contractId);

      // Remove van from contract
      await this.prisma.van.update({
        where: { id: vanId },
        data: { contractId: null },
      });

      return await this.findOne(contractId);
    } catch (error) {
      this.logger.error(
        `Failed to remove van ${vanId} from contract ${contractId}: ${error}`
      );
      throw error;
    }
  }
}
