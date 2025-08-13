/*
  Warnings:

  - The values [FULL_DAY,MORNING,EVENING,REMOTE,VACATION] on the enum `ScheduleStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ScheduleStatus_new" AS ENUM ('FULL_ROUTE', 'OFF', 'HOLIDAY', 'RIDE_ALONG', 'TRAINING_DAY', 'SAME_DAY', 'NURSERY_ROUTE');
ALTER TABLE "driver_schedules" ALTER COLUMN "status" TYPE "ScheduleStatus_new" USING ("status"::text::"ScheduleStatus_new");
ALTER TYPE "ScheduleStatus" RENAME TO "ScheduleStatus_old";
ALTER TYPE "ScheduleStatus_new" RENAME TO "ScheduleStatus";
DROP TYPE "ScheduleStatus_old";
COMMIT;
