-- Migration 0015: the one M4b schema change (ticket 46, packet 46a). Four tables (D17: `forecast`, `intervention`,
-- `pm_plan`, `asset_register`), two planned ticket channels (`pm`, `inspection`), four failure-code columns and the PM
-- job's report data on `breakdown_report`, and one tenant-scoped trigger that validates those codes against the plant's
-- `list_item` list.
-- Apply with scripts/migrate.ts, not raw psql: only the runner lends app_router CREATE on schema public for the OWNER TO
-- in the other files, and the runner owns the transaction (D24 point 4).
-- approved-by: D17 table budget (13 Nov: the four M4b tables), docs/slices/46-m4b-schema.md as revised after the 19 Nov
--   review, and the PR review on this file. The drop below is only the unnamed `ticket_raised_channel_check`, re-created
--   in the same transaction with two more values; no row is rewritten and no other constraint is dropped.
-- backup: full snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc), its id recorded in the deploy
--   note. The up is additive apart from that one constraint swap; the snapshot is also what the revert is stopped for.
-- Revert: packages/db/migrations/down/0015_m4b_schema.down.sql (take a snapshot before a revert too: it drops the four
--   tables with every forecast, intervention, PM plan and asset row).

BEGIN;

-- A stuck deploy must fail, not queue behind a long transaction and block the app behind it.
SET LOCAL lock_timeout = '5s';

-- Re-creating the channel CHECK validates every existing ticket. On RDS the migration role owns the table but is not a
-- superuser, so FORCE row security would hide rows from a read (D24 point 5): turn row security off so a hidden row is an
-- error, lift FORCE on `ticket` for this transaction and put it back at the end.
SET LOCAL row_security = off;
ALTER TABLE ticket NO FORCE ROW LEVEL SECURITY;

-- 1. The two planned channels. `pm` is a preventive-maintenance job and `inspection` is a planned check: neither is a
-- breakdown raised by a person, so the channel policy in packages/shared/src/channel.ts keeps them out of the SLA
-- clocks, the drift list, escalation and live analytics. No existing row changes value.
ALTER TABLE ticket DROP CONSTRAINT ticket_raised_channel_check;
ALTER TABLE ticket ADD CONSTRAINT ticket_raised_channel_check
  CHECK (raised_channel IN ('floor', 'desk', 'whatsapp', 'qr', 'import', 'backfill', 'pm', 'inspection'));

-- 2. The failure coding of a breakdown (D17: four columns on `breakdown_report`, not a table) and the report data of the
-- ticket a PM job produces (`pm_report`: `{total, undone[], readings{}, comments, doneBy}`; NULL on every other report).
ALTER TABLE breakdown_report ADD COLUMN failure_component text;
ALTER TABLE breakdown_report ADD COLUMN failure_mode text;
ALTER TABLE breakdown_report ADD COLUMN failure_cause text;
ALTER TABLE breakdown_report ADD COLUMN failure_action text;
ALTER TABLE breakdown_report ADD COLUMN pm_report jsonb;

-- A non-null code must be a `failure_code` list_item of the same plant. The trigger is invoker-rights (no definer
-- shortcut), states the tenant predicate itself instead of leaning on RLS, and has no `active` filter: a code that was
-- switched off after old reports used it still validates those reports (ticket 47's rule). Each column is checked
-- separately so the error names the field that is wrong.
CREATE FUNCTION breakdown_report_check_failure_codes() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF NEW.failure_component IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM list_item
    WHERE tenant_id = NEW.tenant_id AND list = 'failure_code' AND code = NEW.failure_component
  ) THEN
    RAISE EXCEPTION 'breakdown_report: failure_component "%" is not a failure code of this plant',
      NEW.failure_component USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.failure_mode IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM list_item
    WHERE tenant_id = NEW.tenant_id AND list = 'failure_code' AND code = NEW.failure_mode
  ) THEN
    RAISE EXCEPTION 'breakdown_report: failure_mode "%" is not a failure code of this plant',
      NEW.failure_mode USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.failure_cause IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM list_item
    WHERE tenant_id = NEW.tenant_id AND list = 'failure_code' AND code = NEW.failure_cause
  ) THEN
    RAISE EXCEPTION 'breakdown_report: failure_cause "%" is not a failure code of this plant',
      NEW.failure_cause USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.failure_action IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM list_item
    WHERE tenant_id = NEW.tenant_id AND list = 'failure_code' AND code = NEW.failure_action
  ) THEN
    RAISE EXCEPTION 'breakdown_report: failure_action "%" is not a failure code of this plant',
      NEW.failure_action USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER breakdown_report_failure_codes BEFORE INSERT OR UPDATE ON breakdown_report
  FOR EACH ROW EXECUTE FUNCTION breakdown_report_check_failure_codes();

