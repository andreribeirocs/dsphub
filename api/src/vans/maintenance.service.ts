import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  Prisma,
  MaintenanceRecord,
  MaintenanceStatus,
  MaintenancePriority,
} from "@prisma/client";
import {
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  GetMaintenanceDto,
} from "./dto";

export interface MaintenanceStats {
  readonly total: number;
  readonly scheduled: number;
  readonly inProgress: number;
  readonly overdue: number;
  readonly completed: number;
  readonly totalCost: number;
}

interface MaintenanceFilters {
  readonly vanId?: string;
  readonly status?: MaintenanceStatus;
  readonly priority?: MaintenancePriority;
  readonly type?: string;
  readonly overdueOnly?: boolean;
  readonly upcomingOnly?: boolean;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new maintenance record
   * @param createMaintenanceDto - Maintenance creation data
   * @returns Created maintenance record
   */
  async create(
    createMaintenanceDto: CreateMaintenanceDto
  ): Promise<MaintenanceRecord> {
    try {
      const maintenanceData: Prisma.MaintenanceRecordCreateInput = {
        van: { connect: { id: createMaintenanceDto.vanId } },
        type: createMaintenanceDto.type,
        description: createMaintenanceDto.description,
        scheduledDate: new Date(createMaintenanceDto.scheduledDate),
        status: createMaintenanceDto.status,
        priority: createMaintenanceDto.priority,
        estimatedCost: createMaintenanceDto.estimatedCost
          ? parseFloat(createMaintenanceDto.estimatedCost)
          : undefined,
        workshop: createMaintenanceDto.workshop,
        workshopContact: createMaintenanceDto.workshopContact,
        notes: createMaintenanceDto.notes,
        assignedTo: createMaintenanceDto.assignedTo,
      };

      return await this.prisma.maintenanceRecord.create({
        data: maintenanceData,
        include: {
          van: {
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
      this.logger.error(`Failed to create maintenance record: ${error}`);
      throw error;
    }
  }

  /**
   * Find all maintenance records with filtering
   * @param filters - Filtering options
   * @returns Array of maintenance records with related data
   */
  async findAll(filters?: MaintenanceFilters): Promise<MaintenanceRecord[]> {
    const where: Prisma.MaintenanceRecordWhereInput = {};

    // Use indexed fields for filtering
    if (filters?.vanId) {
      where.vanId = filters.vanId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.priority) {
      where.priority = filters.priority;
    }

    if (filters?.type) {
      where.type = { contains: filters.type, mode: "insensitive" };
    }

    // Overdue filter
    if (filters?.overdueOnly) {
      where.AND = [
        { scheduledDate: { lt: new Date() } },
        { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
        { isOverdue: true },
      ];
    }

    // Upcoming filter (next 30 days)
    if (filters?.upcomingOnly) {
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + 30);

      where.AND = [
        { scheduledDate: { gte: new Date() } },
        { scheduledDate: { lte: upcomingDate } },
        { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      ];
    }

    try {
      return await this.prisma.maintenanceRecord.findMany({
        where,
        include: {
          van: {
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
        orderBy: [{ priority: "desc" }, { scheduledDate: "asc" }],
      });
    } catch (error) {
      this.logger.error(`Failed to find maintenance records: ${error}`);
      throw error;
    }
  }

  /**
   * Find a maintenance record by ID
   * @param id - Maintenance record ID
   * @returns Maintenance record with related data
   */
  async findOne(id: string): Promise<MaintenanceRecord> {
    try {
      const maintenance = await this.prisma.maintenanceRecord.findUnique({
        where: { id },
        include: {
          van: {
            include: {
              contract: true,
            },
          },
        },
      });

      if (!maintenance) {
        throw new NotFoundException(
          `Maintenance record with ID ${id} not found`
        );
      }

      return maintenance;
    } catch (error) {
      this.logger.error(`Failed to find maintenance record ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Update a maintenance record
   * @param id - Maintenance record ID
   * @param updateMaintenanceDto - Update data
   * @returns Updated maintenance record
   */
  async update(
    id: string,
    updateMaintenanceDto: UpdateMaintenanceDto
  ): Promise<MaintenanceRecord> {
    try {
      // Check if maintenance record exists
      await this.findOne(id);

      const updateData: Prisma.MaintenanceRecordUpdateInput = {
        ...(updateMaintenanceDto.vanId && {
          van: { connect: { id: updateMaintenanceDto.vanId } },
        }),
        ...(updateMaintenanceDto.type && { type: updateMaintenanceDto.type }),
        ...(updateMaintenanceDto.description && {
          description: updateMaintenanceDto.description,
        }),
        ...(updateMaintenanceDto.scheduledDate && {
          scheduledDate: new Date(updateMaintenanceDto.scheduledDate),
        }),
        ...(updateMaintenanceDto.status && {
          status: updateMaintenanceDto.status,
        }),
        ...(updateMaintenanceDto.priority && {
          priority: updateMaintenanceDto.priority,
        }),
        ...(updateMaintenanceDto.estimatedCost && {
          estimatedCost: parseFloat(updateMaintenanceDto.estimatedCost),
        }),
        ...(updateMaintenanceDto.workshop !== undefined && {
          workshop: updateMaintenanceDto.workshop,
        }),
        ...(updateMaintenanceDto.workshopContact !== undefined && {
          workshopContact: updateMaintenanceDto.workshopContact,
        }),
        ...(updateMaintenanceDto.notes !== undefined && {
          notes: updateMaintenanceDto.notes,
        }),
        ...(updateMaintenanceDto.assignedTo !== undefined && {
          assignedTo: updateMaintenanceDto.assignedTo,
        }),
        ...(updateMaintenanceDto.completedDate && {
          completedDate: new Date(updateMaintenanceDto.completedDate),
        }),
        ...(updateMaintenanceDto.actualCost && {
          actualCost: parseFloat(updateMaintenanceDto.actualCost),
        }),
        ...(updateMaintenanceDto.laborHours && {
          laborHours: parseFloat(updateMaintenanceDto.laborHours),
        }),
        ...(updateMaintenanceDto.invoiceNumber !== undefined && {
          invoiceNumber: updateMaintenanceDto.invoiceNumber,
        }),
        ...(updateMaintenanceDto.warrantyUntil && {
          warrantyUntil: new Date(updateMaintenanceDto.warrantyUntil),
        }),
      };

      // Auto-update isOverdue status
      if (updateData.scheduledDate) {
        const now = new Date();
        const scheduled = updateData.scheduledDate as Date;
        updateData.isOverdue =
          scheduled < now &&
          !["COMPLETED", "CANCELLED"].includes(
            updateMaintenanceDto.status || ""
          );
      }

      return await this.prisma.maintenanceRecord.update({
        where: { id },
        data: updateData,
        include: {
          van: {
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
      this.logger.error(`Failed to update maintenance record ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a maintenance record
   * @param id - Maintenance record ID
   * @returns Deleted maintenance record
   */
  async remove(id: string): Promise<MaintenanceRecord> {
    try {
      // Check if maintenance record exists
      await this.findOne(id);

      return await this.prisma.maintenanceRecord.delete({
        where: { id },
        include: {
          van: true,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to delete maintenance record ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * Get dashboard statistics for maintenance
   * @returns Maintenance statistics
   */
  async getStats(): Promise<MaintenanceStats> {
    try {
      const [
        totalMaintenance,
        scheduledMaintenance,
        inProgressMaintenance,
        overdueMaintenance,
        completedMaintenance,
        costSum,
      ] = await Promise.all([
        this.prisma.maintenanceRecord.count(),
        this.prisma.maintenanceRecord.count({ where: { status: "SCHEDULED" } }),
        this.prisma.maintenanceRecord.count({
          where: { status: "IN_PROGRESS" },
        }),
        this.prisma.maintenanceRecord.count({ where: { isOverdue: true } }),
        this.prisma.maintenanceRecord.count({ where: { status: "COMPLETED" } }),
        this.prisma.maintenanceRecord.aggregate({
          _sum: { actualCost: true },
          where: { status: "COMPLETED" },
        }),
      ]);

      return {
        total: totalMaintenance,
        scheduled: scheduledMaintenance,
        inProgress: inProgressMaintenance,
        overdue: overdueMaintenance,
        completed: completedMaintenance,
        totalCost: costSum._sum.actualCost?.toNumber() || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get maintenance stats: ${error}`);
      throw error;
    }
  }

  /**
   * Get maintenance alerts (overdue and high priority upcoming)
   * @returns Array of maintenance records requiring attention
   */
  async getAlerts(): Promise<MaintenanceRecord[]> {
    try {
      const upcomingDate = new Date();
      upcomingDate.setDate(upcomingDate.getDate() + 7); // Next 7 days

      return await this.prisma.maintenanceRecord.findMany({
        where: {
          OR: [
            // Overdue maintenance
            {
              AND: [
                { scheduledDate: { lt: new Date() } },
                { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
              ],
            },
            // High priority upcoming maintenance
            {
              AND: [
                { scheduledDate: { gte: new Date() } },
                { scheduledDate: { lte: upcomingDate } },
                { priority: { in: ["HIGH", "URGENT"] } },
                { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
              ],
            },
          ],
        },
        include: {
          van: {
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
        orderBy: [{ priority: "desc" }, { scheduledDate: "asc" }],
      });
    } catch (error) {
      this.logger.error(`Failed to get maintenance alerts: ${error}`);
      throw error;
    }
  }

  /**
   * Update overdue status for all maintenance records
   * This should be run periodically (e.g., daily cron job)
   */
  async updateOverdueStatus(): Promise<void> {
    try {
      const now = new Date();

      // Mark as overdue
      await this.prisma.maintenanceRecord.updateMany({
        where: {
          scheduledDate: { lt: now },
          status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          isOverdue: false,
        },
        data: { isOverdue: true },
      });

      // Clear overdue for future dates
      await this.prisma.maintenanceRecord.updateMany({
        where: {
          scheduledDate: { gte: now },
          isOverdue: true,
        },
        data: { isOverdue: false },
      });

      this.logger.log("Updated overdue status for maintenance records");
    } catch (error) {
      this.logger.error(`Failed to update overdue status: ${error}`);
      throw error;
    }
  }

  /**
   * Complete maintenance and update van status if needed
   * @param id - Maintenance record ID
   * @param completionData - Completion data
   * @returns Updated maintenance record
   */
  async completeMaintenance(
    id: string,
    completionData: {
      actualCost?: string;
      laborHours?: string;
      invoiceNumber?: string;
      notes?: string;
      partsUsed?: any[];
    }
  ): Promise<MaintenanceRecord> {
    try {
      const maintenance = await this.findOne(id);

      const updateData: Prisma.MaintenanceRecordUpdateInput = {
        status: "COMPLETED",
        completedDate: new Date(),
        isOverdue: false,
        ...(completionData.actualCost && {
          actualCost: parseFloat(completionData.actualCost),
        }),
        ...(completionData.laborHours && {
          laborHours: parseFloat(completionData.laborHours),
        }),
        ...(completionData.invoiceNumber && {
          invoiceNumber: completionData.invoiceNumber,
        }),
        ...(completionData.notes && { notes: completionData.notes }),
        ...(completionData.partsUsed && {
          partsUsed: completionData.partsUsed,
        }),
      };

      const updated = await this.prisma.maintenanceRecord.update({
        where: { id },
        data: updateData,
        include: {
          van: {
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

      // If van was in maintenance status, update it back to available
      if ((maintenance as any).van?.status === "MAINTENANCE") {
        await this.prisma.van.update({
          where: { id: maintenance.vanId },
          data: { status: "AVAILABLE" },
        });
      }

      return updated;
    } catch (error) {
      this.logger.error(`Failed to complete maintenance ${id}: ${error}`);
      throw error;
    }
  }
}
