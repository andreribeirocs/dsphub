-- Migration: Add corporate email field to Driver
-- Description: Adds corporateEmail (nullable) to Driver table
-- Copy to api/prisma/migrations/20260917051000_driver_corporate_email/migration.sql

ALTER TABLE "Driver" ADD COLUMN "corporateEmail" TEXT;

-- Index for lookups
CREATE INDEX "Driver_corporateEmail_idx" ON "Driver"("corporateEmail");
CREATE INDEX "Driver_corporateEmail_organizationId_idx" ON "Driver"("corporateEmail", "organizationId");
