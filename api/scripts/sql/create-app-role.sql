-- Dedicated database role for the DSPHub API, so PostgreSQL Row-Level Security
-- applies (superusers and table owners bypass it).
--
-- Run once as an administrator (e.g. psql -U postgres -d dsphub -f this file),
-- then set a password and point DATABASE_URL at this role:
--   ALTER ROLE dsphub_app PASSWORD '<choose a strong password>';
--   DATABASE_URL="postgresql://dsphub_app:<password>@localhost:5432/dsphub"
-- Migrations keep running with the owner/admin role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dsphub_app') THEN
    CREATE ROLE dsphub_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO dsphub_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dsphub_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO dsphub_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dsphub_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dsphub_app;
