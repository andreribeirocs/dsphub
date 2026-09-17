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
} from "@nestjs/common";
import { DriversService } from "./drivers.service";
import { UpdateDriverDto } from "./dto/update-driver.dto";
import { Roles } from "src/auth/decorators/roles.decorator";
import { ForbiddenException } from "@nestjs/common";
import { BetterAuthGuard } from "src/auth/guards/better-auth.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";

@ApiTags("drivers")
@Controller("drivers")
@UseGuards(BetterAuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  /**
   * Get all drivers with optional filtering
   * @param status - Optional status filter
   * @param depot - Optional depot filter
   * @param search - Optional search term
   * @param expiringOnly - Filter for drivers with expiring documents
   * @returns Array of drivers
   */
  @Get()
  @ApiOperation({ summary: "Get all drivers with filtering options" })
  @ApiResponse({ status: 200, description: "Array of drivers" })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filter by driver status",
  })
  @ApiQuery({ name: "depot", required: false, description: "Filter by depot" })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search by name, email, or phone",
  })
  @ApiQuery({
    name: "expiringOnly",
    required: false,
    description: "Show only drivers with expiring documents",
    type: "boolean",
  })
  async findAll(
    @Query("status") status?: string,
    @Query("depot") depot?: string,
    @Query("depotId") depotId?: string,
    @Query("search") search?: string,
    @Query("expiringOnly") expiringOnly?: string
  ): Promise<any[]> {
    const filters = {
      status,
      depot,
      depotId,
      search,
      expiringOnly: expiringOnly === "true",
    };

    // Remove undefined values
    Object.keys(filters).forEach(
      (key) =>
        filters[key as keyof typeof filters] === undefined &&
        delete filters[key as keyof typeof filters]
    );

    return this.driversService.findAll(
      Object.keys(filters).length > 0 ? filters : undefined
    );
  }

  /**
   * Get drivers by depot
   * @param depot - Depot name
   * @returns Array of drivers in the depot
   */
  @Get("depot/:depot")
  @ApiOperation({ summary: "Get drivers by depot" })
  @ApiResponse({
    status: 200,
    description: "Array of drivers in the specified depot",
  })
  async findByDepot(@Param("depot") depot: string): Promise<any[]> {
    return this.driversService.findByDepot(depot);
  }

  /**
   * Get drivers by status
   * @param status - Driver status
   * @returns Array of drivers with the specified status
   */
  @Get("status/:status")
  @ApiOperation({ summary: "Get drivers by status" })
  @ApiResponse({
    status: 200,
    description: "Array of drivers with the specified status",
  })
  async findByStatus(@Param("status") status: string): Promise<any[]> {
    return this.driversService.findByStatus(status);
  }

  /**
   * Get drivers with expiring documents
   * @param days - Days ahead to check for expiry (default: 30)
   * @returns Array of drivers with expiring documents
   */
  @Get("expiring")
  @ApiOperation({ summary: "Get drivers with expiring documents" })
  @ApiResponse({
    status: 200,
    description: "Array of drivers with expiring documents",
  })
  @ApiQuery({
    name: "days",
    required: false,
    description: "Days ahead to check for expiry",
    type: "number",
  })
  async findExpiring(@Query("days") days?: string): Promise<any[]> {
    const daysNumber = days ? parseInt(days, 10) : undefined;
    return this.driversService.findExpiringDocuments(daysNumber);
  }

  /**
   * Get driver statistics
   * @returns Driver statistics object
   */
  @Get("stats")
  @ApiOperation({ summary: "Get driver statistics" })
  @ApiResponse({ status: 200, description: "Driver statistics" })
  async getStats(): Promise<any> {
    return this.driversService.getStats();
  }

  /**
   * Get a single driver by ID
   * @param id - Driver ID
   * @returns Driver object
   */
  @Get(":id")
  @ApiOperation({ summary: "Get driver by ID" })
  @ApiResponse({ status: 200, description: "Driver object" })
  @ApiResponse({ status: 404, description: "Driver not found" })
  async findOne(@Param("id") id: string): Promise<any> {
    return this.driversService.findOne(id);
  }

  /**
   * Create a new driver
   * @param data - Driver creation data
   * @returns Created driver object
   */
  @Post()
  @ApiOperation({ summary: "Create a new driver" })
  @ApiResponse({ status: 201, description: "Driver created successfully" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  create(): never {
    // Decision (16/09/2026): every driver enters through the recruitment pipeline
    throw new ForbiddenException(
      "Drivers are created from the recruitment pipeline (candidate → active driver)"
    );
  }

  /**
   * Update an existing driver
   * @param id - Driver ID
   * @param data - Driver update data
   * @returns Updated driver object
   */
  @Put(":id")
  @ApiOperation({ summary: "Update driver" })
  @ApiResponse({ status: 200, description: "Driver updated successfully" })
  @ApiResponse({ status: 404, description: "Driver not found" })
  async update(
    @Param("id") id: string,
    @Body() data: UpdateDriverDto
  ): Promise<any> {
    return this.driversService.update(id, data);
  }

  /**
   * Delete a driver
   * @param id - Driver ID
   * @returns Deleted driver object
   */
  @Delete(":id")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_ONSITE", "MANAGER_RECRUITMENT")
  @ApiOperation({ summary: "Delete driver" })
  @ApiResponse({ status: 200, description: "Driver deleted successfully" })
  @ApiResponse({ status: 404, description: "Driver not found" })
  async delete(@Param("id") id: string): Promise<any> {
    return this.driversService.delete(id);
  }
}
