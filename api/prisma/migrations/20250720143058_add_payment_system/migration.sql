/*
  Warnings:

  - A unique constraint covering the columns `[transporterId]` on the table `Driver` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `transporterId` to the `Driver` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RouteType" AS ENUM ('FULL_ROUTE', 'HIDE_ALONG', 'TRAINING_DAY', 'SAME_DAY', 'NURSERY_ROUTE', 'EXTRAS');

-- Add transporterId column as nullable first
ALTER TABLE "Driver" ADD COLUMN "transporterId" TEXT;

-- Generate unique transporter IDs for existing drivers
UPDATE "Driver" 
SET "transporterId" = 'TR' || UPPER(SUBSTR(REPLACE(CAST(gen_random_uuid() AS TEXT), '-', ''), 1, 10))
WHERE "transporterId" IS NULL;

-- Now make the column NOT NULL
ALTER TABLE "Driver" ALTER COLUMN "transporterId" SET NOT NULL;

-- CreateTable
CREATE TABLE "route_prices" (
    "id" TEXT NOT NULL,
    "routeType" "RouteType" NOT NULL,
    "dailyRate" DECIMAL(8,2) NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "route_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_history" (
    "id" TEXT NOT NULL,
    "routePriceId" TEXT NOT NULL,
    "routeType" "RouteType" NOT NULL,
    "oldRate" DECIMAL(8,2),
    "newRate" DECIMAL(8,2) NOT NULL,
    "changeReason" TEXT,
    "changedBy" TEXT NOT NULL,
    "changeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_payments" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "routeType" "RouteType" NOT NULL,
    "dailyRate" DECIMAL(8,2) NOT NULL,
    "hoursWorked" DECIMAL(4,2),
    "totalPaid" DECIMAL(8,2) NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidDate" TIMESTAMP(3),
    "paidBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "route_prices_routeType_key" ON "route_prices"("routeType");

-- CreateIndex
CREATE INDEX "route_prices_routeType_idx" ON "route_prices"("routeType");

-- CreateIndex
CREATE INDEX "route_prices_lastUpdated_idx" ON "route_prices"("lastUpdated");

-- CreateIndex
CREATE INDEX "route_prices_updatedBy_idx" ON "route_prices"("updatedBy");

-- CreateIndex
CREATE INDEX "payment_history_routePriceId_idx" ON "payment_history"("routePriceId");

-- CreateIndex
CREATE INDEX "payment_history_routeType_idx" ON "payment_history"("routeType");

-- CreateIndex
CREATE INDEX "payment_history_changeDate_idx" ON "payment_history"("changeDate");

-- CreateIndex
CREATE INDEX "payment_history_changedBy_idx" ON "payment_history"("changedBy");

-- CreateIndex
CREATE INDEX "driver_payments_driverId_idx" ON "driver_payments"("driverId");

-- CreateIndex
CREATE INDEX "driver_payments_workDate_idx" ON "driver_payments"("workDate");

-- CreateIndex
CREATE INDEX "driver_payments_routeType_idx" ON "driver_payments"("routeType");

-- CreateIndex
CREATE INDEX "driver_payments_isPaid_idx" ON "driver_payments"("isPaid");

-- CreateIndex
CREATE INDEX "driver_payments_paidDate_idx" ON "driver_payments"("paidDate");

-- CreateIndex
CREATE INDEX "driver_payments_paidBy_idx" ON "driver_payments"("paidBy");

-- CreateIndex
CREATE INDEX "driver_payments_workDate_routeType_idx" ON "driver_payments"("workDate", "routeType");

-- CreateIndex
CREATE UNIQUE INDEX "driver_payments_driverId_workDate_key" ON "driver_payments"("driverId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_transporterId_key" ON "Driver"("transporterId");

-- CreateIndex
CREATE INDEX "Driver_transporterId_idx" ON "Driver"("transporterId");

-- AddForeignKey
ALTER TABLE "route_prices" ADD CONSTRAINT "route_prices_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_routePriceId_fkey" FOREIGN KEY ("routePriceId") REFERENCES "route_prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_history" ADD CONSTRAINT "payment_history_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_payments" ADD CONSTRAINT "driver_payments_paidBy_fkey" FOREIGN KEY ("paidBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert default route prices (will be updated by financial managers)
-- First, try to get a director, if not found, get any user, if no users exist, we'll handle this in the seed
DO $$
DECLARE
    admin_user_id TEXT;
BEGIN
    SELECT id INTO admin_user_id FROM "User" WHERE role = 'DIRECTOR' LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        SELECT id INTO admin_user_id FROM "User" LIMIT 1;
    END IF;
    
    IF admin_user_id IS NOT NULL THEN
        INSERT INTO "route_prices" ("id", "routeType", "dailyRate", "updatedBy", "updatedAt") VALUES
        (gen_random_uuid(), 'FULL_ROUTE', 25.00, admin_user_id, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'HIDE_ALONG', 15.00, admin_user_id, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'TRAINING_DAY', 20.00, admin_user_id, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'SAME_DAY', 30.00, admin_user_id, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'NURSERY_ROUTE', 22.00, admin_user_id, CURRENT_TIMESTAMP),
        (gen_random_uuid(), 'EXTRAS', 18.00, admin_user_id, CURRENT_TIMESTAMP);
    END IF;
END $$;
