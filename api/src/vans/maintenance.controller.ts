import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { MaintenanceService, MaintenanceStats } from "./maintenance.service";
import {
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  GetMaintenanceDto,
} from "./dto";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../auth/enums/role.enum";
import { ThrottleModerate } from "../auth/decorators/throttle.decorator";
import { MaintenanceRecord } from "@prisma/client";

@ApiTags("maintenance")
@Controller("maintenance")
@UseGuards(BetterAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  /**
   * Create a new maintenance record
   * @param createMaintenanceDto - Maintenance creation data
   * @returns Created maintenance record
   */
  @Post()
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ThrottleModerate()
  @ApiOperation({ summary: "Create a new maintenance record" })
  @ApiResponse({
    status: 201,
    description: "Maintenance record created successfully",
    type: Object, // Would be MaintenanceRecord type in real implementation
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 404, description: "Van not found" })
  async create(
    @Body(ValidationPipe) createMaintenanceDto: CreateMaintenanceDto
  ): Promise<MaintenanceRecord> {
    return await this.maintenanceService.create(createMaintenanceDto);
  }

  /**
   * Get all maintenance records with optional filtering
   * @param query - Filter parameters
   * @returns Array of maintenance records
   */
  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ApiOperation({
    summary: "Get all maintenance records with filtering options",
  })
  @ApiResponse({
    status: 200,
    description: "Array of maintenance records with related data",
    type: [Object], // Would be MaintenanceRecord[] type in real implementation
  })
  @ApiQuery({ name: "vanId", required: false, description: "Filter by van ID" })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filter by maintenance status",
  })
  @ApiQuery({
    name: "priority",
    required: false,
    description: "Filter by priority",
  })
  @ApiQuery({
    name: "type",
    required: false,
    description: "Filter by maintenance type",
  })
  @ApiQuery({
    name: "overdueOnly",
    required: false,
    type: "boolean",
    description: "Show only overdue maintenance",
  })
  @ApiQuery({
    name: "upcomingOnly",
    required: false,
    type: "boolean",
    description: "Show only upcoming maintenance",
  })
  async findAll(
    @Query(ValidationPipe) query: GetMaintenanceDto
  ): Promise<MaintenanceRecord[]> {
    return await this.maintenanceService.findAll(query);
  }

  /**
   * Get maintenance dashboard statistics
   * @returns Maintenance statistics
   */
  @Get("stats")
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE,
    Role.MANAGER_FINANCIAL
  )
  @ApiOperation({ summary: "Get maintenance dashboard statistics" })
  @ApiResponse({
    status: 200,
    description: "Maintenance statistics",
    schema: {
      type: "object",
      properties: {
        total: { type: "number", description: "Total maintenance records" },
        scheduled: { type: "number", description: "Scheduled maintenance" },
        inProgress: { type: "number", description: "In progress maintenance" },
        overdue: { type: "number", description: "Overdue maintenance" },
        completed: { type: "number", description: "Completed maintenance" },
        totalCost: { type: "number", description: "Total maintenance cost" },
      },
    },
  })
  async getStats(): Promise<MaintenanceStats> {
    return await this.maintenanceService.getStats();
  }

  /**
   * Get maintenance alerts (overdue and high priority upcoming)
   * @returns Array of maintenance records requiring attention
   */
  @Get("alerts")
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ApiOperation({ summary: "Get maintenance alerts" })
  @ApiResponse({
    status: 200,
    description: "Maintenance records requiring attention",
    type: [Object], // Would be MaintenanceRecord[] type in real implementation
  })
  async getAlerts(): Promise<MaintenanceRecord[]> {
    return await this.maintenanceService.getAlerts();
  }

  /**
   * Update overdue status for all maintenance records
   * @returns Success message
   */
  @Put("update-overdue")
  @Roles(Role.SUPER_ADMIN, Role.OWNER, Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({
    summary: "Update overdue status for all maintenance records",
  })
  @ApiResponse({
    status: 200,
    description: "Overdue status updated successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Success message" },
      },
    },
  })
  async updateOverdueStatus() {
    await this.maintenanceService.updateOverdueStatus();
    return { message: "Overdue status updated successfully" };
  }

  /**
   * Get a specific maintenance record by ID
   * @param id - Maintenance record ID
   * @returns Maintenance record with related data
   */
  @Get(":id")
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ApiOperation({ summary: "Get a maintenance record by ID" })
  @ApiResponse({
    status: 200,
    description: "Maintenance record with related data",
    type: Object, // Would be MaintenanceRecord type in real implementation
  })
  @ApiResponse({ status: 404, description: "Maintenance record not found" })
  @ApiParam({ name: "id", description: "Maintenance record ID" })
  async findOne(@Param("id") id: string): Promise<MaintenanceRecord> {
    return await this.maintenanceService.findOne(id);
  }

  /**
   * Update a maintenance record
   * @param id - Maintenance record ID
   * @param updateMaintenanceDto - Update data
   * @returns Updated maintenance record
   */
  @Put(":id")
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ThrottleModerate()
  @ApiOperation({ summary: "Update a maintenance record" })
  @ApiResponse({
    status: 200,
    description: "Maintenance record updated successfully",
    type: Object, // Would be MaintenanceRecord type in real implementation
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 404, description: "Maintenance record not found" })
  @ApiParam({ name: "id", description: "Maintenance record ID" })
  async update(
    @Param("id") id: string,
    @Body(ValidationPipe) updateMaintenanceDto: UpdateMaintenanceDto
  ): Promise<MaintenanceRecord> {
    return await this.maintenanceService.update(id, updateMaintenanceDto);
  }

  /**
   * Complete maintenance and update van status
   * @param id - Maintenance record ID
   * @param completionData - Completion data
   * @returns Updated maintenance record
   */
  @Put(":id/complete")
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ThrottleModerate()
  @ApiOperation({ summary: "Complete maintenance and update van status" })
  @ApiResponse({
    status: 200,
    description: "Maintenance completed successfully",
    type: Object, // Would be MaintenanceRecord type in real implementation
  })
  @ApiResponse({ status: 404, description: "Maintenance record not found" })
  @ApiParam({ name: "id", description: "Maintenance record ID" })
  async completeMaintenance(
    @Param("id") id: string,
    @Body()
    completionData: {
      actualCost?: string;
      laborHours?: string;
      invoiceNumber?: string;
      notes?: string;
      partsUsed?: any[];
    }
  ): Promise<MaintenanceRecord> {
    return await this.maintenanceService.completeMaintenance(
      id,
      completionData
    );
  }

  /**
   * Delete a maintenance record
   * @param id - Maintenance record ID
   * @returns Deleted maintenance record
   */
  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.OWNER, Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Delete a maintenance record" })
  @ApiResponse({
    status: 200,
    description: "Maintenance record deleted successfully",
    type: Object, // Would be MaintenanceRecord type in real implementation
  })
  @ApiResponse({ status: 404, description: "Maintenance record not found" })
  @ApiParam({ name: "id", description: "Maintenance record ID" })
  async remove(@Param("id") id: string): Promise<MaintenanceRecord> {
    return await this.maintenanceService.remove(id);
  }
}
