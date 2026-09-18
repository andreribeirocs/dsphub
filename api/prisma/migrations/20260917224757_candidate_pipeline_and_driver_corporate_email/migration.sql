-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "initialContactDone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "miniInterviewResult" TEXT,
ADD COLUMN     "trainingTestResult" TEXT;

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "corporateEmail" TEXT;
