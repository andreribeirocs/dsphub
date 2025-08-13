import { IsString, IsNotEmpty, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import {
  TrimWhitespace,
  NormalizePhone,
  IsPhoneNumber,
  NoXSS,
  NoSqlInjection,
  SanitizeHtml,
} from "../../shared/validation/custom-validators";

export class SendMessageDto {
  @ApiProperty({
    description: "Recipient phone number (with country code)",
    example: "+447356237235",
  })
  @TrimWhitespace()
  @NormalizePhone()
  @IsPhoneNumber({
    message:
      "Please provide a valid international phone number (e.g., +447700900123)",
  })
  @IsNotEmpty({ message: "Phone number is required" })
  @Length(8, 20, {
    message: "Phone number must be between 8 and 20 characters",
  })
  @NoXSS()
  @NoSqlInjection()
  to: string;

  @ApiProperty({
    description: "Message body text",
    example: "Hello, this is a test message from the dispatch team.",
  })
  @TrimWhitespace()
  @SanitizeHtml()
  @IsString({ message: "Message body must be a string" })
  @IsNotEmpty({ message: "Message body is required" })
  @Length(1, 1600, {
    message: "Message body must be between 1 and 1600 characters",
  })
  @NoXSS()
  @NoSqlInjection()
  body: string;
}

export class QuickMessageDto {
  @ApiProperty({
    description: "Recipient phone number (with country code)",
    example: "+447356237235",
  })
  @IsNotEmpty()
  @IsString()
  to: string;

  @ApiProperty({
    description: "Message template type",
    enum: ["greeting", "availability", "document_reminder", "thank_you"],
    example: "greeting",
  })
  @IsNotEmpty()
  @IsString()
  template: "greeting" | "availability" | "document_reminder" | "thank_you";
}

export class TwilioWebhookDto {
  @ApiProperty({ description: "Twilio message SID" })
  @IsString()
  MessageSid: string;

  @ApiProperty({ description: "From phone number" })
  @IsString()
  From: string;

  @ApiProperty({ description: "To phone number" })
  @IsString()
  To: string;

  @ApiProperty({ description: "Message body", required: false })
  @IsString()
  Body?: string;

  @ApiProperty({ description: "Message status", required: false })
  @IsString()
  MessageStatus?: string;

  @ApiProperty({ description: "Timestamp", required: false })
  @IsString()
  Timestamp?: string;

  @ApiProperty({ description: "Twilio account SID" })
  @IsString()
  AccountSid: string;
}
