import { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { BadRequestException } from "@nestjs/common";
import * as multer from "multer";

export const createMulterConfig = (options?: {
  maxFileSize?: number;
  allowedMimeTypes?: string[];
}): MulterOptions => {
  const maxFileSize =
    options?.maxFileSize ||
    parseInt(process.env.MAX_FILE_SIZE || "10485760", 10); // 10MB
  const allowedMimeTypes = options?.allowedMimeTypes || ["application/pdf"];

  return {
    storage: multer.memoryStorage(), // Store in memory for processing
    limits: {
      fileSize: maxFileSize,
      files: 1, // Only allow one file at a time
      fields: 10, // Limit number of fields
      fieldNameSize: 100, // Limit field name size
      fieldSize: 1024, // Limit field value size (1KB)
      headerPairs: 20, // Limit number of header pairs
    },
    fileFilter: (req, file, callback) => {
      // Basic MIME type check (will be enhanced by FileUploadGuard)
      if (!allowedMimeTypes.includes(file.mimetype)) {
        const error = new BadRequestException(
          `File type not allowed. Supported types: ${allowedMimeTypes.join(", ")}`
        );
        return callback(error, false);
      }

      // Check for suspicious file names at multer level
      const fileName = file.originalname;
      const suspiciousPatterns = [
        /\.(exe|bat|cmd|com|pif|scr|vbs|js)$/i,
        /\.\./,
        /[<>:"|?*\x00-\x1f]/,
      ];

      if (suspiciousPatterns.some((pattern) => pattern.test(fileName))) {
        const error = new BadRequestException("File name not allowed");
        return callback(error, false);
      }

      callback(null, true);
    },
  };
};

// Pre-configured options for different use cases
export const PDF_UPLOAD_CONFIG = createMulterConfig({
  maxFileSize: parseInt(process.env.MAX_PDF_SIZE || "25165824", 10), // 24MB for PDFs
  allowedMimeTypes: ["application/pdf"],
});

export const IMAGE_UPLOAD_CONFIG = createMulterConfig({
  maxFileSize: parseInt(process.env.MAX_IMAGE_SIZE || "5242880", 10), // 5MB for images
  allowedMimeTypes: ["image/jpeg", "image/png", "image/gif"],
});

export const DOCUMENT_UPLOAD_CONFIG = createMulterConfig({
  maxFileSize: parseInt(process.env.MAX_DOCUMENT_SIZE || "10485760", 10), // 10MB for docs
  allowedMimeTypes: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
});
