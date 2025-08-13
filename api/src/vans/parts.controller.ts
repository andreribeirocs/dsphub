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
import { PartsService, PartsStats, PartPrice } from "./parts.service";
import { CreatePartDto, UpdatePartDto, GetPartsDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../auth/enums/role.enum";
import { ThrottleModerate } from "../auth/decorators/throttle.decorator";
import { Part } from "@prisma/client";

@ApiTags("parts")
@Controller("parts")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PartsController {
  constructor(private readonly partsService: PartsService) {}

  /**
   * Create a new part
   * @param createPartDto - Part creation data
   * @returns Created part
   */
  @Post()
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Create a new part" })
  @ApiResponse({
    status: 201,
    description: "Part created successfully",
    type: Object, // Would be Part type in real implementation
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  async create(
    @Body(ValidationPipe) createPartDto: CreatePartDto
  ): Promise<Part> {
    return await this.partsService.create(createPartDto);
  }

  /**
   * Get all parts with optional filtering
   * @param query - Filter parameters
   * @returns Array of parts
   */
  @Get()
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_ONSITE)
  @ApiOperation({ summary: "Get all parts with filtering options" })
  @ApiResponse({
    status: 200,
    description: "Array of parts",
    type: [Object], // Would be Part[] type in real implementation
  })
  @ApiQuery({
    name: "category",
    required: false,
    description: "Filter by category",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search by part name or description",
  })
  @ApiQuery({
    name: "supplier",
    required: false,
    description: "Filter by supplier",
  })
  @ApiQuery({
    name: "activeOnly",
    required: false,
    type: "boolean",
    description: "Show only active parts",
  })
  @ApiQuery({
    name: "lowStockOnly",
    required: false,
    type: "boolean",
    description: "Show only parts with low stock",
  })
  @ApiQuery({
    name: "vehicleMake",
    required: false,
    description: "Filter by vehicle make compatibility",
  })
  async findAll(@Query(ValidationPipe) query: GetPartsDto): Promise<Part[]> {
    return await this.partsService.findAll(query);
  }

  /**
   * Get parts dashboard statistics
   * @returns Parts statistics
   */
  @Get("stats")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_FINANCIAL)
  @ApiOperation({ summary: "Get parts dashboard statistics" })
  @ApiResponse({
    status: 200,
    description: "Parts statistics",
    schema: {
      type: "object",
      properties: {
        total: { type: "number", description: "Total number of parts" },
        active: { type: "number", description: "Number of active parts" },
        lowStock: {
          type: "number",
          description: "Number of parts with low stock",
        },
        categories: { type: "number", description: "Number of categories" },
        totalValue: { type: "number", description: "Total inventory value" },
      },
    },
  })
  async getStats(): Promise<PartsStats> {
    return await this.partsService.getStats();
  }

  /**
   * Get parts with low stock
   * @returns Array of parts with low stock
   */
  @Get("low-stock")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_ONSITE)
  @ApiOperation({ summary: "Get parts with low stock" })
  @ApiResponse({
    status: 200,
    description: "Parts with low stock",
    type: [Object], // Would be Part[] type in real implementation
  })
  async getLowStockParts(): Promise<Part[]> {
    return await this.partsService.getLowStockParts();
  }

  /**
   * Get all unique categories
   * @returns Array of category names
   */
  @Get("categories")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_ONSITE)
  @ApiOperation({ summary: "Get all unique categories" })
  @ApiResponse({
    status: 200,
    description: "Array of category names",
    type: [String],
  })
  async getCategories(): Promise<string[]> {
    return await this.partsService.getCategories();
  }

  /**
   * Get pricing for all parts by vehicle make
   * @param vehicleMake - Vehicle make (ford, mercedes, peugeot)
   * @returns Array of part prices
   */
  @Get("pricing/:vehicleMake")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_FINANCIAL)
  @ApiOperation({ summary: "Get pricing for all parts by vehicle make" })
  @ApiResponse({
    status: 200,
    description: "Array of part prices",
    type: [Object],
  })
  @ApiResponse({ status: 400, description: "Invalid vehicle make" })
  @ApiParam({
    name: "vehicleMake",
    description: "Vehicle make (ford, mercedes, peugeot)",
    enum: ["ford", "mercedes", "peugeot"],
  })
  async getPricingByVehicle(
    @Param("vehicleMake") vehicleMake: string
  ): Promise<PartPrice[]> {
    return await this.partsService.getPricingByVehicle(vehicleMake);
  }

  /**
   * Get parts by category
   * @param category - Part category
   * @returns Array of parts in category
   */
  @Get("category/:category")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_ONSITE)
  @ApiOperation({ summary: "Get parts by category" })
  @ApiResponse({
    status: 200,
    description: "Array of parts in category",
    type: [Object], // Would be Part[] type in real implementation
  })
  @ApiParam({ name: "category", description: "Part category" })
  async findByCategory(@Param("category") category: string): Promise<Part[]> {
    return await this.partsService.findByCategory(category);
  }

  /**
   * Get a specific part by ID
   * @param id - Part ID
   * @returns Part
   */
  @Get(":id")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_ONSITE)
  @ApiOperation({ summary: "Get a part by ID" })
  @ApiResponse({
    status: 200,
    description: "Part details",
    type: Object, // Would be Part type in real implementation
  })
  @ApiResponse({ status: 404, description: "Part not found" })
  @ApiParam({ name: "id", description: "Part ID" })
  async findOne(@Param("id") id: string): Promise<Part> {
    return await this.partsService.findOne(id);
  }

  /**
   * Update a part
   * @param id - Part ID
   * @param updatePartDto - Update data
   * @returns Updated part
   */
  @Put(":id")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Update a part" })
  @ApiResponse({
    status: 200,
    description: "Part updated successfully",
    type: Object, // Would be Part type in real implementation
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 404, description: "Part not found" })
  @ApiParam({ name: "id", description: "Part ID" })
  async update(
    @Param("id") id: string,
    @Body(ValidationPipe) updatePartDto: UpdatePartDto
  ): Promise<Part> {
    return await this.partsService.update(id, updatePartDto);
  }

  /**
   * Update stock level for a part
   * @param id - Part ID
   * @param stockData - Stock update data
   * @returns Updated part
   */
  @Put(":id/stock")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_ONSITE)
  @ThrottleModerate()
  @ApiOperation({ summary: "Update stock level for a part" })
  @ApiResponse({
    status: 200,
    description: "Stock updated successfully",
    type: Object, // Would be Part type in real implementation
  })
  @ApiResponse({ status: 404, description: "Part not found" })
  @ApiParam({ name: "id", description: "Part ID" })
  async updateStock(
    @Param("id") id: string,
    @Body() stockData: { quantity: number }
  ): Promise<Part> {
    return await this.partsService.updateStock(id, stockData.quantity);
  }

  /**
   * Bulk update prices for a vehicle make
   * @param vehicleMake - Vehicle make
   * @param priceUpdates - Array of price updates
   * @returns Number of parts updated
   */
  @Put("pricing/:vehicleMake/bulk")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Bulk update prices for a vehicle make" })
  @ApiResponse({
    status: 200,
    description: "Prices updated successfully",
    schema: {
      type: "object",
      properties: {
        updated: { type: "number", description: "Number of parts updated" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid vehicle make or price data",
  })
  @ApiParam({
    name: "vehicleMake",
    description: "Vehicle make (ford, mercedes, peugeot)",
    enum: ["ford", "mercedes", "peugeot"],
  })
  async bulkUpdatePrices(
    @Param("vehicleMake") vehicleMake: string,
    @Body() priceUpdates: Array<{ partId: string; price: number }>
  ) {
    const updated = await this.partsService.bulkUpdatePrices(
      vehicleMake,
      priceUpdates
    );
    return { updated };
  }

  /**
   * Delete a part
   * @param id - Part ID
   * @returns Deleted part
   */
  @Delete(":id")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Delete a part" })
  @ApiResponse({
    status: 200,
    description: "Part deleted successfully",
    type: Object, // Would be Part type in real implementation
  })
  @ApiResponse({ status: 404, description: "Part not found" })
  @ApiParam({ name: "id", description: "Part ID" })
  async remove(@Param("id") id: string): Promise<Part> {
    return await this.partsService.remove(id);
  }
}
