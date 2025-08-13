-- CreateEnum
CREATE TYPE "VanStatus" AS ENUM ('BOOKED', 'DELIVERED', 'TBC', 'AVAILABLE', 'MAINTENANCE', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "VanCondition" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'NEEDS_ATTENTION');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'REMOVED', 'BROKEN_DOWN', 'SUSPENDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateTable
CREATE TABLE "vans" (
    "id" TEXT NOT NULL,
    "vanNumber" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "status" "VanStatus" NOT NULL DEFAULT 'AVAILABLE',
    "condition" "VanCondition" NOT NULL DEFAULT 'GOOD',
    "motExpiry" TIMESTAMP(3),
    "motReminder" BOOLEAN NOT NULL DEFAULT true,
    "contractId" TEXT,
    "monthlyRental" DECIMAL(8,2),
    "vin" TEXT,
    "engineNumber" TEXT,
    "fuelType" TEXT,
    "capacity" TEXT,
    "depot" TEXT,
    "assignedDriver" TEXT,
    "mileage" INTEGER DEFAULT 0,
    "lastService" TIMESTAMP(3),
    "nextService" TIMESTAMP(3),
    "comments" TEXT,
    "insuranceDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "depot" TEXT NOT NULL,
    "hireName" TEXT NOT NULL,
    "rentalRate" DECIMAL(8,2) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "hasInsurance" BOOLEAN NOT NULL DEFAULT false,
    "supplier" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "description" TEXT,
    "terms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "vanId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "estimatedCost" DECIMAL(8,2),
    "actualCost" DECIMAL(8,2),
    "workshop" TEXT,
    "workshopContact" TEXT,
    "partsUsed" JSONB,
    "laborHours" DECIMAL(4,2),
    "notes" TEXT,
    "invoiceNumber" TEXT,
    "warrantyUntil" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "fordPrice" DECIMAL(8,2),
    "mercedesPrice" DECIMAL(8,2),
    "peugeotPrice" DECIMAL(8,2),
    "partNumber" TEXT,
    "supplier" TEXT,
    "description" TEXT,
    "stockLevel" INTEGER NOT NULL DEFAULT 0,
    "minStockLevel" INTEGER NOT NULL DEFAULT 0,
    "maxStockLevel" INTEGER NOT NULL DEFAULT 100,
    "weight" DECIMAL(8,3),
    "dimensions" TEXT,
    "warrantyDays" INTEGER DEFAULT 365,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vans_vanNumber_key" ON "vans"("vanNumber");

-- CreateIndex
CREATE UNIQUE INDEX "vans_registration_key" ON "vans"("registration");

-- CreateIndex
CREATE UNIQUE INDEX "vans_vin_key" ON "vans"("vin");

-- CreateIndex
CREATE INDEX "vans_vanNumber_idx" ON "vans"("vanNumber");

-- CreateIndex
CREATE INDEX "vans_registration_idx" ON "vans"("registration");

-- CreateIndex
CREATE INDEX "vans_status_idx" ON "vans"("status");

-- CreateIndex
CREATE INDEX "vans_condition_idx" ON "vans"("condition");

-- CreateIndex
CREATE INDEX "vans_motExpiry_idx" ON "vans"("motExpiry");

-- CreateIndex
CREATE INDEX "vans_contractId_idx" ON "vans"("contractId");

-- CreateIndex
CREATE INDEX "vans_depot_idx" ON "vans"("depot");

-- CreateIndex
CREATE INDEX "vans_status_condition_idx" ON "vans"("status", "condition");

-- CreateIndex
CREATE INDEX "vans_depot_status_idx" ON "vans"("depot", "status");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_name_key" ON "contracts"("name");

-- CreateIndex
CREATE INDEX "contracts_name_idx" ON "contracts"("name");

-- CreateIndex
CREATE INDEX "contracts_depot_idx" ON "contracts"("depot");

-- CreateIndex
CREATE INDEX "contracts_status_idx" ON "contracts"("status");

-- CreateIndex
CREATE INDEX "contracts_startDate_idx" ON "contracts"("startDate");

-- CreateIndex
CREATE INDEX "contracts_endDate_idx" ON "contracts"("endDate");

-- CreateIndex
CREATE INDEX "contracts_depot_status_idx" ON "contracts"("depot", "status");

-- CreateIndex
CREATE INDEX "maintenance_records_vanId_idx" ON "maintenance_records"("vanId");

-- CreateIndex
CREATE INDEX "maintenance_records_status_idx" ON "maintenance_records"("status");

-- CreateIndex
CREATE INDEX "maintenance_records_priority_idx" ON "maintenance_records"("priority");

-- CreateIndex
CREATE INDEX "maintenance_records_scheduledDate_idx" ON "maintenance_records"("scheduledDate");

-- CreateIndex
CREATE INDEX "maintenance_records_type_idx" ON "maintenance_records"("type");

-- CreateIndex
CREATE INDEX "maintenance_records_vanId_status_idx" ON "maintenance_records"("vanId", "status");

-- CreateIndex
CREATE INDEX "maintenance_records_scheduledDate_status_idx" ON "maintenance_records"("scheduledDate", "status");

-- CreateIndex
CREATE INDEX "parts_name_idx" ON "parts"("name");

-- CreateIndex
CREATE INDEX "parts_category_idx" ON "parts"("category");

-- CreateIndex
CREATE INDEX "parts_partNumber_idx" ON "parts"("partNumber");

-- CreateIndex
CREATE INDEX "parts_isActive_idx" ON "parts"("isActive");

-- CreateIndex
CREATE INDEX "parts_stockLevel_idx" ON "parts"("stockLevel");

-- CreateIndex
CREATE INDEX "parts_category_isActive_idx" ON "parts"("category", "isActive");

-- AddForeignKey
ALTER TABLE "vans" ADD CONSTRAINT "vans_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_vanId_fkey" FOREIGN KEY ("vanId") REFERENCES "vans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
