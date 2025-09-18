-- DropIndex
DROP INDEX "public"."driver_payments_driverId_workDate_key";

-- AlterTable
ALTER TABLE "public"."driver_payments" ADD COLUMN     "helperFor" TEXT,
ADD COLUMN     "isHelper" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "driver_payments_driverId_workDate_idx" ON "public"."driver_payments"("driverId", "workDate");

-- CreateIndex
CREATE INDEX "driver_payments_helperFor_idx" ON "public"."driver_payments"("helperFor");

-- CreateIndex
CREATE INDEX "driver_payments_isHelper_idx" ON "public"."driver_payments"("isHelper");
