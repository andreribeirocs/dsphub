import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { organization } from "better-auth/plugins";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEV_ORIGINS =
  process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:4200", "http://localhost:3000"];

const originCache = new Map<string, { allowed: boolean; expiresAt: number }>();

/**
 * Accept auth requests from any active DSP domain registered in
 * organization_domain (plus local dev origins outside production).
 */
async function trustedOrigins(request?: Request): Promise<string[]> {
  const origin = request?.headers.get("origin");
  if (!origin) {
    return DEV_ORIGINS;
  }

  const cached = originCache.get(origin);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.allowed ? [...DEV_ORIGINS, origin] : DEV_ORIGINS;
  }

  let allowed = false;
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    const domain = await prisma.organizationDomain.findUnique({
      where: { domain: hostname },
      select: { organization: { select: { isActive: true } } },
    });
    allowed = !!domain?.organization.isActive;
  } catch {
    allowed = false;
  }

  originCache.set(origin, { allowed, expiresAt: Date.now() + 60_000 });
  return allowed ? [...DEV_ORIGINS, origin] : DEV_ORIGINS;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for now, enable later
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days (match session expiry)
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "DRIVER",
        // Ensure field is returned in responses
        returned: true,
      },
      status: {
        type: "string",
        required: true,
        defaultValue: "ACTIVE",
        returned: true,
      },
      phoneNumber: {
        type: "string",
        required: false,
        returned: true,
      },
      lastLogin: {
        type: "date",
        required: false,
        returned: true,
      },
      avatar: {
        type: "string",
        required: false,
        returned: true,
      },
    },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: false, // Only super-admin can create
      organizationLimit: 100, // Max organizations
      sendInvitationEmail: async (data) => {
        // TODO: Implement email sending
        console.log("Invitation email:", data);
        return Promise.resolve();
      },
    }),
  ],
  trustedOrigins,
  advanced: {
    // Generate custom session token
    generateId: undefined,
    // Use secure cookies in production, regular cookies in development
    useSecureCookies: process.env.NODE_ENV === "production",
    // Cross-subdomain cookies
    crossSubDomainCookies: {
      enabled: false,
    },
    // Cookie options for better persistence
    defaultCookieAttributes: {
      sameSite: "lax", // Allow cookies on same-site navigation
      httpOnly: true, // Prevent XSS attacks
      path: "/", // Cookie available for all paths
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
    },
  },
  // Explicitly set base URL for cookie domain
  baseURL: process.env.API_URL || "http://localhost:3000",
});

export type Auth = typeof auth;
