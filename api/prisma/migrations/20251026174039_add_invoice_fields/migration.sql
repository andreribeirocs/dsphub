-- AlterTable
ALTER TABLE "public"."driver_payments" ADD COLUMN     "awayDriver" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "awayDriverAmount" DECIMAL(6,2),
ADD COLUMN     "byod" DECIMAL(6,2),
ADD COLUMN     "deliveryServiceType" TEXT,
ADD COLUMN     "depot" TEXT,
ADD COLUMN     "incentive" DECIMAL(6,2),
ADD COLUMN     "mileage" DECIMAL(6,2),
ADD COLUMN     "mileageCost" DECIMAL(6,2),
ADD COLUMN     "weekNumber" INTEGER;

-- AlterTable
ALTER TABLE "public"."organization" ADD COLUMN     "companyRegNumber" TEXT,
ADD COLUMN     "depots" JSONB,
ADD COLUMN     "invoiceFooter" TEXT,
ADD COLUMN     "invoicePrefix" TEXT DEFAULT 'INV',
ADD COLUMN     "vatNumber" TEXT;

-- CreateIndex
CREATE INDEX "driver_payments_depot_idx" ON "public"."driver_payments"("depot");

-- CreateIndex
CREATE INDEX "driver_payments_weekNumber_idx" ON "public"."driver_payments"("weekNumber");
