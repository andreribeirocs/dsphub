-- AlterTable
ALTER TABLE "driver_payments" ADD COLUMN     "deductionAmount" DECIMAL(8,2),
ADD COLUMN     "extraAmount" DECIMAL(8,2),
ADD COLUMN     "routeCode" TEXT,
ADD COLUMN     "sourceSheet" TEXT,
ADD COLUMN     "vanCharge" DECIMAL(8,2);
