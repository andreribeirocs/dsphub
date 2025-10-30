import { IsEmail, IsString, IsOptional, IsArray } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SendEmailDto {
  @ApiProperty({ description: "Recipient email address" })
  @IsEmail()
  readonly to: string;

  @ApiProperty({ description: "Email subject" })
  @IsString()
  readonly subject: string;

  @ApiProperty({ description: "Email HTML body" })
  @IsString()
  readonly html: string;

  @ApiPropertyOptional({ description: "Email plain text body" })
  @IsOptional()
  @IsString()
  readonly text?: string;

  @ApiPropertyOptional({ description: "Array of attachments" })
  @IsOptional()
  @IsArray()
  readonly attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  readonly filename: string;
  readonly content: Buffer | string;
  readonly contentType?: string;
}

export class BulkEmailDto {
  @ApiProperty({ description: "Array of recipient emails" })
  @IsArray()
  readonly recipients: string[];

  @ApiProperty({ description: "Email subject" })
  @IsString()
  readonly subject: string;

  @ApiProperty({ description: "Email HTML body" })
  @IsString()
  readonly html: string;

  @ApiPropertyOptional({ description: "Email plain text body" })
  @IsOptional()
  @IsString()
  readonly text?: string;

  @ApiPropertyOptional({ description: "Array of attachments" })
  @IsOptional()
  @IsArray()
  readonly attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  readonly success: boolean;
  readonly messageId?: string;
  readonly error?: string;
}

export interface BulkEmailResult {
  readonly total: number;
  readonly successful: number;
  readonly failed: number;
  readonly results: Array<{
    readonly email: string;
    readonly success: boolean;
    readonly error?: string;
  }>;
}
