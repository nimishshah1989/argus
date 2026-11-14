-- Revert of 0011_tenant_profile.sql (ticket 23). destructive-approved: drops only the three functions this migration added and takes back its column-level right.
-- backup: none needed; no table is touched.
BEGIN;
DROP FUNCTION tenant_update_profile(text, text, text);
DROP FUNCTION tenant_set_logo(uuid);
DROP FUNCTION tenant_logo(text);
REVOKE UPDATE (name, language, time_zone, logo_file_id, updated_at) ON tenant FROM app_router;
COMMIT;
