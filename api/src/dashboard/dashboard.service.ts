import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TenantContext } from "../tenancy/tenant-context";

export interface RecentActivity {
  id: string;
  timestamp: Date;
  type: "login" | "payment" | "security" | "driver" | "candidate" | "system";
  activity: string;
  user: {
    name: string;
    email?: string;
  };
  status: "success" | "warning" | "error" | "info";
  details?: string;
}

export interface DashboardStats {
  activeDrivers: number;
  completedRoutes: number;
  pendingCandidates: number;
  vehicleIssues: number;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getRecentActivities(): Promise<RecentActivity[]> {
    const activities: RecentActivity[] = [];
    // login_attempts and security_events are not DSP tables: filter explicitly
    const organizationId = TenantContext.requireOrganizationId();

    // Get recent login attempts (last 24 hours)
    const recentLogins = await this.prisma.loginAttempt.findMany({
      where: {
        organizationId,
        attemptedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        },
        success: true,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        attemptedAt: "desc",
      },
      take: 5,
    });

    // Transform login attempts to activities
    recentLogins.forEach((login) => {
      activities.push({
        id: `login-${login.id}`,
        timestamp: login.attemptedAt,
        type: "login",
        activity: "User logged in",
        user: {
          name: login.user?.name || "Unknown User",
          email: login.user?.email || login.email,
        },
        status: "success",
        details: `Login from ${login.ipAddress || "unknown IP"}`,
      });
    });

    // Get recent payment history changes
    const recentPaymentChanges = await this.prisma.paymentHistory.findMany({
      where: {
        changeDate: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      include: {
        changedByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        changeDate: "desc",
      },
      take: 5,
    });

    // Transform payment changes to activities
    recentPaymentChanges.forEach((change) => {
      activities.push({
        id: `payment-${change.id}`,
        timestamp: change.changeDate,
        type: "payment",
        activity: `Route price updated: ${change.routeType}`,
        user: {
          name: change.changedByUser.name,
          email: change.changedByUser.email,
        },
        status: "info",
        details: `Changed from £${change.oldRate || 0} to £${change.newRate}${
          change.changeReason ? ` - ${change.changeReason}` : ""
        }`,
      });
    });

    // Get recent security events
    const memberIds = (
      await this.prisma.member.findMany({ select: { userId: true } })
    ).map((member) => member.userId);
    const recentSecurityEvents = await this.prisma.securityEvent.findMany({
      where: {
        userId: { in: memberIds },
        occurredAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: {
        occurredAt: "desc",
      },
      take: 5,
    });

    // Transform security events to activities
    recentSecurityEvents.forEach((event) => {
      const severity = event.severity.toLowerCase();
      activities.push({
        id: `security-${event.id}`,
        timestamp: event.occurredAt,
        type: "security",
        activity: `Security event: ${event.eventType}`,
        user: {
          name: "System",
        },
        status:
          severity === "low"
            ? "info"
            : severity === "medium"
              ? "warning"
              : "error",
        details: event.description,
      });
    });

    // Get recent driver payments (as driver activity)
    const recentDriverPayments = await this.prisma.driverPayment.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Last 3 days
        },
      },
      include: {
        driver: {
          select: {
            name: true,
          },
        },
        paidByUser: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
    });

    // Transform driver payments to activities
    recentDriverPayments.forEach((payment) => {
      activities.push({
        id: `driver-payment-${payment.id}`,
        timestamp: payment.createdAt,
        type: "driver",
        activity: `Payment record created for ${payment.driver.name}`,
        user: {
          name: payment.paidByUser?.name || "System",
          email: payment.paidByUser?.email,
        },
        status: payment.isPaid ? "success" : "info",
        details: `${payment.routeType} - £${payment.totalPaid} for ${payment.workDate.toDateString()}`,
      });
    });

    // Get recent candidate activities
    const recentCandidates = await this.prisma.candidate.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 5,
    });

    // Transform candidate updates to activities
    recentCandidates.forEach((candidate) => {
      const isNew =
        candidate.createdAt.getTime() === candidate.updatedAt.getTime();
      activities.push({
        id: `candidate-${candidate.id}`,
        timestamp: candidate.updatedAt,
        type: "candidate",
        activity: isNew
          ? "New candidate registered"
          : "Candidate status updated",
        user: {
          name: candidate.name,
        },
        status:
          candidate.status === "APPROVED"
            ? "success"
            : candidate.status === "REJECTED"
              ? "error"
              : "info",
        details: `Status: ${candidate.status}${candidate.phoneNumber ? ` - ${candidate.phoneNumber}` : ""}`,
      });
    });

    // Sort all activities by timestamp and take the most recent 10
    activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return activities.slice(0, 10);
  }

  async getDashboardStats(): Promise<DashboardStats> {
    // Get active drivers count
    const activeDrivers = await this.prisma.driver.count({
      where: {
        status: "ACTIVE",
      },
    });

    // Get completed routes (paid payments in last 30 days)
    const completedRoutes = await this.prisma.driverPayment.count({
      where: {
        isPaid: true,
        workDate: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
      },
    });

    // Get pending candidates
    const pendingCandidates = await this.prisma.candidate.count({
      where: {
        status: {
          in: ["LEAD", "SMS_SENT", "FORM_COMPLETED", "DOCUMENTS_UPLOADED"],
        },
      },
    });

    // Get vehicle issues (maintenance records that are not completed)
    const vehicleIssues = await this.prisma.maintenanceRecord.count({
      where: {
        status: {
          in: ["SCHEDULED", "IN_PROGRESS", "OVERDUE"],
        },
        priority: {
          in: ["HIGH", "URGENT"],
        },
      },
    });

    return {
      activeDrivers,
      completedRoutes,
      pendingCandidates,
      vehicleIssues,
    };
  }
}
