-- CreateTable
CREATE TABLE "service_type" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hours" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_type_organizationId_idx" ON "service_type"("organizationId");

-- CreateIndex
CREATE INDEX "service_type_organizationId_isActive_idx" ON "service_type"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "service_type_organizationId_code_key" ON "service_type"("organizationId", "code");

-- AddForeignKey
ALTER TABLE "service_type" ADD CONSTRAINT "service_type_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every DSP starts with the service types the system already knows.
-- Read straight from the RouteType enum rather than a hand-typed list, so no
-- value can be missed or mistyped. `hours` is left NULL on purpose: nobody has
-- stated the paid hours per type, and the Settings screen is where they go.
INSERT INTO "service_type" ("id", "organizationId", "code", "name", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  o."id",
  t.code,
  initcap(replace(t.code, '_', ' ')),
  t.ord::int,
  NOW(),
  NOW()
FROM "organization" o
CROSS JOIN (
  SELECT e.enumlabel AS code,
         row_number() OVER (ORDER BY e.enumsortorder) AS ord
  FROM pg_enum e
  JOIN pg_type ty ON ty.oid = e.enumtypid
  WHERE ty.typname = 'RouteType'
) t
ON CONFLICT ("organizationId", "code") DO NOTHING;

-- Row-Level Security: same second lock as every other tenant table
-- (see 20260917020000_row_level_security).
ALTER TABLE "public"."service_type" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."service_type";
CREATE POLICY tenant_isolation ON "public"."service_type"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));
