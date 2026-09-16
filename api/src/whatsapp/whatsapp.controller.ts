import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpException,
} from "@nestjs/common";
import { SecureErrorUtil } from "../shared/utils/secure-error.util";
import { WhatsAppService } from "./whatsapp.service";
import { SendMessageDto } from "./dto/send-message.dto";
import { BetterAuthGuard } from "src/auth/guards/better-auth.guard";
import { RolesGuard } from "src/auth/guards/roles.guard";
import { ThrottleStrict } from "src/auth/decorators/throttle.decorator";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";

@ApiTags("whatsapp")
@UseGuards(BetterAuthGuard, RolesGuard)
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
      if (error instanceof HttpException) {
        throw error;
      }
      throw SecureErrorUtil.handleExternalServiceError(
        error,
        "WhatsApp",
        "send message"
      );
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
      throw SecureErrorUtil.createSecureError(
        error,
        "WhatsApp.getConversations",
        "Failed to retrieve conversations"
      );
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

      throw SecureErrorUtil.createSecureError(
        error,
        "WhatsApp.getConversation",
        "Failed to retrieve conversation"
      );
    }
  }

  @Post("template")
  @ApiOperation({ summary: "Send a pre-approved WhatsApp template message" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Recipient phone number" },
        templateName: {
          type: "string",
          description: "Template name as approved in the provider",
        },
        variables: {
          type: "array",
          items: { type: "string" },
          description: "Template variables",
        },
      },
      required: ["to", "templateName"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "Template message sent successfully",
  })
  @ApiResponse({ status: 400, description: "Invalid request data" })
  @ApiResponse({ status: 429, description: "Too many requests." })
  @ApiResponse({ status: 503, description: "Messaging not configured" })
  @ThrottleStrict()
  async sendTemplateMessage(
    @Body() body: { to: string; templateName: string; variables?: string[] }
  ) {
    try {
      if (!body.to || !body.templateName) {
        throw new BadRequestException(
          "Phone number and template name are required"
        );
      }

      const success = await this.whatsAppService.sendTemplate(
        body.to,
        body.templateName,
        body.variables || []
      );

      if (!success) {
        throw new BadRequestException("Failed to send template message");
      }

      return {
        success: true,
        message: "Template message sent successfully",
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw SecureErrorUtil.handleExternalServiceError(
        error,
        "WhatsApp",
        "send template message"
      );
    }
  }

  @Get("health")
  @ApiOperation({ summary: "Health check for WhatsApp service" })
  @ApiResponse({ status: 200, description: "Service is healthy" })
  healthCheck() {
    return {
      status: "ok",
      service: "WhatsApp",
      provider: this.whatsAppService.providerName,
      configured: this.whatsAppService.isConfigured(),
      timestamp: new Date().toISOString(),
      features: {
        messaging: this.whatsAppService.isConfigured(),
        templates: this.whatsAppService.isConfigured(),
        webhooks: false,
        conversations: true,
      },
    };
  }

  @Get("templates")
  @ApiOperation({ summary: "Get available message templates" })
  @ApiResponse({ status: 200, description: "List of available templates" })
  getTemplates() {
    // Static examples; real templates will come from the chosen provider
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
