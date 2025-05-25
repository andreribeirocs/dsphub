import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    description: 'Recipient phone number (with country code)',
    example: '+447356237235',
  })
  @IsNotEmpty()
  @IsString()
  to: string;

  @ApiProperty({
    description: 'Message body text',
    example: 'Hello, this is a test message from the dispatch team.',
  })
  @IsNotEmpty()
  @IsString()
  body: string;
}

export class QuickMessageDto {
  @ApiProperty({
    description: 'Recipient phone number (with country code)',
    example: '+447356237235',
  })
  @IsNotEmpty()
  @IsString()
  to: string;

  @ApiProperty({
    description: 'Message template type',
    enum: ['greeting', 'availability', 'document_reminder', 'thank_you'],
    example: 'greeting',
  })
  @IsNotEmpty()
  @IsString()
  template: 'greeting' | 'availability' | 'document_reminder' | 'thank_you';
}

export class TwilioWebhookDto {
  @ApiProperty({ description: 'Twilio message SID' })
  @IsString()
  MessageSid: string;

  @ApiProperty({ description: 'From phone number' })
  @IsString()
  From: string;

  @ApiProperty({ description: 'To phone number' })
  @IsString()
  To: string;

  @ApiProperty({ description: 'Message body', required: false })
  @IsString()
  Body?: string;

  @ApiProperty({ description: 'Message status', required: false })
  @IsString()
  MessageStatus?: string;

  @ApiProperty({ description: 'Timestamp', required: false })
  @IsString()
  Timestamp?: string;

  @ApiProperty({ description: 'Twilio account SID' })
  @IsString()
  AccountSid: string;
}
