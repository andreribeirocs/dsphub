import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  prismaTenantExtension,
  rlsState,
} from "../tenancy/prisma-tenant.extension";
import { TenantContext } from "../tenancy/tenant-context";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // Connection pooling and performance optimization
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      // Log slow queries in development
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "info", "warn", "error"]
          : ["warn", "error"],
    });

    // Add query performance monitoring
    if (process.env.NODE_ENV === "development") {
      this.$on("query" as never, (e: any) => {
        if (e.duration > 1000) {
          // Log queries taking more than 1 second
          this.logger.warn(`Slow query detected: ${e.duration}ms - ${e.query}`);
        }
      });
    }

    // Every query on DSP data is scoped to the organization of the current
    // request (see src/tenancy). Returning the extended client keeps the
    // PrismaService API for all consumers.
    // eslint-disable-next-line no-constructor-return
    return this.$extends(prismaTenantExtension) as unknown as PrismaService;
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("Database connection established successfully");

      // Test database connection
      await this.$queryRaw`SELECT 1`;
      this.logger.log("Database health check passed");
      await this.detectRowLevelSecurity();
    } catch (error) {
      this.logger.error("Failed to connect to database:", error);
      throw error;
    }
  }

  /**
   * RLS policies only apply to roles that are not superusers and do not have
   * BYPASSRLS. When the app connects with such a role, every query sets the
   * current organization for the policies (see prisma-tenant.extension.ts).
   */
  private async detectRowLevelSecurity() {
    const [role] = await TenantContext.runAsSystem(
      async () =>
        await this.$queryRaw<{ rolsuper: boolean; rolbypassrls: boolean }[]>`
          SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user
        `
    );
    rlsState.active = !!role && !role.rolsuper && !role.rolbypassrls;
    this.logger.log(
      rlsState.active
        ? "Row-Level Security active: database enforces DSP isolation"
        : "Row-Level Security not enforced for this database role (superuser/bypass) - use the dsphub_app role in production"
    );
  }

  /**
   * Interactive transaction that keeps DSP isolation (and RLS) working.
   * Use instead of $transaction(async (tx) => ...).
   */
  async tenantTransaction<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { maxWait?: number; timeout?: number }
  ): Promise<T> {
    const store = TenantContext.get();
    return this.$transaction(async (tx) => {
      return TenantContext.run({ ...store, inTransaction: true }, async () => {
        if (rlsState.active && store?.organizationId && !store.system) {
          await tx.$executeRaw`SELECT set_config('app.current_organization_id', ${store.organizationId}, TRUE)`;
        }
        return fn(tx);
      });
    }, options);
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      this.logger.log("Database connection closed");
    } catch (error) {
      this.logger.error("Error disconnecting from database:", error);
    }
  }

  /**
   * Get database health information
   */
  async getHealthInfo() {
    try {
      const result = await this.$queryRaw`
        SELECT 
          count(*)::int as total_connections,
          current_setting('max_connections') as max_connections
        FROM pg_stat_activity
      `;

      return {
        status: "healthy",
        timestamp: new Date().toISOString(),
        connectionInfo: result,
      };
    } catch (error) {
      this.logger.error("Database health check failed:", error);
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get performance statistics
   */
  async getPerformanceStats() {
    try {
      const slowQueries = await this.$queryRaw`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        WHERE mean_time > 100 
        ORDER BY mean_time DESC 
        LIMIT 10
      `;

      const indexUsage = await this.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_scan,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        ORDER BY idx_scan DESC 
        LIMIT 20
      `;

      return {
        slowQueries,
        indexUsage,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.warn(
        "Could not fetch performance stats (pg_stat_statements might not be enabled):",
        error
      );
      return {
        message: "Performance statistics not available",
        timestamp: new Date().toISOString(),
      };
    }
  }
}
