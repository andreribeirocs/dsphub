-- Sincroniza o banco com os campos que o better-auth 1.3.x passou a exigir.
-- O schema antigo (gerado por uma versao anterior da lib) nao tinha estas
-- colunas, e por isso o login quebrava com "Prisma schema mismatch".
--
-- Usa IF NOT EXISTS para ser idempotente: pode rodar de novo sem erro.

ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "accessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "refreshTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "scope" TEXT;

ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "metadata" TEXT;
