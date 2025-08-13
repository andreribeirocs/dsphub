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
import { ContractsService, ContractStats } from "./contracts.service";
import { CreateContractDto, UpdateContractDto, GetContractsDto } from "./dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../auth/enums/role.enum";
import { ThrottleModerate } from "../auth/decorators/throttle.decorator";
import { Contract } from "@prisma/client";

@ApiTags("contracts")
@Controller("contracts")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  /**
   * Create a new contract
   * @param createContractDto - Contract creation data
   * @returns Created contract
   */
  @Post()
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Create a new contract" })
  @ApiResponse({
    status: 201,
    description: "Contract created successfully",
    type: Object, // Would be Contract type in real implementation
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 409, description: "Contract name already exists" })
  async create(
    @Body(ValidationPipe) createContractDto: CreateContractDto
  ): Promise<Contract> {
    return await this.contractsService.create(createContractDto);
  }

  /**
   * Get all contracts with optional filtering
   * @param query - Filter parameters
   * @returns Array of contracts
   */
  @Get()
  @Roles(
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE,
    Role.MANAGER_FINANCIAL
  )
  @ApiOperation({ summary: "Get all contracts with filtering options" })
  @ApiResponse({
    status: 200,
    description: "Array of contracts with related data",
    type: [Object], // Would be Contract[] type in real implementation
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Filter by contract status",
  })
  @ApiQuery({ name: "depot", required: false, description: "Filter by depot" })
  @ApiQuery({
    name: "supplier",
    required: false,
    description: "Filter by supplier",
  })
  @ApiQuery({
    name: "search",
    required: false,
    description: "Search by contract name or hire name",
  })
  async findAll(
    @Query(ValidationPipe) query: GetContractsDto
  ): Promise<Contract[]> {
    return await this.contractsService.findAll(query);
  }

  /**
   * Get contract dashboard statistics
   * @returns Contract statistics
   */
  @Get("stats")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_FINANCIAL)
  @ApiOperation({ summary: "Get contract dashboard statistics" })
  @ApiResponse({
    status: 200,
    description: "Contract statistics",
    schema: {
      type: "object",
      properties: {
        total: { type: "number", description: "Total number of contracts" },
        active: { type: "number", description: "Number of active contracts" },
        expired: { type: "number", description: "Number of expired contracts" },
        broken: { type: "number", description: "Number of broken contracts" },
        totalRevenue: {
          type: "number",
          description: "Total revenue from active contracts",
        },
      },
    },
  })
  async getStats(): Promise<ContractStats> {
    return await this.contractsService.getStats();
  }

  /**
   * Get contracts expiring soon
   * @param days - Warning days (default 30)
   * @returns Contracts expiring soon
   */
  @Get("expiring")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET, Role.MANAGER_FINANCIAL)
  @ApiOperation({ summary: "Get contracts expiring soon" })
  @ApiResponse({
    status: 200,
    description: "Contracts expiring soon",
    type: [Object], // Would be Contract[] type in real implementation
  })
  @ApiQuery({
    name: "days",
    required: false,
    type: "number",
    description: "Warning days (default 30)",
  })
  async getExpiringSoon(@Query("days") days?: string): Promise<Contract[]> {
    const warningDays = days ? parseInt(days, 10) : undefined;
    return await this.contractsService.getExpiringSoon(warningDays);
  }

  /**
   * Get a specific contract by ID
   * @param id - Contract ID
   * @returns Contract with related data
   */
  @Get(":id")
  @Roles(
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE,
    Role.MANAGER_FINANCIAL
  )
  @ApiOperation({ summary: "Get a contract by ID" })
  @ApiResponse({
    status: 200,
    description: "Contract with related data",
    type: Object, // Would be Contract type in real implementation
  })
  @ApiResponse({ status: 404, description: "Contract not found" })
  @ApiParam({ name: "id", description: "Contract ID" })
  async findOne(@Param("id") id: string): Promise<Contract> {
    return await this.contractsService.findOne(id);
  }

  /**
   * Get a specific contract by name
   * @param name - Contract name
   * @returns Contract with related data
   */
  @Get("name/:name")
  @Roles(
    Role.DIRECTOR,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE,
    Role.MANAGER_FINANCIAL
  )
  @ApiOperation({ summary: "Get a contract by name" })
  @ApiResponse({
    status: 200,
    description: "Contract with related data",
    type: Object, // Would be Contract type in real implementation
  })
  @ApiResponse({ status: 404, description: "Contract not found" })
  @ApiParam({ name: "name", description: "Contract name" })
  async findByName(@Param("name") name: string): Promise<Contract> {
    return await this.contractsService.findByName(name);
  }

  /**
   * Update a contract
   * @param id - Contract ID
   * @param updateContractDto - Update data
   * @returns Updated contract
   */
  @Put(":id")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Update a contract" })
  @ApiResponse({
    status: 200,
    description: "Contract updated successfully",
    type: Object, // Would be Contract type in real implementation
  })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @ApiResponse({ status: 404, description: "Contract not found" })
  @ApiParam({ name: "id", description: "Contract ID" })
  async update(
    @Param("id") id: string,
    @Body(ValidationPipe) updateContractDto: UpdateContractDto
  ): Promise<Contract> {
    return await this.contractsService.update(id, updateContractDto);
  }

  /**
   * Delete a contract
   * @param id - Contract ID
   * @returns Deleted contract
   */
  @Delete(":id")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Delete a contract" })
  @ApiResponse({
    status: 200,
    description: "Contract deleted successfully",
    type: Object, // Would be Contract type in real implementation
  })
  @ApiResponse({ status: 404, description: "Contract not found" })
  @ApiParam({ name: "id", description: "Contract ID" })
  async remove(@Param("id") id: string): Promise<Contract> {
    return await this.contractsService.remove(id);
  }

  /**
   * Assign a van to a contract
   * @param contractId - Contract ID
   * @param vanId - Van ID
   * @returns Updated contract
   */
  @Put(":contractId/vans/:vanId")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Assign a van to a contract" })
  @ApiResponse({
    status: 200,
    description: "Van assigned to contract successfully",
    type: Object, // Would be Contract type in real implementation
  })
  @ApiResponse({ status: 404, description: "Contract or van not found" })
  @ApiParam({ name: "contractId", description: "Contract ID" })
  @ApiParam({ name: "vanId", description: "Van ID" })
  async assignVan(
    @Param("contractId") contractId: string,
    @Param("vanId") vanId: string
  ): Promise<Contract> {
    return await this.contractsService.assignVan(contractId, vanId);
  }

  /**
   * Remove a van from a contract
   * @param contractId - Contract ID
   * @param vanId - Van ID
   * @returns Updated contract
   */
  @Delete(":contractId/vans/:vanId")
  @Roles(Role.DIRECTOR, Role.MANAGER_FLEET)
  @ThrottleModerate()
  @ApiOperation({ summary: "Remove a van from a contract" })
  @ApiResponse({
    status: 200,
    description: "Van removed from contract successfully",
    type: Object, // Would be Contract type in real implementation
  })
  @ApiResponse({ status: 404, description: "Contract or van not found" })
  @ApiParam({ name: "contractId", description: "Contract ID" })
  @ApiParam({ name: "vanId", description: "Van ID" })
  async removeVan(
    @Param("contractId") contractId: string,
    @Param("vanId") vanId: string
  ): Promise<Contract> {
    return await this.contractsService.removeVan(contractId, vanId);
  }
}
