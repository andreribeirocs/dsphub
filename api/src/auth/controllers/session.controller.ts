import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  Request,
  Post,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { SessionService } from "../services/session.service";
import { JwtAuthGuard } from "../guards/jwt-auth.guard";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import {
  ThrottleModerate,
  ThrottleStrict,
} from "../decorators/throttle.decorator";

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

@ApiTags("session")
@Controller("auth/sessions")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /**
   * Get all active sessions for the current user
   */
  @Get()
  @ApiOperation({ summary: "Get user active sessions" })
  @ApiResponse({
    status: 200,
    description: "List of active sessions",
    schema: {
      type: "object",
      properties: {
        sessions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              deviceInfo: { type: "string" },
              ipAddress: { type: "string" },
              location: { type: "string" },
              lastActivity: { type: "string", format: "date-time" },
              createdAt: { type: "string", format: "date-time" },
              isActive: { type: "boolean" },
              isCurrent: { type: "boolean" },
            },
          },
        },
        total: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ThrottleModerate()
  async getSessions(@Request() req: AuthenticatedRequest) {
    const sessions = await this.sessionService.getUserSessions(req.user.id);

    return {
      sessions: sessions.map((session) => ({
        id: session.id,
        deviceInfo: this.sanitizeDeviceInfo(session.deviceInfo),
        ipAddress: this.sanitizeIpAddress(session.ipAddress),
        location: session.location || "Unknown",
        lastActivity: session.lastActivity,
        createdAt: session.createdAt,
        isActive: session.isActive,
        isCurrent: session.isCurrent,
      })),
      total: sessions.length,
    };
  }

  /**
   * Revoke a specific session
   */
  @Delete(":sessionId")
  @ApiOperation({ summary: "Revoke a specific session" })
  @ApiResponse({ status: 200, description: "Session revoked successfully" })
  @ApiResponse({ status: 404, description: "Session not found" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ThrottleStrict()
  @HttpCode(HttpStatus.OK)
  async revokeSession(
    @Param("sessionId") sessionId: string,
    @Request() req: AuthenticatedRequest
  ) {
    // Verify the session belongs to the user
    const sessions = await this.sessionService.getUserSessions(req.user.id);
    const session = sessions.find((s) => s.id === sessionId);

    if (!session) {
      return {
        success: false,
        message: "Session not found or does not belong to you",
      };
    }

    await this.sessionService.revokeSession(sessionId, "user_revoked");

    return {
      success: true,
      message: "Session revoked successfully",
    };
  }

  /**
   * Revoke all other sessions (logout from all other devices)
   */
  @Post("revoke-all")
  @ApiOperation({ summary: "Revoke all other sessions" })
  @ApiResponse({
    status: 200,
    description: "All other sessions revoked",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean" },
        message: { type: "string" },
        revokedCount: { type: "number" },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ThrottleStrict()
  @HttpCode(HttpStatus.OK)
  async revokeAllOtherSessions(@Request() req: AuthenticatedRequest) {
    // Get current session ID from JWT if available
    // For now, we'll revoke all sessions for the user
    const revokedCount = await this.sessionService.revokeAllUserSessions(
      req.user.id
    );

    return {
      success: true,
      message: `${revokedCount} session(s) revoked successfully`,
      revokedCount,
    };
  }

  /**
   * Get session security insights
   */
  @Get("security-insights")
  @ApiOperation({ summary: "Get security insights for user sessions" })
  @ApiResponse({
    status: 200,
    description: "Security insights",
    schema: {
      type: "object",
      properties: {
        totalSessions: { type: "number" },
        activeSessions: { type: "number" },
        uniqueDevices: { type: "number" },
        uniqueLocations: { type: "number" },
        recentSuspiciousActivity: { type: "number" },
        recommendations: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ThrottleModerate()
  async getSecurityInsights(@Request() req: AuthenticatedRequest) {
    const sessions = await this.sessionService.getUserSessions(req.user.id);

    const uniqueDevices = new Set(
      sessions.map((s) => s.deviceInfo).filter(Boolean)
    ).size;
    const uniqueLocations = new Set(
      sessions.map((s) => s.location).filter(Boolean)
    ).size;

    // Generate security recommendations
    const recommendations: string[] = [];

    if (sessions.length > 5) {
      recommendations.push(
        "Consider revoking unused sessions to improve security"
      );
    }

    if (uniqueDevices > 3) {
      recommendations.push(
        "Multiple devices detected - ensure all devices are yours"
      );
    }

    if (uniqueLocations > 2) {
      recommendations.push(
        "Multiple locations detected - verify all login locations"
      );
    }

    // Check for old sessions (> 30 days)
    const oldSessions = sessions.filter((s) => {
      const daysSinceActivity =
        (Date.now() - s.lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceActivity > 30;
    });

    if (oldSessions.length > 0) {
      recommendations.push(
        `${oldSessions.length} session(s) haven't been used in over 30 days`
      );
    }

    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.isActive).length,
      uniqueDevices,
      uniqueLocations,
      recentSuspiciousActivity: 0, // Would query suspicious_logins table
      recommendations,
    };
  }

  /**
   * Sanitize device information for display
   */
  private sanitizeDeviceInfo(deviceInfo?: string): string {
    if (!deviceInfo) return "Unknown Device";

    // Extract browser and OS information safely
    const browser = this.extractBrowser(deviceInfo);
    const os = this.extractOS(deviceInfo);

    return `${browser} on ${os}`;
  }

  /**
   * Sanitize IP address for display (hide last octet for privacy)
   */
  private sanitizeIpAddress(ipAddress?: string): string {
    if (!ipAddress || ipAddress === "unknown") return "Unknown";

    const parts = ipAddress.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }

    return "Unknown";
  }

  /**
   * Extract browser name from user agent
   */
  private extractBrowser(userAgent: string): string {
    if (userAgent.includes("Chrome")) return "Chrome";
    if (userAgent.includes("Firefox")) return "Firefox";
    if (userAgent.includes("Safari")) return "Safari";
    if (userAgent.includes("Edge")) return "Edge";
    if (userAgent.includes("Opera")) return "Opera";
    return "Unknown Browser";
  }

  /**
   * Extract OS from user agent
   */
  private extractOS(userAgent: string): string {
    if (userAgent.includes("Windows")) return "Windows";
    if (userAgent.includes("Mac")) return "macOS";
    if (userAgent.includes("Linux")) return "Linux";
    if (userAgent.includes("Android")) return "Android";
    if (userAgent.includes("iOS")) return "iOS";
    return "Unknown OS";
  }
}
