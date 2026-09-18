-- Driver identity across comings and goings.
--
-- The Driver row becomes THE PERSON and stays forever. Each engagement is a
-- row in driver_stints with its own login and its own transporter ID, so a
-- person who leaves and returns keeps one payment, schedule and invoice
-- history instead of splitting into two strangers.
--
-- Additive except for one column: Driver."transporterId" becomes nullable,
-- because Amazon only issues it on activation and somebody in classroom does
-- not have one yet. Existing rows keep their value; nothing is dropped.

-- 1. transporterId only exists once the driver is active ---------------------
ALTER TABLE "public"."Driver" ALTER COLUMN "transporterId" DROP NOT NULL;

-- The NIN is what recognises the same person across a new email and a new
-- transporter ID, so it has to be searchable.
CREATE INDEX IF NOT EXISTS "Driver_organizationId_insuranceNumber_idx"
  ON "public"."Driver"("organizationId", "insuranceNumber");

-- 2. Enums -------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "public"."DriverExitReason" AS ENUM (
    'RESIGNED', 'DISMISSED', 'ABSENTEEISM', 'PERFORMANCE',
    'PERSONAL', 'END_OF_CONTRACT', 'NO_SHOW', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "public"."DriverDocumentType" AS ENUM (
    'PASSPORT', 'VISA', 'RIGHT_TO_WORK', 'DRIVING_LICENCE', 'DBS',
    'MEDICAL', 'PROOF_OF_ADDRESS', 'NATIONAL_INSURANCE', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. One row per engagement --------------------------------------------------
CREATE TABLE "public"."driver_stints" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "driverId"       TEXT NOT NULL,
  "userId"         TEXT,
  "transporterId"  TEXT,
  "candidateId"    TEXT,
  "startDate"      TIMESTAMP(3) NOT NULL,
  "endDate"        TIMESTAMP(3),
  "exitReason"     "public"."DriverExitReason",
  "exitNotes"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "driver_stints_pkey" PRIMARY KEY ("id")
);

-- Several NULLs are allowed by Postgres, which is what lets many people be in
-- onboarding at once without a transporter ID.
CREATE UNIQUE INDEX "driver_stints_organizationId_transporterId_key"
  ON "public"."driver_stints"("organizationId", "transporterId");
CREATE INDEX "driver_stints_organizationId_idx" ON "public"."driver_stints"("organizationId");
CREATE INDEX "driver_stints_driverId_idx" ON "public"."driver_stints"("driverId");
CREATE INDEX "driver_stints_driverId_startDate_idx" ON "public"."driver_stints"("driverId", "startDate");
CREATE INDEX "driver_stints_candidateId_idx" ON "public"."driver_stints"("candidateId");

ALTER TABLE "public"."driver_stints"
  ADD CONSTRAINT "driver_stints_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."driver_stints"
  ADD CONSTRAINT "driver_stints_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Every version of every document, never overwritten ----------------------
CREATE TABLE "public"."driver_documents" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "driverId"       TEXT NOT NULL,
  "stintId"        TEXT,
  "type"           "public"."DriverDocumentType" NOT NULL,
  "number"         TEXT,
  "issuedAt"       TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3),
  "status"         TEXT NOT NULL DEFAULT 'PENDING',
  "fileRef"        TEXT,
  "collectedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "collectedById"  TEXT,
  "supersededAt"   TIMESTAMP(3),
  "notes"          TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "driver_documents_organizationId_idx" ON "public"."driver_documents"("organizationId");
CREATE INDEX "driver_documents_driverId_idx" ON "public"."driver_documents"("driverId");
-- supersededAt IS NULL is "the current copy"; this index serves that lookup
CREATE INDEX "driver_documents_driverId_type_supersededAt_idx"
  ON "public"."driver_documents"("driverId", "type", "supersededAt");
CREATE INDEX "driver_documents_expiresAt_idx" ON "public"."driver_documents"("expiresAt");

ALTER TABLE "public"."driver_documents"
  ADD CONSTRAINT "driver_documents_driverId_fkey"
  FOREIGN KEY ("driverId") REFERENCES "public"."Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."driver_documents"
  ADD CONSTRAINT "driver_documents_stintId_fkey"
  FOREIGN KEY ("stintId") REFERENCES "public"."driver_stints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."driver_documents"
  ADD CONSTRAINT "driver_documents_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Same tenant isolation as every other table ------------------------------
ALTER TABLE "public"."driver_stints" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."driver_stints";
CREATE POLICY tenant_isolation ON "public"."driver_stints"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."driver_documents" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."driver_documents";
CREATE POLICY tenant_isolation ON "public"."driver_documents"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

-- 6. Backfill: every active driver gets the stint they are already living ----
-- Without this, existing drivers would have no engagement at all and every
-- report that reads stints would show them as never having worked here.
INSERT INTO "public"."driver_stints"
  ("id", "organizationId", "driverId", "userId", "transporterId", "startDate", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  d."organizationId",
  d."id",
  d."userId",
  d."transporterId",
  COALESCE(d."joinDate", d."createdAt"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "public"."Driver" d
WHERE NOT EXISTS (
  SELECT 1 FROM "public"."driver_stints" s WHERE s."driverId" = d."id"
);
