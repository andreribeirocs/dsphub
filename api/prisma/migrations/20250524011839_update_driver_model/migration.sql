/*
  Warnings:

  - Added the required column `age` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `citizenship` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `depot` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `email` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `joinDate` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastCheck` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nextCheck` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `passportExpiry` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rtwExpiry` to the `Driver` table without a default value. This is not possible if the table is not empty.
  - Made the column `licenseExpiry` on table `Driver` required. This step will fail if there are existing NULL values in that column.
  - Made the column `address` on table `Driver` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "age" INTEGER NOT NULL,
ADD COLUMN     "citizenship" TEXT NOT NULL,
ADD COLUMN     "completionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "dbsStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "depot" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "hasEndorsements" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joinDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "lastCheck" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "licenseStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "medicalStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "nextCheck" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "passportExpiry" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "passportStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "rtwExpiry" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "rtwStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "totalTrips" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "contractType" DROP NOT NULL,
ALTER COLUMN "licenseExpiry" SET NOT NULL,
ALTER COLUMN "address" SET NOT NULL;
