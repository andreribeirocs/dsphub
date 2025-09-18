-- AlterTable
ALTER TABLE "public"."Candidate" ADD COLUMN     "account" TEXT,
ADD COLUMN     "age" INTEGER,
ADD COLUMN     "citizenship" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "documentNumber" TEXT,
ADD COLUMN     "formCompleted" BOOLEAN DEFAULT false,
ADD COLUMN     "lastCheck" TIMESTAMP(3),
ADD COLUMN     "lastCheckOn" TIMESTAMP(3),
ADD COLUMN     "licenceExpiry" TIMESTAMP(3),
ADD COLUMN     "nextDVLA" TIMESTAMP(3),
ADD COLUMN     "passportVisaExpiry" TIMESTAMP(3),
ADD COLUMN     "points" INTEGER DEFAULT 0,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "rtwExpiry" TIMESTAMP(3),
ADD COLUMN     "sla" TEXT;

-- CreateIndex
CREATE INDEX "Candidate_dateOfBirth_idx" ON "public"."Candidate"("dateOfBirth");

-- CreateIndex
CREATE INDEX "Candidate_citizenship_idx" ON "public"."Candidate"("citizenship");

-- CreateIndex
CREATE INDEX "Candidate_postalCode_idx" ON "public"."Candidate"("postalCode");

-- CreateIndex
CREATE INDEX "Candidate_documentNumber_idx" ON "public"."Candidate"("documentNumber");

-- CreateIndex
CREATE INDEX "Candidate_passportVisaExpiry_idx" ON "public"."Candidate"("passportVisaExpiry");

-- CreateIndex
CREATE INDEX "Candidate_rtwExpiry_idx" ON "public"."Candidate"("rtwExpiry");

-- CreateIndex
CREATE INDEX "Candidate_licenceExpiry_idx" ON "public"."Candidate"("licenceExpiry");

-- CreateIndex
CREATE INDEX "Candidate_nextDVLA_idx" ON "public"."Candidate"("nextDVLA");

-- CreateIndex
CREATE INDEX "Candidate_lastCheck_idx" ON "public"."Candidate"("lastCheck");
