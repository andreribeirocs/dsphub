import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { SecureErrorUtil } from "../shared/utils/secure-error.util";
import { WhatsAppService } from "./whatsapp.service";
import { TwilioWebhookPayload } from "./whatsapp.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { JwtAuthGuard } from "src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";
import {
  ThrottleStrict,
  ThrottleModerate,
} from "src/auth/decorators/throttle.decorator";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";

@ApiTags("whatsapp")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("whatsapp")
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly whatsAppService: WhatsAppService) {}

  @Post("send")
  @ApiOperation({ summary: "Send a WhatsApp message" })
  @ApiResponse({ status: 201, description: "Message sent successfully" })
  @ApiResponse({ status: 400, description: "Invalid request data" })
  @ApiResponse({ status: 429, description: "Too many requests." })
  @ThrottleStrict()
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    try {
      if (!sendMessageDto.to || !sendMessageDto.body) {
        throw new BadRequestException(
          "Phone number and message body are required"
        );
      }

      const message = await this.whatsAppService.sendMessage(sendMessageDto);
      this.logger.log(`Message sent to ${sendMessageDto.to}`);

      return {
        success: true,
        message,
      };
    } catch (error) {
      throw SecureErrorUtil.handleExternalServiceError(error, 'WhatsApp', 'send message');
    }
  }

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Handle Twilio webhook for incoming messages and status updates",
  })
  @ApiResponse({ status: 200, description: "Webhook processed successfully" })
  handleWebhook(@Body() payload: TwilioWebhookPayload): {
    success: boolean;
    error?: string;
  } {
    try {
      this.logger.log(
        "Received Twilio webhook:",
        JSON.stringify(payload, null, 2)
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
      this.logger.error("Error processing webhook:", error);
      
      // Don't expose internal errors to webhook callers - return generic response
      return { success: false, error: "Webhook processing failed" };
    }
  }

  @Get("conversations")
  @ApiOperation({ summary: "Get all WhatsApp conversations" })
  @ApiResponse({ status: 200, description: "List of conversations" })
  getConversations() {
    try {
      const conversations = this.whatsAppService.getConversations();
      return {
        success: true,
        data: conversations,
        total: conversations.length,
      };
    } catch (error) {
      throw SecureErrorUtil.createSecureError(error, 'WhatsApp.getConversations', 'Failed to retrieve conversations');
    }
  }

  @Get("conversations/:phoneNumber")
  @ApiOperation({ summary: "Get a specific conversation" })
  @ApiResponse({ status: 200, description: "Conversation details" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  getConversation(@Param("phoneNumber") phoneNumber: string) {
    try {
      const conversation = this.whatsAppService.getConversation(phoneNumber);

      if (!conversation) {
        throw new NotFoundException(
          `Conversation with ${phoneNumber} not found`
        );
      }

      return {
        success: true,
        data: conversation,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw SecureErrorUtil.createSecureError(error, 'WhatsApp.getConversation', 'Failed to retrieve conversation');
    }
  }

  @Post("template")
  @ApiOperation({ summary: "Send a WhatsApp template message" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number" },
        templateSid: { type: "string", description: "Template SID" },
        variables: {
          type: "array",
          items: { type: "string" },
          description: "Template variables",
        },
      },
      required: ["to", "templateSid"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Template message sent successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid request data" })
  @ApiResponse({ status: 429, description: "Too many requests." })
  @ThrottleStrict()
  async sendTemplateMessage(
    @Body() body: { to: string; templateSid: string; variables?: string[] }
  ) {
    try {
      if (!body.to || !body.templateSid) {
        throw new BadRequestException(
          "Phone number and template SID are required"
        );
      }

      const success = await this.whatsAppService.sendWhatsAppTemplate(
        body.to,
        body.templateSid,
        body.variables || []
      );

      if (!success) {
        throw new BadRequestException("Failed to send template message");
      }

      this.logger.log(`Template message sent to ${body.to}`);

      return {
        success: true,
        message: "Template message sent successfully",
      };
    } catch (error) {
      throw SecureErrorUtil.handleExternalServiceError(error, 'WhatsApp', 'send template message');
    }
  }

  @Get("health")
  @ApiOperation({ summary: "Health check for WhatsApp service" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  healthCheck() {
    return {
      status: "ok",
      service: "WhatsApp",
      timestamp: new Date().toISOString(),
      features: {
        messaging: true,
        templates: true,
        webhooks: true,
        conversations: true,
      },
    };
  }

  @Get("templates")
  @ApiOperation({ summary: "Get available message templates" })
  @ApiResponse({ status: 200, description: "List of available templates" })
  getTemplates() {
    // In a real implementation, this would fetch from Twilio or a database
    const templates = [
      {
        id: "greeting",
        name: "Greeting Message",
        content: "Hello, welcome to our service!",
        variables: [],
      },
      {
        id: "registration_link",
        name: "Registration Link",
        content: "Please complete your registration: {{1}}",
        variables: ["registration_url"],
      },
      {
        id: "document_reminder",
        name: "Document Reminder",
        content:
          "Please upload your {{1}} document to complete your application.",
        variables: ["document_type"],
      },
    ];

    return {
      success: true,
      data: templates,
    };
  }
}
