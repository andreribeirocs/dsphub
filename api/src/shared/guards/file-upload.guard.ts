import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import "reflect-metadata";
import * as crypto from "crypto";

interface FileUploadOptions {
  readonly maxSize?: number; // in bytes
  readonly allowedMimeTypes?: readonly string[];
  readonly allowedExtensions?: readonly string[];
  readonly requireFileSignature?: boolean;
}

// Known file signatures (magic numbers)
const FILE_SIGNATURES = {
  "application/pdf": ["25504446"], // %PDF
  "image/jpeg": ["FFD8FF"],
  "image/png": ["89504E47"],
  "text/plain": [], // Text files don't have reliable signatures
  "application/msword": ["D0CF11E0A1B11AE1"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    "504B0304", // ZIP-based format
  ],
} as const;

@Injectable()
export class FileUploadGuard implements CanActivate {
  private readonly logger = new Logger(FileUploadGuard.name);

  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const file = request.file as Express.Multer.File;

    if (!file) {
      throw new BadRequestException("No file provided");
    }

    const options = this.getFileUploadOptions(context);

    try {
      this.validateFileSize(file, options);
      this.validateMimeType(file, options);
      this.validateFileExtension(file, options);
      await this.validateFileSignature(file, options);
      this.validateFileName(file);

      this.logger.log(
        `File validation passed: ${file.originalname} (${file.size} bytes)`
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `File validation failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
      throw error;
    }
  }

  private getFileUploadOptions(context: ExecutionContext): FileUploadOptions {
    return (
      this.reflector.get<FileUploadOptions>(
        "fileUploadOptions",
        context.getHandler()
      ) || {
        maxSize: parseInt(process.env.MAX_FILE_SIZE || "10485760", 10), // 10MB default
        allowedMimeTypes: ["application/pdf"],
        allowedExtensions: [".pdf"],
        requireFileSignature: true,
      }
    );
  }

  private validateFileSize(
    file: Express.Multer.File,
    options: FileUploadOptions
  ): void {
    const maxSize = options.maxSize || 10485760; // 10MB default

    if (file.size > maxSize) {
      throw new PayloadTooLargeException(
        `File size exceeds limit of ${Math.round(maxSize / 1024 / 1024)}MB`
      );
    }

    if (file.size === 0) {
      throw new BadRequestException("File is empty");
    }
  }

  private validateMimeType(
    file: Express.Multer.File,
    options: FileUploadOptions
  ): void {
    const allowedMimeTypes = options.allowedMimeTypes || ["application/pdf"];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `File type not allowed. Supported types: ${allowedMimeTypes.join(", ")}`
      );
    }
  }

  private validateFileExtension(
    file: Express.Multer.File,
    options: FileUploadOptions
  ): void {
    const allowedExtensions = options.allowedExtensions || [".pdf"];
    const fileExtension = this.getFileExtension(file.originalname);

    if (
      !allowedExtensions.some(
        (ext) => ext.toLowerCase() === fileExtension.toLowerCase()
      )
    ) {
      throw new UnsupportedMediaTypeException(
        `File extension not allowed. Supported extensions: ${allowedExtensions.join(", ")}`
      );
    }
  }

  private async validateFileSignature(
    file: Express.Multer.File,
    options: FileUploadOptions
  ): Promise<void> {
    if (!options.requireFileSignature) {
      return;
    }

    const signatures =
      FILE_SIGNATURES[file.mimetype as keyof typeof FILE_SIGNATURES];

    if (!signatures || signatures.length === 0) {
      // For file types without reliable signatures, skip this check
      return;
    }

    const fileHeader = file.buffer.subarray(0, 8);
    const fileSignature = fileHeader.toString("hex").toUpperCase();

    const isValidSignature = signatures.some((signature) =>
      fileSignature.startsWith(signature.toUpperCase())
    );

    if (!isValidSignature) {
      throw new UnsupportedMediaTypeException(
        "File content does not match declared file type"
      );
    }
  }

  private validateFileName(file: Express.Multer.File): void {
    const fileName = file.originalname;

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(fileName)) {
      throw new BadRequestException("File name contains invalid characters");
    }

    // Check for suspicious file names
    const suspiciousPatterns = [
      /^\./, // Hidden files
      /\.(exe|bat|cmd|com|pif|scr|vbs|js)$/i, // Executable files
      /\.\./, // Path traversal
    ];

    if (suspiciousPatterns.some((pattern) => pattern.test(fileName))) {
      throw new BadRequestException("File name not allowed");
    }

    // Check file name length
    if (fileName.length > 255) {
      throw new BadRequestException("File name too long");
    }
  }

  private getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf(".");
    return lastDotIndex === -1 ? "" : fileName.substring(lastDotIndex);
  }
}

// Decorator for file upload options
export const FileUploadOptions = (options: FileUploadOptions) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata('fileUploadOptions', options, descriptor.value);
  };
};
