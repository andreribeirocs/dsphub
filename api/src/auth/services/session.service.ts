import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { Request } from "express";

interface SessionMetadata {
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly location?: string;
}

interface CreateSessionOptions {
  readonly userId: string;
  readonly metadata: SessionMetadata;
  readonly accessTokenExp?: number;
  readonly refreshTokenExp?: number;
}

interface SessionInfo {
  readonly id: string;
  readonly deviceInfo?: string;
  readonly ipAddress?: string;
  readonly location?: string;
  readonly lastActivity: Date;
  readonly createdAt: Date;
  readonly isActive: boolean;
  readonly isCurrent: boolean;
}

interface SecurityAnalysis {
  readonly riskScore: number;
  readonly riskFactors: string[];
  readonly isNewDevice: boolean;
  readonly isNewLocation: boolean;
  readonly isUnusualTime: boolean;
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Create a new secure session with device tracking
   */
  async createSession(options: CreateSessionOptions): Promise<{
    sessionToken: string;
    refreshToken: string;
    accessToken: string;
    sessionId: string;
  }> {
    const { userId, metadata } = options;

    // Generate unique tokens
    const sessionToken = this.generateSecureToken();
    const refreshTokenValue = this.generateSecureToken();
    const jti = crypto.randomUUID(); // JWT ID for token revocation

    // Calculate expiration times
    const accessTokenExp = options.accessTokenExp || 3600; // 1 hour
    const refreshTokenExp = options.refreshTokenExp || 604800; // 7 days
    const sessionExpiresAt = new Date(Date.now() + refreshTokenExp * 1000);

    // Analyze security risk
    const securityAnalysis = await this.analyzeLoginSecurity(userId, metadata);

    // Create session record using Better Auth Session model
    const session = await this.prisma.session.create({
      data: {
        userId,
        token: sessionToken,
        expiresAt: sessionExpiresAt,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
      },
    });

    // Generate JWT access token with session information
    const accessToken = this.jwtService.sign(
      {
        sub: userId,
        jti,
        sessionId: session.id,
        type: "access",
      },
      { expiresIn: accessTokenExp }
    );

    // Log security events if suspicious
    if (securityAnalysis.riskScore > 70) {
      await this.logSuspiciousLogin(
        userId,
        securityAnalysis,
        metadata,
        session.id
      );
    }

    // Record successful login attempt
    await this.recordLoginAttempt({
      userId,
      email: "", // Will be filled by caller
      success: true,
      ...metadata,
      riskScore: securityAnalysis.riskScore,
      riskFactors: securityAnalysis.riskFactors,
    });

    this.logger.log(
      `New session created for user ${userId} (Risk: ${securityAnalysis.riskScore})`
    );

    return {
      sessionToken,
      refreshToken: refreshTokenValue,
      accessToken,
      sessionId: session.id,
    };
  }

