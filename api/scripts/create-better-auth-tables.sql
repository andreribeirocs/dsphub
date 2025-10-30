-- Create Better Auth tables first
-- This must be run before the data migration script

-- Add new enum values
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'OWNER';

-- Create Better Auth user table
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
  CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_key" ON "user"("email");
CREATE INDEX IF NOT EXISTS "user_role_idx" ON "user"("role");
CREATE INDEX IF NOT EXISTS "user_status_idx" ON "user"("status");
CREATE INDEX IF NOT EXISTS "user_lastLogin_idx" ON "user"("lastLogin");
CREATE INDEX IF NOT EXISTS "user_createdAt_idx" ON "user"("createdAt");

-- Create session table
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
  CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_token_key" ON "session"("token");
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");
CREATE INDEX IF NOT EXISTS "session_token_idx" ON "session"("token");

ALTER TABLE "session" DROP CONSTRAINT IF EXISTS "session_userId_fkey";
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create account table
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
  CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_providerId_accountId_key" ON "account"("providerId", "accountId");
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");

ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "account_userId_fkey";
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create verification table
CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "verification_identifier_value_key" ON "verification"("identifier", "value");

-- Create organization table
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
  CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_slug_key" ON "organization"("slug");
CREATE INDEX IF NOT EXISTS "organization_slug_idx" ON "organization"("slug");
CREATE INDEX IF NOT EXISTS "organization_isActive_idx" ON "organization"("isActive");

-- Create member table
CREATE TABLE IF NOT EXISTS "member" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "member_organizationId_userId_key" ON "member"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "member_userId_idx" ON "member"("userId");

ALTER TABLE "member" DROP CONSTRAINT IF EXISTS "member_organizationId_fkey";
ALTER TABLE "member" ADD CONSTRAINT "member_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member" DROP CONSTRAINT IF EXISTS "member_userId_fkey";
ALTER TABLE "member" ADD CONSTRAINT "member_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create invitation table
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
  CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "invitation_organizationId_email_key" ON "invitation"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "invitation_email_idx" ON "invitation"("email");

ALTER TABLE "invitation" DROP CONSTRAINT IF EXISTS "invitation_organizationId_fkey";
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organizationId_fkey" 
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

