-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('FULL_DAY', 'MORNING', 'EVENING', 'REMOTE', 'VACATION', 'OFF');

-- CreateTable
CREATE TABLE "driver_schedules" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "ScheduleStatus" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_schedules_driverId_date_key" ON "driver_schedules"("driverId", "date");

-- AddForeignKey
ALTER TABLE "driver_schedules" ADD CONSTRAINT "driver_schedules_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
