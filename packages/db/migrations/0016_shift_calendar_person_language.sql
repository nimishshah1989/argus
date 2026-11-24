-- Migration 0016 (ADR 0036): the shift calendar is effective-dated, and each person keeps their own language.
-- `shift.valid_from`: the shifts that share a `valid_from` are one calendar; the calendar valid on a day is the one
-- with the latest `valid_from` on or before it. Existing rows get 2000-01-01, so every figure is unchanged until a
-- second calendar is added. The (tenant_id, code) unique becomes (tenant_id, code, valid_from) so shift "1" can have
-- new hours from a date. `person.language`: NULL until the person picks; NULL shows English.
-- Apply with scripts/migrate.ts, not raw psql (D24 point 4).
-- approved-by: Nimish's decisions 2 and 3, 24 Nov 19:35 (ADR 0036). The only DROP is the unique constraint
--   `shift_tenant_id_code_key`, re-created wider in the same transaction; no row is rewritten or deleted.
-- backup: full snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc), its id recorded in the deploy
--   note. The up is additive apart from that one constraint swap.
-- Revert: packages/db/migrations/down/0016_shift_calendar_person_language.down.sql

BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE shift ADD COLUMN valid_from date NOT NULL DEFAULT DATE '2000-01-01';
ALTER TABLE shift DROP CONSTRAINT shift_tenant_id_code_key;
ALTER TABLE shift ADD CONSTRAINT shift_tenant_code_valid_from_key UNIQUE (tenant_id, code, valid_from);

ALTER TABLE person ADD COLUMN language text CHECK (language IN ('en', 'gu'));

COMMIT;
