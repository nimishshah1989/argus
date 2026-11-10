-- Schema v1.1 — the application login role.
--
-- The server connects as `app_api`: a LOGIN role that is a member of `app_user` (the
-- least-privilege table/function grants) and, crucially, has NO BYPASSRLS. Until now the
-- server and tests connected as the table owner / container superuser, which bypasses
-- row-level security, so `tenant_id` isolation was only as good as each handwritten WHERE
-- clause. `app_api` puts the database guard back on the real request path.
--
-- No password is set here (and none should ever be committed): the deployment layer
-- (SSM/Terraform) does `ALTER ROLE app_api LOGIN PASSWORD '…'`. The owner/superuser
-- credential is reserved for migrations (`MIGRATION_DATABASE_URL`) and is never exposed
-- to the app.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_api') THEN
    CREATE ROLE app_api NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_api;
GRANT app_user TO app_api;
