-- Row-Level Security: second lock for DSP isolation, enforced by PostgreSQL.
--
-- Policies compare each row's organization with the session setting
-- app.current_organization_id, which the API sets on every query
-- (src/tenancy/prisma-tenant.extension.ts). Without the setting, no rows are
-- visible or writable.
--
-- IMPORTANT: PostgreSQL does not apply RLS to superusers, to roles with
-- BYPASSRLS, or to the table owner. Production must connect with a dedicated
-- role such as dsphub_app (see scripts/sql/create-app-role.sql). Local
-- development connecting as "postgres" keeps working, without this lock.
--
-- Not covered on purpose: user, session, account, verification, organization,
-- organization_domain, member and invitation (used by better-auth and by the
-- domain lookup before a DSP is known).

ALTER TABLE "public"."Candidate" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."Candidate";
CREATE POLICY tenant_isolation ON "public"."Candidate"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."Driver" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."Driver";
CREATE POLICY tenant_isolation ON "public"."Driver"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."contracts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."contracts";
CREATE POLICY tenant_isolation ON "public"."contracts"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."depot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."depot";
CREATE POLICY tenant_isolation ON "public"."depot"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."driver_invoices" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."driver_invoices";
CREATE POLICY tenant_isolation ON "public"."driver_invoices"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."driver_payments" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."driver_payments";
CREATE POLICY tenant_isolation ON "public"."driver_payments"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."maintenance_records" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."maintenance_records";
CREATE POLICY tenant_isolation ON "public"."maintenance_records"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."parts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."parts";
CREATE POLICY tenant_isolation ON "public"."parts"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."route_prices" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."route_prices";
CREATE POLICY tenant_isolation ON "public"."route_prices"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."vans" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."vans";
CREATE POLICY tenant_isolation ON "public"."vans"
  USING ("organizationId" = current_setting('app.current_organization_id', true))
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true));

ALTER TABLE "public"."driver_schedules" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."driver_schedules";
CREATE POLICY tenant_isolation ON "public"."driver_schedules"
  USING (EXISTS (
    SELECT 1 FROM "public"."Driver" p
    WHERE p."id" = "driver_schedules"."driverId"
      AND p."organizationId" = current_setting('app.current_organization_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "public"."Driver" p
    WHERE p."id" = "driver_schedules"."driverId"
      AND p."organizationId" = current_setting('app.current_organization_id', true)
  ));

ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."invoice_items";
CREATE POLICY tenant_isolation ON "public"."invoice_items"
  USING (EXISTS (
    SELECT 1 FROM "public"."driver_invoices" p
    WHERE p."id" = "invoice_items"."invoiceId"
      AND p."organizationId" = current_setting('app.current_organization_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "public"."driver_invoices" p
    WHERE p."id" = "invoice_items"."invoiceId"
      AND p."organizationId" = current_setting('app.current_organization_id', true)
  ));

ALTER TABLE "public"."payment_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."payment_history";
CREATE POLICY tenant_isolation ON "public"."payment_history"
  USING (EXISTS (
    SELECT 1 FROM "public"."route_prices" p
    WHERE p."id" = "payment_history"."routePriceId"
      AND p."organizationId" = current_setting('app.current_organization_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "public"."route_prices" p
    WHERE p."id" = "payment_history"."routePriceId"
      AND p."organizationId" = current_setting('app.current_organization_id', true)
  ));

ALTER TABLE "public"."member_depot" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "public"."member_depot";
CREATE POLICY tenant_isolation ON "public"."member_depot"
  USING (EXISTS (
    SELECT 1 FROM "public"."depot" p
    WHERE p."id" = "member_depot"."depotId"
      AND p."organizationId" = current_setting('app.current_organization_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "public"."depot" p
    WHERE p."id" = "member_depot"."depotId"
      AND p."organizationId" = current_setting('app.current_organization_id', true)
  ));
