import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  UseGuards,
} from "@nestjs/common";
import { SecureErrorUtil } from "../shared/utils/secure-error.util";
import { FileInterceptor } from "@nestjs/platform-express";
import { PdfService } from "./pdf.service";
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from "@nestjs/swagger";
import { BetterAuthGuard } from "../auth/guards/better-auth.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";
import {
  FileUploadGuard,
  FileUploadOptions,
} from "src/shared/guards/file-upload.guard";
import { PDF_UPLOAD_CONFIG } from "src/shared/config/multer.config";

@ApiTags("PDF")
@UseGuards(BetterAuthGuard, RolesGuard)
@Controller("pdf")
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post("upload")
  @ApiOperation({ summary: "Upload and extract data from PDF" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: "PDF processed successfully" })
  @ApiResponse({ status: 400, description: "Invalid file or processing error" })
  @ApiResponse({ status: 413, description: "File too large" })
  @ApiResponse({ status: 415, description: "Unsupported file type" })
  @UseGuards(FileUploadGuard)
  @FileUploadOptions({
    maxSize: 25165824, // 24MB
    allowedMimeTypes: ["application/pdf"],
    allowedExtensions: [".pdf"],
    requireFileSignature: true,
  })
  @UseInterceptors(FileInterceptor("file", PDF_UPLOAD_CONFIG))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    // File validation is handled by FileUploadGuard
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const extractedData = await this.pdfService.extractTextFromPdf(
        file.buffer
      );
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const analysis = await this.pdfService.analyzePdfContent(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        extractedData.text
      );

      return {
        success: true,
        filename: file.originalname,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        extractedData,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        analysis,
      };
    } catch (error) {
      throw SecureErrorUtil.handleFileProcessingError(error, "PDF processing");
    }
  }

  @Post("debug")
  @ApiOperation({ summary: "Upload PDF and get raw text for debugging" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @ApiResponse({ status: 413, description: "File too large" })
  @ApiResponse({ status: 415, description: "Unsupported file type" })
  @UseGuards(FileUploadGuard)
  @FileUploadOptions({
    maxSize: 25165824, // 24MB
    allowedMimeTypes: ["application/pdf"],
    allowedExtensions: [".pdf"],
    requireFileSignature: true,
  })
  @UseInterceptors(FileInterceptor("file", PDF_UPLOAD_CONFIG))
  async debugPdf(@UploadedFile() file: Express.Multer.File) {
    // File validation is handled by FileUploadGuard
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const extractedData = await this.pdfService.extractTextFromPdf(
        file.buffer
      );

      // Split text into lines for easier debugging
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const lines =
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        extractedData.text
          .split("\n")
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          .map((line: unknown, index: number) => ({
            lineNumber: index + 1,
            content:
              typeof line === "string" ? line.trim() : String(line).trim(),
            length:
              typeof line === "string"
                ? line.trim().length
                : String(line).trim().length,
          }))
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          .filter((line: { length: number }) => line.length > 0);

      return {
        success: true,
        filename: file.originalname,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        rawText: extractedData.text,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        lines: lines,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        totalLines: lines.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        textLength: extractedData.text.length,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        metadata: extractedData.metadata,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        info: extractedData.info,
      };
    } catch (error) {
      throw SecureErrorUtil.handleFileProcessingError(
        error,
        "PDF debug processing"
      );
    }
  }

  @Get("health")
  @ApiOperation({ summary: "Check PDF service health" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  getHealth() {
    return {
      status: "healthy",
      service: "PDF Processing Service",
      timestamp: new Date().toISOString(),
    };
  }
}
