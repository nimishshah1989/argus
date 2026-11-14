-- Revert of 0011_tenant_profile.sql (ticket 23). destructive-approved: drops the three functions this migration added, the logo content column and its check, and takes back its column-level right.
-- backup: snapshot first. Dropping `file.content` deletes every stored logo (the logo files' other columns stay).
BEGIN;
DROP FUNCTION tenant_update_profile(text, text, text);
DROP FUNCTION tenant_set_logo(uuid);
DROP FUNCTION tenant_logo(text);
ALTER TABLE file DROP CONSTRAINT file_content_logo_only;
ALTER TABLE file DROP COLUMN content;
REVOKE UPDATE (name, language, time_zone, logo_file_id, updated_at) ON tenant FROM app_router;
COMMIT;
