import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { SessionService } from "../services/session.service";

@Injectable()
export class SessionCleanupTask {
  private readonly logger = new Logger(SessionCleanupTask.name);

  constructor(private readonly sessionService: SessionService) {}

  /**
   * Clean up expired sessions every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredSessionCleanup(): Promise<void> {
    this.logger.log("Starting expired session cleanup...");

    try {
      const result = await this.sessionService.cleanupExpiredSessions();
      this.logger.log(
        `Session cleanup completed: ${result.sessions} sessions, ${result.tokens} tokens removed`
      );
    } catch (error) {
      this.logger.error("Failed to clean up expired sessions:", error);
    }
  }

  /**
   * Generate security report daily at 3 AM
   */
  @Cron("0 3 * * *") // Daily at 3 AM
  async generateSecurityReport(): Promise<void> {
    this.logger.log("Generating daily security report...");

    try {
      // This would generate a security report based on login attempts, suspicious activities, etc.
      // For now, just log that the task ran
      this.logger.log("Security report generation completed");
    } catch (error) {
      this.logger.error("Failed to generate security report:", error);
    }
  }
}
