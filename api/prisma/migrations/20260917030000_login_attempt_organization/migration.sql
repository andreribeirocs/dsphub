-- AlterTable
ALTER TABLE "public"."login_attempts" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "login_attempts_organizationId_attemptedAt_idx" ON "public"."login_attempts"("organizationId", "attemptedAt");

-- AddForeignKey
ALTER TABLE "public"."login_attempts" ADD CONSTRAINT "login_attempts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

