-- Migration: Add candidate pipeline tracking fields
-- Description: Adds contato_inicial, mini_entrevista_resultado, teste_treinamento_resultado to Candidate
-- This is a scaffold — copy to api/prisma/migrations/20260917050000_candidate_pipeline_fields/migration.sql

ALTER TABLE "Candidate" ADD COLUMN "contato_inicial" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Candidate" ADD COLUMN "mini_entrevista_resultado" TEXT;
ALTER TABLE "Candidate" ADD COLUMN "teste_treinamento_resultado" TEXT;

-- Audit trail tracking (if implementing detailed audit)
-- Indices to support filtering by these fields
CREATE INDEX "Candidate_contato_inicial_organizationId_idx" ON "Candidate"("contato_inicial", "organizationId");
CREATE INDEX "Candidate_teste_treinamento_resultado_organizationId_idx" ON "Candidate"("teste_treinamento_resultado", "organizationId");
