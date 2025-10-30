import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Step 1: Creating Better Auth tables...\n");

  try {
    // Add new enum values
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' AND e.enumlabel = 'SUPER_ADMIN') THEN
          ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'UserRole' AND e.enumlabel = 'OWNER') THEN
          ALTER TYPE "UserRole" ADD VALUE 'OWNER';
        END IF;
      END $$;
    `);
    console.log("✓ Added new UserRole enum values");

    // Create user table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "user" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "emailVerified" BOOLEAN NOT NULL DEFAULT false,
        "name" TEXT NOT NULL,
        "image" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "role" "UserRole" NOT NULL DEFAULT 'DRIVER',
        "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
        "phoneNumber" TEXT,
        "lastLogin" TIMESTAMP(3),
        "avatar" TEXT,
        CONSTRAINT "user_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "user_email_key" UNIQUE ("email")
      );
    `);
    console.log("✓ Created user table");

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user"("role");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "user_status_idx" ON "user"("status");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "user_lastLogin_idx" ON "user"("lastLogin");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "user_createdAt_idx" ON "user"("createdAt");`
    );
    console.log("✓ Created user indexes");

    // Create session table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "session" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "token" TEXT NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "activeOrganizationId" TEXT,
        CONSTRAINT "session_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "session_token_key" UNIQUE ("token")
      );
    `);
    console.log("✓ Created session table");

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "session_token_idx" ON "session"("token");`
    );
    console.log("✓ Created session indexes");

    // Create account table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "account" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "expiresAt" TIMESTAMP(3),
        "password" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "account_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "account_providerId_accountId_key" UNIQUE ("providerId", "accountId")
      );
    `);
    console.log("✓ Created account table");

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");`
    );
    console.log("✓ Created account indexes");

    // Create verification table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "verification" (
        "id" TEXT NOT NULL,
        "identifier" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "verification_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "verification_identifier_value_key" UNIQUE ("identifier", "value")
      );
    `);
    console.log("✓ Created verification table");

    // Create organization table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "organization" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "logo" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "address" TEXT,
        "city" TEXT,
        "postcode" TEXT,
        "country" TEXT DEFAULT 'United Kingdom',
        "phone" TEXT,
        "email" TEXT,
        "website" TEXT,
        "taxId" TEXT,
        "registrationNumber" TEXT,
        "logoBase64" TEXT,
        "bankName" TEXT,
        "bankAccountNumber" TEXT,
        "bankSortCode" TEXT,
        "iban" TEXT,
        "swiftCode" TEXT,
        "termsAndConditions" TEXT,
        "footerText" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        CONSTRAINT "organization_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "organization_slug_key" UNIQUE ("slug")
      );
    `);
    console.log("✓ Created organization table");

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "organization_slug_idx" ON "organization"("slug");`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "organization_isActive_idx" ON "organization"("isActive");`
    );
    console.log("✓ Created organization indexes");

    // Create member table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "member" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "member_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "member_organizationId_userId_key" UNIQUE ("organizationId", "userId")
      );
    `);
    console.log("✓ Created member table");

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "member_userId_idx" ON "member"("userId");`
    );
    console.log("✓ Created member indexes");

    // Create invitation table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "invitation" (
        "id" TEXT NOT NULL,
        "organizationId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "role" TEXT,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "inviterId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "invitation_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "invitation_organizationId_email_key" UNIQUE ("organizationId", "email")
      );
    `);
    console.log("✓ Created invitation table");

    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "invitation"("email");`
    );
    console.log("✓ Created invitation indexes");

    console.log("\n✅ All Better Auth tables created successfully!\n");
  } catch (error: any) {
    console.error("❌ Error creating tables:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
