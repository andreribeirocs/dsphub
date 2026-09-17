-- CreateEnum
CREATE TYPE "public"."OperatingModel" AS ENUM ('DSP_1_0', 'DSP_2_0');

-- AlterTable
ALTER TABLE "public"."Driver" ADD COLUMN     "homeDepotId" TEXT;

-- AlterTable
ALTER TABLE "public"."driver_payments" ADD COLUMN     "depotId" TEXT;

-- AlterTable
ALTER TABLE "public"."organization" ADD COLUMN     "operatingModel" "public"."OperatingModel" NOT NULL DEFAULT 'DSP_1_0';

-- AlterTable
ALTER TABLE "public"."vans" ADD COLUMN     "depotId" TEXT;

-- CreateTable
CREATE TABLE "public"."depot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "postcode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "depot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."member_depot" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "depotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "member_depot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "depot_organizationId_idx" ON "public"."depot"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "depot_organizationId_code_key" ON "public"."depot"("organizationId", "code");

-- CreateIndex
CREATE INDEX "member_depot_depotId_idx" ON "public"."member_depot"("depotId");

-- CreateIndex
CREATE UNIQUE INDEX "member_depot_memberId_depotId_key" ON "public"."member_depot"("memberId", "depotId");

-- CreateIndex
CREATE INDEX "Driver_homeDepotId_idx" ON "public"."Driver"("homeDepotId");

-- AddForeignKey
ALTER TABLE "public"."depot" ADD CONSTRAINT "depot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member_depot" ADD CONSTRAINT "member_depot_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "public"."member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."member_depot" ADD CONSTRAINT "member_depot_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "public"."depot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Driver" ADD CONSTRAINT "Driver_homeDepotId_fkey" FOREIGN KEY ("homeDepotId") REFERENCES "public"."depot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_payments" ADD CONSTRAINT "driver_payments_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "public"."depot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vans" ADD CONSTRAINT "vans_depotId_fkey" FOREIGN KEY ("depotId") REFERENCES "public"."depot"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Data migration: turn the free-text depot names into Depot rows per DSP and
-- link drivers, vans and payments to them. Codes are derived from the name
-- (upper case, letters and digits only) and can be edited later in Settings.
-- ---------------------------------------------------------------------------
WITH names AS (
  SELECT "organizationId" AS org, btrim("depot") AS name FROM "public"."Driver" WHERE btrim(coalesce("depot", '')) <> ''
  UNION
  SELECT "organizationId", btrim("depot") FROM "public"."vans" WHERE btrim(coalesce("depot", '')) <> ''
  UNION
  SELECT "organizationId", btrim("depot") FROM "public"."driver_payments" WHERE btrim(coalesce("depot", '')) <> ''
),
distinct_names AS (
  SELECT org, min(name) AS name, upper(regexp_replace(name, '[^A-Za-z0-9]', '', 'g')) AS code
  FROM names
  GROUP BY org, upper(regexp_replace(name, '[^A-Za-z0-9]', '', 'g'))
)
INSERT INTO "public"."depot" ("id", "organizationId", "code", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, org, CASE WHEN code = '' THEN 'DEPOT' ELSE left(code, 20) END, name, true, now(), now()
FROM distinct_names
ON CONFLICT ("organizationId", "code") DO NOTHING;

UPDATE "public"."Driver" d
SET "homeDepotId" = dp."id"
FROM "public"."depot" dp
WHERE dp."organizationId" = d."organizationId"
  AND dp."code" = left(upper(regexp_replace(btrim(d."depot"), '[^A-Za-z0-9]', '', 'g')), 20)
  AND d."homeDepotId" IS NULL;

UPDATE "public"."vans" v
SET "depotId" = dp."id"
FROM "public"."depot" dp
WHERE dp."organizationId" = v."organizationId"
  AND dp."code" = left(upper(regexp_replace(btrim(v."depot"), '[^A-Za-z0-9]', '', 'g')), 20)
  AND v."depotId" IS NULL;

UPDATE "public"."driver_payments" p
SET "depotId" = dp."id"
FROM "public"."depot" dp
WHERE dp."organizationId" = p."organizationId"
  AND dp."code" = left(upper(regexp_replace(btrim(p."depot"), '[^A-Za-z0-9]', '', 'g')), 20)
  AND p."depotId" IS NULL;

-- Avatars are no longer served from the public /uploads route
UPDATE "public"."user"
SET "avatar" = '/api' || "avatar"
WHERE "avatar" LIKE '/uploads/avatars/%';
