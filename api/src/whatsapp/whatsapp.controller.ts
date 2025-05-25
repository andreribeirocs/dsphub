import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WhatsAppService, TwilioWebhookPayload } from './whatsapp.service';
import { SendMessageDto, QuickMessageDto } from './dto/send-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiTags('whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send a WhatsApp message' })
  @ApiResponse({ status: 201, description: 'Message sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    try {
      if (!sendMessageDto.to || !sendMessageDto.body) {
        throw new BadRequestException(
          'Phone number and message body are required',
        );
      }

      const message = await this.whatsAppService.sendMessage(sendMessageDto);
      this.logger.log(`Message sent to ${sendMessageDto.to}`);

      return {
        success: true,
        message,
      };
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(errorMessage);
    }
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Twilio webhook for incoming messages and status updates',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleWebhook(@Body() payload: TwilioWebhookPayload) {
    try {
      this.logger.log(
        'Received Twilio webhook:',
        JSON.stringify(payload, null, 2),
      );

      // Handle different types of webhooks
      if (payload.MessageStatus) {
        // Status update webhook
        this.whatsAppService.handleStatusUpdate(payload);
      } else if (payload.Body) {
        // Incoming message webhook
        this.whatsAppService.handleIncomingMessage(payload);
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error processing webhook:', error);
      return { success: false, error: error.message };
    }
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Get all WhatsApp conversations' })
  @ApiResponse({
    status: 200,
    description: 'Conversations retrieved successfully',
  })
  getConversations() {
    try {
      const conversations = this.whatsAppService.getConversations();
      return {
        success: true,
        conversations,
      };
    } catch (error) {
      this.logger.error('Failed to get conversations:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Get('conversations/:phoneNumber')
  @ApiOperation({ summary: 'Get a specific conversation by phone number' })
  @ApiResponse({
    status: 200,
    description: 'Conversation retrieved successfully',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  getConversation(@Param('phoneNumber') phoneNumber: string) {
    try {
      const conversation = this.whatsAppService.getConversation(phoneNumber);

      if (!conversation) {
        throw new NotFoundException(
          `Conversation with ${phoneNumber} not found`,
        );
      }

      return {
        success: true,
        conversation,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get conversation for ${phoneNumber}:`,
        error,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('conversations/:phoneNumber/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  @ApiResponse({ status: 200, description: 'Conversation marked as read' })
  markAsRead(@Param('phoneNumber') phoneNumber: string) {
    try {
      this.whatsAppService.markConversationAsRead(phoneNumber);
      return {
        success: true,
        message: 'Conversation marked as read',
      };
    } catch (error) {
      this.logger.error(
        `Failed to mark conversation as read for ${phoneNumber}:`,
        error,
      );
      throw new BadRequestException(error.message);
    }
  }

  @Delete('conversations/:phoneNumber')
  @ApiOperation({ summary: 'Delete a conversation' })
  @ApiResponse({
    status: 200,
    description: 'Conversation deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Conversation not found' })
  deleteConversation(@Param('phoneNumber') phoneNumber: string) {
    try {
      const deleted = this.whatsAppService.deleteConversation(phoneNumber);

      if (!deleted) {
        throw new NotFoundException(
          `Conversation with ${phoneNumber} not found`,
        );
      }

      return {
        success: true,
        message: 'Conversation deleted successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to delete conversation for ${phoneNumber}:`,
        error,
      );
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post('quick-message')
  @ApiOperation({ summary: 'Send a quick message template' })
  @ApiResponse({ status: 201, description: 'Quick message sent successfully' })
  async sendQuickMessage(@Body() body: QuickMessageDto) {
    try {
      const templates = {
        greeting: 'Hello! This is a message from the dispatch team.',
        availability: 'Please confirm your availability for today.',
        document_reminder:
          'Your documents are expiring soon. Please update them.',
        thank_you: 'Thank you for your service today!',
      };

      const messageBody = templates[body.template];

      if (!messageBody) {
        throw new BadRequestException('Invalid template type');
      }

      const message = await this.whatsAppService.sendMessage({
        to: body.to,
        body: messageBody,
      });

      return {
        success: true,
        message,
      };
    } catch (error) {
      this.logger.error('Failed to send quick message:', error);
      throw new BadRequestException(error.message);
    }
  }

  @Post('send-template')
  @ApiOperation({
    summary: 'Send a WhatsApp template message to initiate conversation',
  })
  @ApiResponse({
    status: 201,
    description: 'Template message sent successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async sendTemplateMessage(@Body() body: { to: string }) {
    try {
      if (!body.to) {
        throw new BadRequestException('Phone number is required');
      }

      const message = await this.whatsAppService.sendTemplateMessageManually(
        body.to,
      );
      this.logger.log(`Template message sent to ${body.to}`);

      return {
        success: true,
        message,
      };
    } catch (error) {
      this.logger.error('Failed to send template message:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(errorMessage);
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check for WhatsApp service' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  healthCheck() {
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'WhatsApp API',
    };
  }
}
