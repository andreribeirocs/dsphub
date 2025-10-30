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
import { VansService, VanStats } from "./vans.service";
import { CreateVanDto, UpdateVanDto, GetVansDto } from "./dto";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../auth/enums/role.enum";
import { ThrottleModerate } from "../auth/decorators/throttle.decorator";
import { Van } from "@prisma/client";

@ApiTags("vans")
@Controller("vans")
@UseGuards(BetterAuthGuard, RolesGuard)
@ApiBearerAuth()
export class VansController {
  constructor(private readonly vansService: VansService) {}

  /**
   * Create a new van
   * @param createVanDto - Van creation data
   * @returns Created van
   */
  @Post()
  @Roles(Role.SUPER_ADMIN, Role.OWNER, Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Create a new van" })
  @ApiResponse({
    status: 201,
    description: "Van created successfully",
    type: Object, // Would be Van type in real implementation
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({
    status: 409,
    description: "Van number or registration already exists",
  })
  async create(@Body(ValidationPipe) createVanDto: CreateVanDto): Promise<Van> {
    return await this.vansService.create(createVanDto);
  }

  /**
   * Get all vans with optional filtering
   * @param query - Filter parameters
   * @returns Array of vans
   */
  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ApiOperation({ summary: "Get all vans with filtering options" })
  @ApiResponse({
    status: 200,
    description: "Array of vans with related data",
    type: [Object], // Would be Van[] type in real implementation
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filter by van status",
  })
  @ApiQuery({
    name: "condition",
    required: false,
    description: "Filter by van condition",
  })
  @ApiQuery({ name: "depot", required: false, description: "Filter by depot" })
  @ApiQuery({
    name: "contract",
    required: false,
    description: "Filter by contract name",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search by van number, registration, or make/model",
  })
  @ApiQuery({
    name: "expiringMot",
    required: false,
    type: "boolean",
    description: "Show only vans with expiring MOT",
  })
  @ApiQuery({
    name: "maintenanceAlerts",
    required: false,
    type: "boolean",
    description: "Show only vans requiring maintenance attention",
  })
  @ApiQuery({
    name: "make",
    required: false,
    description: "Filter by vehicle make",
  })
  async findAll(@Query(ValidationPipe) query: GetVansDto): Promise<Van[]> {
    return await this.vansService.findAll(query);
  }

  /**
   * Get van dashboard statistics
   * @returns Van statistics
   */
  @Get("stats")
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ApiOperation({ summary: "Get van dashboard statistics" })
  @ApiResponse({
    status: 200,
    description: "Van statistics",
    schema: {
      type: "object",
      properties: {
        total: { type: "number", description: "Total number of vans" },
        active: { type: "number", description: "Number of active vans" },
        booked: { type: "number", description: "Number of booked vans" },
        maintenance: {
          type: "number",
          description: "Number of vans in maintenance",
        },
        expiringMot: {
          type: "number",
          description: "Number of vans with expiring MOT",
        },
        alerts: { type: "number", description: "Total number of alerts" },
        totalRental: {
          type: "number",
          description: "Total monthly rental amount",
        },
      },
    },
  })
  async getStats(): Promise<VanStats> {
    return await this.vansService.getStats();
  }

  /**
   * Get vans with expiring MOT
   * @param days - Warning days (default 30)
   * @returns Vans with expiring MOT
   */
  @Get("expiring-mot")
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ApiOperation({ summary: "Get vans with expiring MOT" })
  @ApiResponse({
    status: 200,
    description: "Vans with expiring MOT",
    type: [Object], // Would be Van[] type in real implementation
  })
  @ApiQuery({
    name: "days",
    required: false,
    type: "number",
    description: "Warning days (default 30)",
  })
  async getExpiringMot(@Query("days") days?: string): Promise<Van[]> {
    const warningDays = days ? parseInt(days, 10) : undefined;
    return await this.vansService.getExpiringMot(warningDays);
  }

  /**
   * Get a specific van by ID
   * @param id - Van ID
   * @returns Van with related data
   */
  @Get(":id")
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ApiOperation({ summary: "Get a van by ID" })
  @ApiResponse({
    status: 200,
    description: "Van with related data",
    type: Object, // Would be Van type in real implementation
  })
  @ApiResponse({ status: 404, description: "Van not found" })
  @ApiParam({ name: "id", description: "Van ID" })
  async findOne(@Param("id") id: string): Promise<Van> {
    return await this.vansService.findOne(id);
  }

  /**
   * Get a specific van by van number
   * @param vanNumber - Van number (e.g., "03")
   * @returns Van with related data
   */
  @Get("number/:vanNumber")
  @Roles(
    Role.SUPER_ADMIN,
    Role.OWNER,
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ApiOperation({ summary: "Get a van by van number" })
  @ApiResponse({
    status: 200,
    description: "Van with related data",
    type: Object, // Would be Van type in real implementation
  })
  @ApiResponse({ status: 404, description: "Van not found" })
  @ApiParam({ name: "vanNumber", description: "Van number (e.g., '03')" })
  async findByVanNumber(@Param("vanNumber") vanNumber: string): Promise<Van> {
    return await this.vansService.findByVanNumber(vanNumber);
  }

  /**
   * Update a van
   * @param id - Van ID
   * @param updateVanDto - Update data
   * @returns Updated van
   */
  @Put(":id")
  @Roles(Role.SUPER_ADMIN, Role.OWNER, Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Update a van" })
  @ApiResponse({
    status: 200,
    description: "Van updated successfully",
    type: Object, // Would be Van type in real implementation
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 404, description: "Van not found" })
  @ApiParam({ name: "id", description: "Van ID" })
  async update(
    @Param("id") id: string,
    @Body(ValidationPipe) updateVanDto: UpdateVanDto
  ): Promise<Van> {
    return await this.vansService.update(id, updateVanDto);
  }

  /**
   * Delete a van
   * @param id - Van ID
   * @returns Deleted van
   */
  @Delete(":id")
  @Roles(Role.SUPER_ADMIN, Role.OWNER, Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Delete a van" })
  @ApiResponse({
    status: 200,
    description: "Van deleted successfully",
    type: Object, // Would be Van type in real implementation
  })
  @ApiResponse({ status: 404, description: "Van not found" })
  @ApiParam({ name: "id", description: "Van ID" })
  async remove(@Param("id") id: string): Promise<Van> {
    return await this.vansService.remove(id);
  }
}
