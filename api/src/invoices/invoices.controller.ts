import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  StreamableFile,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { InvoicesService } from "./invoices.service";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import {
  GenerateWeeklyInvoicesDto,
  UpdateInvoiceDto,
  SendInvoicesDto,
  GetInvoicesDto,
} from "./dto";
import { createReadStream } from "fs";
import { join } from "path";

@ApiTags("invoices")
@ApiBearerAuth()
@UseGuards(BetterAuthGuard, RolesGuard)
@Controller("invoices")
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post("generate-weekly")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL")
  @ApiOperation({ summary: "Generate weekly invoices for all active drivers" })
  @ApiResponse({ status: 201, description: "Invoices generated successfully" })
  async generateWeeklyInvoices(
    @Body() dto: GenerateWeeklyInvoicesDto
  ): Promise<any> {
    return this.invoicesService.generateWeeklyInvoices(dto);
  }

  @Get()
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL")
  @ApiOperation({ summary: "Get all invoices with filtering and pagination" })
  @ApiResponse({ status: 200, description: "Invoices retrieved successfully" })
  async getInvoices(@Query() filters: GetInvoicesDto): Promise<any> {
    return this.invoicesService.getInvoices(filters);
  }

  @Get(":id")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL")
  @ApiOperation({ summary: "Get single invoice by ID" })
  @ApiResponse({ status: 200, description: "Invoice retrieved successfully" })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async getInvoice(@Param("id") id: string): Promise<any> {
    return this.invoicesService.getInvoice(id);
  }

  @Patch(":id")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL")
  @ApiOperation({ summary: "Update invoice" })
  @ApiResponse({ status: 200, description: "Invoice updated successfully" })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  @ApiResponse({
    status: 400,
    description: "Cannot update sent invoice",
  })
  async updateInvoice(
    @Param("id") id: string,
    @Body() dto: UpdateInvoiceDto
  ): Promise<any> {
    return this.invoicesService.updateInvoice(id, dto);
  }

  @Post(":id/approve")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL")
  @ApiOperation({ summary: "Approve invoice and generate PDF" })
  @ApiResponse({ status: 200, description: "Invoice approved successfully" })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async approveInvoice(@Param("id") id: string): Promise<any> {
    return this.invoicesService.approveInvoice(id);
  }

  @Post(":id/regenerate-pdf")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL")
  @ApiOperation({ summary: "Regenerate PDF for invoice" })
  @ApiResponse({
    status: 200,
    description: "PDF regenerated successfully",
  })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  async regeneratePdf(@Param("id") id: string): Promise<{ pdfUrl: string }> {
    const pdfUrl = await this.invoicesService.generatePdf(id);
    return { pdfUrl };
  }

  @Post("send-bulk")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send multiple invoices via email" })
  @ApiResponse({
    status: 200,
    description: "Bulk send completed",
  })
  async sendBulkInvoices(
    @Body() dto: SendInvoicesDto,
    @Request() req: any
  ): Promise<any> {
    const userId = req.user.sub;
    return this.invoicesService.sendInvoices(dto, userId);
  }

  @Get(":id/pdf")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL", "DRIVER")
  @ApiOperation({ summary: "Download invoice PDF" })
  @ApiResponse({
    status: 200,
    description: "PDF downloaded successfully",
  })
  @ApiResponse({ status: 404, description: "Invoice or PDF not found" })
  async downloadPdf(
    @Param("id") id: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<StreamableFile> {
    const invoice = await this.invoicesService.getInvoice(id);

    if (!invoice.pdfUrl) {
      // Generate PDF if it doesn't exist
      const pdfUrl = await this.invoicesService.generatePdf(id);
      invoice.pdfUrl = pdfUrl;
    }

    const pdfPath = join(process.cwd(), "uploads", invoice.pdfUrl);
    const file = createReadStream(pdfPath);

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    });

    return new StreamableFile(file);
  }

  @Delete("clear/all")
  @Roles("SUPER_ADMIN")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Clear all invoices (TEMPORARY - SUPER_ADMIN only)",
  })
  @ApiResponse({
    status: 200,
    description: "All invoices cleared successfully",
  })
  async clearAllInvoices(): Promise<any> {
    return this.invoicesService.clearAllInvoices();
  }

  @Delete(":id")
  @Roles("SUPER_ADMIN", "OWNER", "DIRECTOR", "MANAGER_FINANCIAL")
  @ApiOperation({ summary: "Cancel invoice" })
  @ApiResponse({ status: 200, description: "Invoice cancelled successfully" })
  @ApiResponse({ status: 404, description: "Invoice not found" })
  @ApiResponse({
    status: 400,
    description: "Cannot cancel sent invoice",
  })
  async cancelInvoice(@Param("id") id: string): Promise<any> {
    return this.invoicesService.cancelInvoice(id);
  }
}
