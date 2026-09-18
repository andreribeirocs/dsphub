import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenancy/tenant-context";

export type AuditCategory = "access" | "changes";

export interface AuditEntry {
  id: string;
  timestamp: Date;
  category: AuditCategory;
  action: string;
  success: boolean;
  actorName: string | null;
  actorEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
}

export interface AuditQuery {
  category?: string;
  search?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string | number;
  limit?: string | number;
}

export interface SignInRecord {
  email: string;
  success: boolean;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
}

const toDate = (value?: string): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/**
 * Audit trail of the current DSP.
 * - access: sign-in attempts made on the DSP's domain (recorded by the auth controller)
 * - changes: route price changes (payment_history)
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Record a sign-in attempt. Never throws: auditing must not break login. */
  async recordSignIn(record: SignInRecord): Promise<void> {
    try {
      const email = record.email.trim().toLowerCase().slice(0, 320);
      await TenantContext.runAsSystem(async () => {
        const user = await this.prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });
        await this.prisma.loginAttempt.create({
          data: {
            email,
            success: record.success,
            userId: user?.id,
            organizationId: record.organizationId,
            ipAddress: record.ipAddress?.slice(0, 100),
            userAgent: record.userAgent?.slice(0, 500),
          },
        });
        if (record.success && user) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
          });
        }
      });
    } catch (error) {
      this.logger.warn(`Could not record sign-in attempt: ${(error as Error).message}`);
    }
  }

  /** Sign-in history of one user on the current DSP */
  async loginHistory(userId: string, take = 20) {
    const organizationId = TenantContext.requireOrganizationId();
    return this.prisma.loginAttempt.findMany({
      where: { userId, organizationId },
      orderBy: { attemptedAt: "desc" },
      take: Math.min(Math.max(take, 1), 100),
      select: {
        id: true,
        attemptedAt: true,
        success: true,
        ipAddress: true,
        userAgent: true,
      },
    });
  }

  /**
   * Write one entry to the DSP's audit trail.
   *
   * Pass `tx` when the action happens inside a transaction, so the trail is
   * written or rolled back together with the change it describes — an audit
   * row for something that did not happen is worse than no row at all.
   *
   * Outside a transaction the write is best-effort: a failure is logged and
   * swallowed, because a broken audit write should not be the reason a real
   * operation fails.
   *
   * Inside a transaction it rethrows. Postgres leaves a transaction unusable
   * after a failed statement, so swallowing there would only turn one clear
   * error into a confusing cascade — and would commit the change while
   * silently dropping its trail, which is the one outcome an audit table
   * exists to prevent.
   */
  async record(
    entry: {
      action: string;
      entityType: string;
      entityId?: string | null;
      actorUserId?: string | null;
      summary: string;
      metadata?: Prisma.InputJsonValue;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    try {
      const client = tx ?? this.prisma;
      await client.auditLog.create({
        data: {
          organizationId: TenantContext.requireOrganizationId(),
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId ?? null,
          actorUserId: entry.actorUserId ?? null,
          summary: entry.summary,
          ...(entry.metadata !== undefined && { metadata: entry.metadata }),
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit entry ${entry.action}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      if (tx) {
        throw error;
      }
    }
  }

  async list(query: AuditQuery) {
    const organizationId = TenantContext.requireOrganizationId();
    const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
    const page = Math.max(Number(query.page) || 1, 1);
    const category = query.category === "access" || query.category === "changes" ? query.category : "all";
    const search = query.search?.trim();
    const from = toDate(query.from);
    const to = toDate(query.to);
    const window = page * limit;

    const accessWhere: Prisma.LoginAttemptWhereInput = {
      organizationId,
      ...(query.status === "success" ? { success: true } : {}),
      ...(query.status === "failed" ? { success: false } : {}),
      ...(from || to ? { attemptedAt: { gte: from, lte: to } } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { ipAddress: { contains: search } },
              { user: { name: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    // Price changes are always successful actions
    const includeChanges = category !== "access" && query.status !== "failed";
    const changesWhere: Prisma.PaymentHistoryWhereInput = {
      ...(from || to ? { changeDate: { gte: from, lte: to } } : {}),
      ...(search
        ? {
            OR: [
              { changeReason: { contains: search, mode: "insensitive" } },
              { changedByUser: { name: { contains: search, mode: "insensitive" } } },
              { changedByUser: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    // Recorded actions (conversions, assignments, ...) count as changes.
    // Filtered the same way as price changes so the screen's existing
    // category/status/date/search controls keep working unchanged.
    const auditWhere: Prisma.AuditLogWhereInput = {
      ...(from || to ? { occurredAt: { gte: from, lte: to } } : {}),
      ...(search
        ? {
            OR: [
              { summary: { contains: search, mode: "insensitive" } },
              { action: { contains: search, mode: "insensitive" } },
              { actor: { name: { contains: search, mode: "insensitive" } } },
              { actor: { email: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    };

    const [accessRows, accessTotal, changeRows, changesTotal, auditRows, auditTotal] = await Promise.all([
      category === "changes"
        ? Promise.resolve([])
        : this.prisma.loginAttempt.findMany({
            where: accessWhere,
            orderBy: { attemptedAt: "desc" },
            take: window,
            include: { user: { select: { name: true } } },
          }),
      category === "changes" ? Promise.resolve(0) : this.prisma.loginAttempt.count({ where: accessWhere }),
      includeChanges
        ? this.prisma.paymentHistory.findMany({
            where: changesWhere,
            orderBy: { changeDate: "desc" },
            take: window,
            include: { changedByUser: { select: { name: true, email: true } } },
          })
        : Promise.resolve([]),
      includeChanges ? this.prisma.paymentHistory.count({ where: changesWhere }) : Promise.resolve(0),
      includeChanges
        ? this.prisma.auditLog.findMany({
            where: auditWhere,
            orderBy: { occurredAt: "desc" },
            take: window,
            include: { actor: { select: { name: true, email: true } } },
          })
        : Promise.resolve([]),
      includeChanges ? this.prisma.auditLog.count({ where: auditWhere }) : Promise.resolve(0),
    ]);

    const entries: AuditEntry[] = [
      ...accessRows.map(
        (row): AuditEntry => ({
          id: `access-${row.id}`,
          timestamp: row.attemptedAt,
          category: "access",
          action: row.success ? "Sign-in" : "Failed sign-in",
          success: row.success,
          actorName: row.user?.name ?? null,
          actorEmail: row.email,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          details: null,
        })
      ),
      ...changeRows.map(
        (row): AuditEntry => ({
          id: `change-${row.id}`,
          timestamp: row.changeDate,
          category: "changes",
          action: `Route price changed (${row.routeType})`,
          success: true,
          actorName: row.changedByUser.name,
          actorEmail: row.changedByUser.email,
          ipAddress: null,
          userAgent: null,
          details: `£${row.oldRate ?? 0} → £${row.newRate}${row.changeReason ? ` — ${row.changeReason}` : ""}`,
        })
      ),
      ...auditRows.map(
        (row): AuditEntry => ({
          id: `audit-${row.id}`,
          timestamp: row.occurredAt,
          category: "changes",
          action: row.action,
          success: true,
          actorName: row.actor?.name ?? null,
          actorEmail: row.actor?.email ?? null,
          ipAddress: row.ipAddress,
          userAgent: row.userAgent,
          details: row.summary,
        })
      ),
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = accessTotal + changesTotal + auditTotal;
    return {
      data: entries.slice((page - 1) * limit, page * limit),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: await this.summary(organizationId),
    };
  }

  private async summary(organizationId: string) {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [signIns24h, failedSignIns24h, priceChanges7d, recordedActions7d] =
      await Promise.all([
        this.prisma.loginAttempt.count({
          where: { organizationId, success: true, attemptedAt: { gte: dayAgo } },
        }),
        this.prisma.loginAttempt.count({
          where: { organizationId, success: false, attemptedAt: { gte: dayAgo } },
        }),
        this.prisma.paymentHistory.count({ where: { changeDate: { gte: weekAgo } } }),
        // New field rather than folded into priceChanges7d: the screen shows
        // that tile as "price changes", and quietly changing what it counts
        // would make an existing number mean something else.
        this.prisma.auditLog.count({ where: { occurredAt: { gte: weekAgo } } }),
      ]);
    return { signIns24h, failedSignIns24h, priceChanges7d, recordedActions7d };
  }
}
