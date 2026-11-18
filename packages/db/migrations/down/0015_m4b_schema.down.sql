-- Revert of 0015_m4b_schema.sql (ticket 46, packet 46a).
-- destructive-approved: drops `forecast` (every frozen forecast and its outcome), `intervention`, `pm_plan` (every
--   checklist and meter reading), `asset_register`, the four failure-code columns and `pm_report` on
--   `breakdown_report`, and the failure-code trigger and its function; restores the four-channel CHECK.
-- backup: snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc). A revert that reaches `pm` or
--   `inspection` tickets stops: those rows cannot be represented by the old four-channel CHECK, so restore the snapshot
--   instead of rewriting history. Records whose channel is unchanged are still lost when the four M4b tables and the
--   report columns are dropped.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- The check below must see every ticket. On RDS the migration role owns `ticket` but is not a superuser, so FORCE row
-- security would hide the `pm` rows and let the revert drop their channel (D24 point 5): turn row security off and lift
-- FORCE for this transaction, then put it back at the end when the revert is allowed to continue.
SET LOCAL row_security = off;
ALTER TABLE ticket NO FORCE ROW LEVEL SECURITY;

DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM ticket WHERE raised_channel IN ('pm', 'inspection');
  IF n > 0 THEN
    RAISE EXCEPTION 'Revert stopped: % ticket(s) were raised as pm or inspection; the old four-channel CHECK cannot '
      'hold them. Restore the snapshot instead.', n;
  END IF;
END $$;

DROP TRIGGER breakdown_report_failure_codes ON breakdown_report;
DROP FUNCTION breakdown_report_check_failure_codes();
ALTER TABLE breakdown_report DROP COLUMN pm_report;
ALTER TABLE breakdown_report DROP COLUMN failure_action;
ALTER TABLE breakdown_report DROP COLUMN failure_cause;
ALTER TABLE breakdown_report DROP COLUMN failure_mode;
ALTER TABLE breakdown_report DROP COLUMN failure_component;

-- `intervention` references `pm_plan`, so it goes first.
DROP TABLE intervention;
DROP TABLE forecast;
DROP TABLE pm_plan;
DROP TABLE asset_register;

ALTER TABLE ticket DROP CONSTRAINT ticket_raised_channel_check;
ALTER TABLE ticket ADD CONSTRAINT ticket_raised_channel_check
  CHECK (raised_channel IN ('floor', 'desk', 'whatsapp', 'qr', 'import', 'backfill'));

ALTER TABLE ticket FORCE ROW LEVEL SECURITY;

-- Its own ledger row goes too, so the next runner run applies 0015 again instead of leaving the database pre-0015.
DO $$ BEGIN
  IF to_regclass('public.schema_migration') IS NOT NULL THEN
    DELETE FROM schema_migration WHERE filename = '0015_m4b_schema.sql';
  END IF;
END $$;
COMMIT;
