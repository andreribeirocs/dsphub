import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
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
import { PaymentsService } from "./payments.service";
import { UpdateRoutePriceDto } from "./dto/update-route-price.dto";
import { GetPaymentHistoryDto } from "./dto/get-payment-history.dto";
import {
  CreateDriverPaymentDto,
  UpdateDriverPaymentDto,
  GetDriverPaymentsDto,
} from "./dto/driver-payment.dto";
import {
  GetDailyPaymentsPrefillDto,
  SaveDailyPaymentsDto,
} from "./dto/daily-payment.dto";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../auth/enums/role.enum";
import { ThrottleModerate } from "../auth/decorators/throttle.decorator";
import {
  RoutePrice,
  PaymentHistoryItem,
  DashboardStats,
} from "./types/payment.types";

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@ApiTags("payments")
@Controller("payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Get dashboard overview with route prices and statistics
   */
  @ApiOperation({
    summary: "Get payment dashboard overview",
    description:
      "Get current route prices and dashboard statistics. Available to all authenticated users.",
  })
  @ApiResponse({
    status: 200,
    description: "Dashboard data retrieved successfully",
    schema: {
      type: "object",
      properties: {
        routePrices: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              routeType: {
                type: "string",
                enum: [
                  "FULL_ROUTE",
                  "HIDE_ALONG",
                  "TRAINING_DAY",
                  "SAME_DAY",
                  "NURSERY_ROUTE",
                  "EXTRAS",
                ],
              },
              dailyRate: { type: "number" },
              lastUpdated: { type: "string", format: "date-time" },
              updatedByUser: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                },
              },
            },
          },
        },
        stats: {
          type: "object",
          properties: {
            totalRoutes: { type: "number" },
            dailyRevenuePotential: { type: "number" },
            priceChanges: { type: "number" },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ThrottleModerate()
  @Get("dashboard")
  async getDashboard(): Promise<{
    routePrices: RoutePrice[];
    stats: DashboardStats;
  }> {
    const [routePrices, stats] = await Promise.all([
      this.paymentsService.getAllRoutePrices(),
      this.paymentsService.getDashboardStats(),
    ]);

    return {
      routePrices,
      stats,
    };
  }

  /**
   * Update route price (Financial managers and directors only)
   */
  @ApiOperation({
    summary: "Update route daily rate",
    description:
      "Update the daily rate for a specific route type. Only available to financial managers and directors.",
  })
  @ApiResponse({
    status: 200,
    description: "Route price updated successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        routeType: { type: "string" },
        dailyRate: { type: "number" },
        lastUpdated: { type: "string", format: "date-time" },
        updatedByUser: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string" },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid data or same rate",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Route price not found" })
  @UseGuards(RolesGuard)
  @Roles(Role.DIRECTOR, Role.MANAGER_FINANCIAL)
  @ThrottleModerate()
  @Put("route-prices")
  async updateRoutePrice(
    @Body(ValidationPipe) updateData: UpdateRoutePriceDto,
    @Request() req: AuthenticatedRequest
  ): Promise<RoutePrice> {
    return this.paymentsService.updateRoutePrice(updateData, req.user.id);
  }

  /**
   * Get payment history with filtering and pagination
   */
  @ApiOperation({
    summary: "Get payment history",
    description:
      "Get paginated payment history with optional filtering by route type and date range.",
  })
  @ApiQuery({
    name: "routeType",
    required: false,
    enum: [
      "FULL_ROUTE",
      "HIDE_ALONG",
      "TRAINING_DAY",
      "SAME_DAY",
      "NURSERY_ROUTE",
      "EXTRAS",
    ],
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description: "Start date (ISO string)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description: "End date (ISO string)",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 20)",
  })
  @ApiResponse({
    status: 200,
    description: "Payment history retrieved successfully",
    schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              routeType: { type: "string" },
              oldRate: { type: "number", nullable: true },
              newRate: { type: "number" },
              changeReason: { type: "string", nullable: true },
              changeDate: { type: "string", format: "date-time" },
              changedByUser: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                },
              },
            },
          },
        },
        total: { type: "number" },
        page: { type: "number" },
        limit: { type: "number" },
        totalPages: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ThrottleModerate()
  @Get("history")
  async getPaymentHistory(
    @Query(ValidationPipe) filters: GetPaymentHistoryDto
  ): Promise<{
    readonly items: PaymentHistoryItem[];
    readonly total: number;
    readonly page: number;
    readonly limit: number;
    readonly totalPages: number;
  }> {
    return this.paymentsService.getPaymentHistory(filters);
  }

  /**
   * Prefill daily payments for a given date from schedules
   */
  @ApiOperation({
    summary: "Prefill daily payments",
    description:
      "Get a list of drivers scheduled to work on the given date with suggested rates based on route prices.",
  })
  @ApiResponse({ status: 200, description: "Prefill generated" })
  @ThrottleModerate()
  @Get("daily")
  async prefillDailyPayments(
    @Query(ValidationPipe) query: GetDailyPaymentsPrefillDto
  ): Promise<any[]> {
    return this.paymentsService.prefillDailyPayments(query);
  }

  /**
   * Save daily payments in bulk for a given date
   */
  @ApiOperation({
    summary: "Save daily payments (bulk)",
    description:
      "Create or update daily payment records for the provided driver list on the given date.",
  })
  @ApiResponse({ status: 200, description: "Daily payments saved" })
  @UseGuards(RolesGuard)
  @Roles(
    Role.DIRECTOR,
    Role.MANAGER_FINANCIAL,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ThrottleModerate()
  @Post("daily")
  async saveDailyPayments(
    @Body(ValidationPipe) body: SaveDailyPaymentsDto,
    @Request() req: AuthenticatedRequest
  ): Promise<{ created: number; updated: number }> {
    return this.paymentsService.saveDailyPayments(body, req.user.id);
  }

  /**
   * Create driver payment record
   */
  @ApiOperation({
    summary: "Create driver payment record",
    description:
      "Create a payment record for a driver's work on a specific date. Only available to managers and directors.",
  })
  @ApiResponse({
    status: 201,
    description: "Driver payment created successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        driverId: { type: "string" },
        driver: {
          type: "object",
          properties: {
            name: { type: "string" },
            transporterId: { type: "string" },
          },
        },
        workDate: { type: "string", format: "date" },
        routeType: { type: "string" },
        dailyRate: { type: "number" },
        hoursWorked: { type: "number", nullable: true },
        totalPaid: { type: "number" },
        isPaid: { type: "boolean" },
        notes: { type: "string", nullable: true },
        createdAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - Invalid data or duplicate record",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Driver not found" })
  @UseGuards(RolesGuard)
  @Roles(
    Role.DIRECTOR,
    Role.MANAGER_FINANCIAL,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ThrottleModerate()
  @Post("driver-payments")
  @HttpCode(HttpStatus.CREATED)
  async createDriverPayment(
    @Body(ValidationPipe) paymentData: CreateDriverPaymentDto,
    @Request() req: AuthenticatedRequest
  ): Promise<any> {
    return this.paymentsService.createDriverPayment(paymentData, req.user.id);
  }

  /**
   * Get driver payments with filtering
   */
  @ApiOperation({
    summary: "Get driver payments",
    description: "Get driver payment records with optional filtering.",
  })
  @ApiQuery({
    name: "driverId",
    required: false,
    type: String,
    description: "Filter by driver ID",
  })
  @ApiQuery({
    name: "routeType",
    required: false,
    enum: [
      "FULL_ROUTE",
      "HIDE_ALONG",
      "TRAINING_DAY",
      "SAME_DAY",
      "NURSERY_ROUTE",
      "EXTRAS",
    ],
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description: "Start date (YYYY-MM-DD)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description: "End date (YYYY-MM-DD)",
  })
  @ApiQuery({
    name: "isPaid",
    required: false,
    type: Boolean,
    description: "Filter by payment status",
  })
  @ApiResponse({
    status: 200,
    description: "Driver payments retrieved successfully",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          driverId: { type: "string" },
          driver: {
            type: "object",
            properties: {
              name: { type: "string" },
              transporterId: { type: "string" },
              email: { type: "string" },
            },
          },
          workDate: { type: "string", format: "date" },
          routeType: { type: "string" },
          dailyRate: { type: "number" },
          hoursWorked: { type: "number", nullable: true },
          totalPaid: { type: "number" },
          isPaid: { type: "boolean" },
          paidDate: { type: "string", format: "date-time", nullable: true },
          paidByUser: {
            type: "object",
            nullable: true,
            properties: {
              name: { type: "string" },
              email: { type: "string" },
            },
          },
          notes: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ThrottleModerate()
  @Get("driver-payments")
  async getDriverPayments(
    @Query(ValidationPipe) filters: GetDriverPaymentsDto
  ): Promise<any[]> {
    return this.paymentsService.getDriverPayments(filters);
  }

  /**
   * Update driver payment status
   */
  @ApiOperation({
    summary: "Update driver payment status",
    description:
      "Update driver payment record (e.g., mark as paid). Only available to managers and directors.",
  })
  @ApiParam({ name: "id", description: "Payment record ID" })
  @ApiResponse({
    status: 200,
    description: "Driver payment updated successfully",
    schema: {
      type: "object",
      properties: {
        id: { type: "string" },
        driverId: { type: "string" },
        driver: {
          type: "object",
          properties: {
            name: { type: "string" },
            transporterId: { type: "string" },
          },
        },
        workDate: { type: "string", format: "date" },
        routeType: { type: "string" },
        dailyRate: { type: "number" },
        hoursWorked: { type: "number", nullable: true },
        totalPaid: { type: "number" },
        isPaid: { type: "boolean" },
        paidDate: { type: "string", format: "date-time", nullable: true },
        paidByUser: {
          type: "object",
          nullable: true,
          properties: {
            name: { type: "string" },
            email: { type: "string" },
          },
        },
        notes: { type: "string", nullable: true },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request - Invalid data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Insufficient permissions",
  })
  @ApiResponse({ status: 404, description: "Payment record not found" })
  @UseGuards(RolesGuard)
  @Roles(
    Role.DIRECTOR,
    Role.MANAGER_FINANCIAL,
    Role.MANAGER_FLEET,
    Role.MANAGER_ONSITE
  )
  @ThrottleModerate()
  @Put("driver-payments/:id")
  async updateDriverPayment(
    @Param("id") paymentId: string,
    @Body(ValidationPipe) updateData: UpdateDriverPaymentDto,
    @Request() req: AuthenticatedRequest
  ): Promise<any> {
    return this.paymentsService.updateDriverPayment(
      paymentId,
      updateData,
      req.user.id
    );
  }
}