-- 3. A frozen monthly forecast per machine (D17: the outcome is filled into the same row later, not a second table). The
-- month is a calendar month so a forecast cannot drift to a random date; `predicted` is written once and only the
-- outcome columns can be updated by the app role (see the column grant below the RLS block).
CREATE TABLE forecast (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL,
  month date NOT NULL,
  as_of date NOT NULL,
  profile text NOT NULL CHECK (profile ~ '^[a-z][a-z0-9_]{0,31}$'),
  model text NOT NULL,
  predicted jsonb NOT NULL,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  outcome jsonb,
  scored_at timestamptz,
  CONSTRAINT forecast_machine_tenant_fk FOREIGN KEY (tenant_id, machine_id)
    REFERENCES machine (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT forecast_month_start_check CHECK (date_trunc('month', month) = month),
  CONSTRAINT forecast_tenant_machine_month_unique UNIQUE (tenant_id, machine_id, month)
);
CREATE INDEX forecast_tenant_month_idx ON forecast (tenant_id, month);

-- 4. A PM plan per machine or category (D17: the checklist is a list on the row, not tables). Its composite key is the
-- target of the intervention's tenant-safe foreign key below.
CREATE TABLE pm_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  machine_id uuid,
  category text,
  title text NOT NULL,
  interval_days integer,
  meter_interval numeric,
  meter_tolerance numeric,
  last_meter_reading numeric,
  last_done_on date,
  checklist jsonb NOT NULL DEFAULT '[]',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pm_plan_machine_tenant_fk FOREIGN KEY (tenant_id, machine_id)
    REFERENCES machine (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT pm_plan_target_check CHECK (machine_id IS NOT NULL OR category IS NOT NULL),
  CONSTRAINT pm_plan_interval_days_check CHECK (interval_days IS NULL OR interval_days > 0),
  CONSTRAINT pm_plan_meter_interval_check CHECK (meter_interval IS NULL OR meter_interval > 0),
  CONSTRAINT pm_plan_meter_tolerance_check CHECK (meter_tolerance IS NULL OR meter_tolerance >= 0),
  CONSTRAINT pm_plan_tenant_id_unique UNIQUE (tenant_id, id)
);
CREATE INDEX pm_plan_tenant_machine_idx ON pm_plan (tenant_id, machine_id);
CREATE INDEX pm_plan_tenant_category_active_idx ON pm_plan (tenant_id, category) WHERE active;

-- 5. An intervention compares a PM change against similar machines (D17). It points at a machine or a plan, never at a
-- plan of another plant: the composite foreign key carries `tenant_id` so a cross-tenant id cannot resolve.
CREATE TABLE intervention (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  machine_id uuid,
  pm_plan_id uuid,
  changed_on date NOT NULL,
  control jsonb NOT NULL DEFAULT '[]',
  before jsonb,
  after jsonb,
  verdict jsonb,
  decided_by_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT intervention_machine_tenant_fk FOREIGN KEY (tenant_id, machine_id)
    REFERENCES machine (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT intervention_pm_plan_tenant_fk FOREIGN KEY (tenant_id, pm_plan_id)
    REFERENCES pm_plan (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT intervention_target_check CHECK (machine_id IS NOT NULL OR pm_plan_id IS NOT NULL)
);
CREATE INDEX intervention_tenant_changed_idx ON intervention (tenant_id, changed_on);

-- 6. One register for AMC, warranty, legal and calibration rows (D17: one table with a `kind` column, not two).
CREATE TABLE asset_register (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  kind text NOT NULL,
  machine_id uuid,
  vendor text,
  reference text,
  starts_on date,
  ends_on date,
  due_on date,
  lead_days integer NOT NULL DEFAULT 0,
  owner_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asset_register_kind_check
    CHECK (kind IN ('amc', 'warranty', 'legal', 'calibration')),
  CONSTRAINT asset_register_machine_tenant_fk FOREIGN KEY (tenant_id, machine_id)
    REFERENCES machine (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT asset_register_lead_days_check CHECK (lead_days >= 0),
  CONSTRAINT asset_register_dates_check
    CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)
);
CREATE INDEX asset_register_tenant_kind_due_idx ON asset_register (tenant_id, kind, due_on);
CREATE INDEX asset_register_tenant_ends_idx ON asset_register (tenant_id, ends_on);

-- RLS, one tenant policy and the app grants for the four tables, in the 0014 shape. `forecast` is the exception: the
-- app role gets no UPDATE on `predicted` (a forecast is written once), only on the outcome it fills in later.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['forecast', 'intervention', 'pm_plan', 'asset_register'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON %I TO app_user', t);
  END LOOP;
END $$;
GRANT UPDATE ON intervention, pm_plan, asset_register TO app_user;
GRANT UPDATE (outcome, scored_at) ON forecast TO app_user;

ALTER TABLE ticket FORCE ROW LEVEL SECURITY;

COMMIT;
