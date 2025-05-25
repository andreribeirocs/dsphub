import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Get,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PdfService } from './pdf.service';
import {
  ApiTags,
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiTags('PDF')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pdf')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload and extract data from PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'PDF processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or processing error' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('File must be a PDF');
    }

    try {
      const extractedData = await this.pdfService.extractTextFromPdf(
        file.buffer,
      );
      const analysis = await this.pdfService.analyzePdfContent(
        extractedData.text,
      );

      return {
        success: true,
        filename: file.originalname,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        extractedData,
        analysis,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to process PDF: ${error.message}`);
    }
  }

  @Post('debug')
  @ApiOperation({ summary: 'Upload PDF and get raw text for debugging' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async debugPdf(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('File must be a PDF');
    }

    try {
      const extractedData = await this.pdfService.extractTextFromPdf(
        file.buffer,
      );

      // Split text into lines for easier debugging
      const lines = extractedData.text
        .split('\n')
        .map((line, index) => ({
          lineNumber: index + 1,
          content: line.trim(),
          length: line.trim().length,
        }))
        .filter((line) => line.length > 0);

      return {
        success: true,
        filename: file.originalname,
        rawText: extractedData.text,
        lines: lines,
        totalLines: lines.length,
        textLength: extractedData.text.length,
        metadata: extractedData.metadata,
        info: extractedData.info,
      };
    } catch (error: any) {
      throw new BadRequestException(`Failed to process PDF: ${error.message}`);
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Check PDF service health' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  getHealth() {
    return {
      status: 'healthy',
      service: 'PDF Processing Service',
      timestamp: new Date().toISOString(),
    };
  }
}
