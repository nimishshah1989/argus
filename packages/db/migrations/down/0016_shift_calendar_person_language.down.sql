-- Revert of 0016_shift_calendar_person_language.sql. destructive-approved: drops `person.language` (every person's
-- language pick) and `shift.valid_from`; fails on the unique re-create if a shift code has two calendars, which must
-- then be removed by hand first (keep the one in use).
-- backup: snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc).
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE person DROP COLUMN language;
ALTER TABLE shift DROP CONSTRAINT shift_tenant_code_valid_from_key;
ALTER TABLE shift ADD CONSTRAINT shift_tenant_id_code_key UNIQUE (tenant_id, code);
ALTER TABLE shift DROP COLUMN valid_from;
COMMIT;