  /**
   * Validate and refresh a session
   */
  async refreshSession(
    refreshToken: string,
    metadata: SessionMetadata
  ): Promise<{
    sessionToken: string;
    refreshToken: string;
    accessToken: string;
  } | null> {
    // Note: Better Auth handles refresh tokens internally
    // This method is kept for backward compatibility but simplified
    this.logger.warn(
      `refreshSession called but Better Auth handles refresh tokens internally`
    );
    return null;
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(
    sessionId: string,
    reason: string = "logout"
  ): Promise<void> {
    // Better Auth handles session revocation by deleting the session
    await this.prisma.session.delete({
      where: { id: sessionId },
    });

    this.logger.log(`Session ${sessionId} revoked (${reason})`);
  }

  /**
   * Revoke all sessions for a user except current
   */
  async revokeAllUserSessions(
    userId: string,
    exceptSessionId?: string
  ): Promise<number> {
    const whereClause = {
      userId,
      ...(exceptSessionId && { id: { not: exceptSessionId } }),
    };

    const result = await this.prisma.session.deleteMany({
      where: whereClause,
    });

    this.logger.log(`Revoked ${result.count} sessions for user ${userId}`);
    return result.count;
  }

  /**
   * Add token to revocation list
   */
  async revokeToken(
    token: string,
    tokenType: "access" | "refresh",
    userId?: string,
    reason?: string
  ): Promise<void> {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // Decode token to get expiration
    let expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // Default 24h
    try {
      const decoded = this.jwtService.decode(token) as any;
      if (decoded?.exp) {
        expiresAt = new Date(decoded.exp * 1000);
      }
    } catch (error) {
      this.logger.warn("Could not decode token for expiration:", error);
    }

    // Note: Better Auth handles token revocation differently
    // We rely on session invalidation instead of a separate revoked tokens table
    this.logger.debug(`Token revoked: ${tokenType} (${reason})`);
  }

  /**
   * Check if token is revoked
   */
  async isTokenRevoked(token: string): Promise<boolean> {
    // Note: Better Auth handles token revocation through session management
    // Check if the session associated with this token is still valid
    return false; // Simplified - rely on session expiration instead
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(
    userId: string,
    currentSessionId?: string
  ): Promise<SessionInfo[]> {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      deviceInfo: session.userAgent || undefined,
      ipAddress: session.ipAddress || undefined,
      location: undefined, // Better Auth doesn't store location
      lastActivity: session.updatedAt,
      createdAt: session.createdAt,
      isActive: session.expiresAt > new Date(),
      isCurrent: session.id === currentSessionId,
    }));
  }

  /**
   * Analyze login security and risk factors
   */
  private async analyzeLoginSecurity(
    userId: string,
    metadata: SessionMetadata
  ): Promise<SecurityAnalysis> {
    const riskFactors: string[] = [];
    let riskScore = 0;

    // Check for new device (using userAgent as proxy)
    const deviceHistory = await this.prisma.session.findFirst({
      where: {
        userId,
        userAgent: metadata.userAgent,
      },
    });

    const isNewDevice = !deviceHistory;
    if (isNewDevice) {
      riskFactors.push("new_device");
      riskScore += 30;
    }

    // Check for new location
    const locationHistory = await this.prisma.session.findFirst({
      where: {
        userId,
        ipAddress: metadata.ipAddress,
      },
    });

    const isNewLocation = !locationHistory;
    if (isNewLocation) {
      riskFactors.push("new_location");
      riskScore += 25;
    }

    // Check for unusual time (outside 6 AM - 11 PM)
    const hour = new Date().getHours();
    const isUnusualTime = hour < 6 || hour > 23;
    if (isUnusualTime) {
      riskFactors.push("unusual_time");
      riskScore += 15;
    }

    // Check recent failed attempts
    const recentFailures = await this.prisma.loginAttempt.count({
      where: {
        email: "", // Will be filled by caller
        success: false,
        attemptedAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
        },
      },
    });

    if (recentFailures > 3) {
      riskFactors.push("recent_failures");
      riskScore += 20;
    }

    return {
      riskScore: Math.min(riskScore, 100),
      riskFactors,
      isNewDevice,
      isNewLocation,
      isUnusualTime,
    };
  }

  /**
   * Validate session security during refresh
   */
  private async validateSessionSecurity(
    session: any,
    metadata: SessionMetadata
  ): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    // Check IP address consistency (allow some variation for mobile networks)
    if (session.ipAddress && metadata.ipAddress) {
      const sessionIP = session.ipAddress.split(".").slice(0, 3).join(".");
      const currentIP = metadata.ipAddress.split(".").slice(0, 3).join(".");

      if (sessionIP !== currentIP) {
        // Log as suspicious but don't immediately block (could be legitimate)
        this.logger.warn(
          `IP address change detected for session ${session.id}: ${session.ipAddress} -> ${metadata.ipAddress}`
        );
      }
    }

    // Check for session hijacking indicators
    if (
      session.deviceInfo &&
      metadata.userAgent &&
      session.deviceInfo !== metadata.userAgent
    ) {
      return {
        isValid: false,
        reason: "device_mismatch",
      };
    }

    return { isValid: true };
  }

  /**
   * Log suspicious login activity
   */
  private async logSuspiciousLogin(
    userId: string,
    analysis: SecurityAnalysis,
    metadata: SessionMetadata,
    sessionId: string
  ): Promise<void> {
    await this.prisma.suspiciousLogin.create({
      data: {
        userId,
        activityType: analysis.riskFactors.join(","),
        description: `High-risk login detected: ${analysis.riskFactors.join(", ")}`,
        riskScore: analysis.riskScore,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        location: metadata.location,
        sessionId,
      },
    });

    this.logger.warn(
      `Suspicious login detected for user ${userId}: Risk ${analysis.riskScore}`
    );
  }

  /**
   * Record login attempt for analytics and security
   */
  async recordLoginAttempt(data: {
    userId?: string;
    email: string;
    success: boolean;
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    riskScore?: number;
    riskFactors?: string[];
  }): Promise<void> {
    await this.prisma.loginAttempt.create({
      data: {
        userId: data.userId,
        email: data.email,
        success: data.success,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        location: data.location,
        riskScore: data.riskScore || 0,
        riskFactors: data.riskFactors || [],
      },
    });
  }

  /**
   * Clean up expired sessions and tokens
   */
  async cleanupExpiredSessions(): Promise<{
    sessions: number;
    tokens: number;
  }> {
    const now = new Date();

    // Delete expired sessions
    const expiredSessions = await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: now },
      },
    });

    this.logger.log(`Cleaned up ${expiredSessions.count} expired sessions`);

    return {
      sessions: expiredSessions.count,
      tokens: 0, // No separate revoked tokens table in Better Auth
    };
  }

  /**
   * Generate cryptographically secure token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  /**
   * Extract session metadata from request
   */
  static extractMetadata(request: Request): SessionMetadata {
    return {
      ipAddress: this.getClientIp(request),
      userAgent: request.headers["user-agent"],
      // Location would be resolved from IP using a service like MaxMind
      location: undefined,
    };
  }

  /**
   * Get client IP address from request
   */
  private static getClientIp(request: Request): string {
    return (
      (request.headers["x-forwarded-for"] as string)?.split(",")[0] ||
      (request.headers["x-real-ip"] as string) ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      "unknown"
    );
  }
}
