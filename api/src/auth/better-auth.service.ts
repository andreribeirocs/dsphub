import { Injectable, UnauthorizedException } from "@nestjs/common";
import { auth } from "./better-auth.config";
import { PrismaService } from "../prisma/prisma.service";

export interface SessionData {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    emailVerified: boolean;
  };
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
    token: string;
    activeOrganizationId?: string;
  };
}

@Injectable()
export class BetterAuthService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate session token and return session data
   */
  async validateSession(sessionToken: string): Promise<SessionData | null> {
    try {
      // Query session directly from database
      const session = await this.prisma.$queryRaw<any[]>`
        SELECT 
          s.id as "sessionId",
          s."userId",
          s."expiresAt",
          s.token,
          s."activeOrganizationId",
          u.id as "userId",
          u.email,
          u.name,
          u.role,
          u.status,
          u."emailVerified"
        FROM "session" s
        JOIN "user" u ON u.id = s."userId"
        WHERE s.token = ${sessionToken}
        AND s."expiresAt" > NOW()
        LIMIT 1
      `;

      if (!session || session.length === 0) {
        return null;
      }

      const data = session[0];

      return {
        user: {
          id: data.userId,
          email: data.email,
          name: data.name,
          role: data.role,
          status: data.status,
          emailVerified: data.emailVerified,
        },
        session: {
          id: data.sessionId,
          userId: data.userId,
          expiresAt: data.expiresAt,
          token: data.token,
          activeOrganizationId: data.activeOrganizationId,
        },
      };
    } catch (error) {
      console.error("Error validating session:", error);
      return null;
    }
  }

  /**
   * Get user's organizations
   */
  async getUserOrganizations(userId: string) {
    const members = await this.prisma.$queryRaw<any[]>`
      SELECT 
        o.id,
        o.name,
        o.slug,
        o.logo,
        o."isActive",
        m.role as "memberRole"
      FROM "member" m
      JOIN "organization" o ON o.id = m."organizationId"
      WHERE m."userId" = ${userId}
      AND o."isActive" = true
      ORDER BY o.name
    `;

    return members;
  }

  /**
   * Depots a member is limited to inside an organization.
   * Empty list = no restriction (all depots).
   */
  async getMemberDepotIds(userId: string, organizationId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ depotId: string }[]>`
      SELECT md."depotId"
      FROM "member_depot" md
      JOIN "member" m ON m.id = md."memberId"
      JOIN "depot" d ON d.id = md."depotId"
      WHERE m."userId" = ${userId}
      AND m."organizationId" = ${organizationId}
      AND d."organizationId" = ${organizationId}
    `;
    return rows.map((row) => row.depotId);
  }

  /**
   * Check if user has access to organization
   */
  async hasOrganizationAccess(
    userId: string,
    organizationId: string
  ): Promise<boolean> {
    const member = await this.prisma.$queryRaw<any[]>`
      SELECT 1
      FROM "member" m
      JOIN "organization" o ON o.id = m."organizationId"
      WHERE m."userId" = ${userId}
      AND m."organizationId" = ${organizationId}
      AND o."isActive" = true
      LIMIT 1
    `;

    return member.length > 0;
  }

  /**
   * Check if user is super admin
   */
  async isSuperAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.$queryRaw<any[]>`
      SELECT 1
      FROM "user"
      WHERE id = ${userId}
      AND role = 'SUPER_ADMIN'
      LIMIT 1
    `;

    return user.length > 0;
  }

  /**
   * Get organization by slug (subdomain)
   */
  async getOrganizationBySlug(slug: string) {
    const orgs = await this.prisma.$queryRaw<any[]>`
      SELECT *
      FROM "organization"
      WHERE slug = ${slug}
      AND "isActive" = true
      LIMIT 1
    `;

    return orgs.length > 0 ? orgs[0] : null;
  }

  /**
   * Set active organization for session
   */
  async setActiveOrganization(sessionToken: string, organizationId: string) {
    try {
      await this.prisma.$executeRaw`
        UPDATE "session"
        SET "activeOrganizationId" = ${organizationId}
        WHERE token = ${sessionToken}
      `;
      return true;
    } catch (error) {
      console.error("Error setting active organization:", error);
      return false;
    }
  }

  /**
   * Create organization (super-admin only)
   */
  async createOrganization(data: {
    name: string;
    slug: string;
    userId: string;
  }) {
    const { name, slug, userId } = data;

    // Check if slug is already taken
    const existing = await this.getOrganizationBySlug(slug);
    if (existing) {
      throw new Error("Organization slug already exists");
    }

    // Create organization
    const org = await this.prisma.organization.create({
      data: {
        name,
        slug,
        isActive: true,
      },
    });

    // Add creator as owner
    await this.prisma.$executeRaw`
      INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${org.id},
        ${userId},
        'owner',
        NOW(),
        NOW()
      )
    `;

    return org;
  }

  /**
   * Add member to organization
   */
  async addMember(organizationId: string, userId: string, role: string) {
    await this.prisma.$executeRaw`
      INSERT INTO "member" (id, "organizationId", "userId", role, "createdAt", "updatedAt")
      VALUES (
        gen_random_uuid()::text,
        ${organizationId},
        ${userId},
        ${role},
        NOW(),
        NOW()
      )
      ON CONFLICT ("organizationId", "userId") DO NOTHING
    `;
  }

  /**
   * Remove member from organization
   */
  async removeMember(organizationId: string, userId: string) {
    await this.prisma.$executeRaw`
      DELETE FROM "member"
      WHERE "organizationId" = ${organizationId}
      AND "userId" = ${userId}
    `;
  }
}
