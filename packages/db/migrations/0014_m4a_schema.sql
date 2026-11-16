-- Migration 0014: the one M4a schema change. Ticket 36 part B, D17 (the `kpi_snapshot` table), D31 (where each kept
-- stored item of the analytics face lives).
-- Apply with scripts/migrate.ts, not raw psql: only the runner lends app_router CREATE on schema public for the OWNER TO below (D24 point 4).
-- approved-by: orchestrator ruling (backend lane, 14 Nov: ticket 36 part B brief, candidate list in the 36A figure catalogue, PR #267, §2); reviewed by two agents on the PR
-- backup: full snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc), its id recorded in the deploy note.
--   This file DROPS three columns that existed since 0001 and that no code reads or writes (`person.kind`,
--   `ticket.sla_policy_id`, `ticket.handback_status`; tools/retired-columns.test.ts guards that). Before it drops them it
--   writes every non-default value they hold into one `audit_log` line per customer (action `migration.0014`), and the
--   revert puts those values back only while that line survives: `audit_purge` removes audit rows after 3 years (D31), so
--   a revert past that window restores nothing, even where a column held data. It changes no other row.
--   It adds one table (`kpi_snapshot`), one array column on `list_item`, one money column on `breakdown_report`, two
--   location columns on `machine_move`, and three triggers. Revert: packages/db/migrations/down/0014_m4a_schema.down.sql
--   (take a snapshot before a revert too: it drops `kpi_snapshot` with every stored figure, and the new columns).

BEGIN;

-- A stuck deploy must fail, not queue behind a long transaction and block the app behind it.
SET LOCAL lock_timeout = '5s';

-- The audit line below reads `person` and `ticket` and writes `audit_log`. On RDS the migration role is the table owner,
-- not a superuser, so FORCE row security would hide those rows (D24 point 5): turn row security off so a hidden row is an
-- error, lift FORCE on the three tables for this transaction and put it back at the end.
SET LOCAL row_security = off;
ALTER TABLE person NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log NO FORCE ROW LEVEL SECURITY;

-- 1. The three retired columns (DATA-MAP §7): the person's team is `person.team`, the target times of a ticket are found
-- from its severity, and production's sign-off answer is the `handback_confirm` / `handback_dispute` history lines.
-- One audit line per customer keeps every value that was not the column's default, so nothing is lost for good.
INSERT INTO audit_log (tenant_id, action, entity, after)
SELECT t.id, 'migration.0014', 'schema', jsonb_build_object(
  'dropped', jsonb_build_array('person.kind', 'ticket.sla_policy_id', 'ticket.handback_status'),
  'person_kind', coalesce((SELECT jsonb_object_agg(p.id, p.kind) FROM person p
    WHERE p.tenant_id = t.id AND p.kind <> 'staff'), '{}'),
  'ticket_sla_policy_id', coalesce((SELECT jsonb_object_agg(k.id, k.sla_policy_id) FROM ticket k
    WHERE k.tenant_id = t.id AND k.sla_policy_id IS NOT NULL), '{}'),
  'ticket_handback_status', coalesce((SELECT jsonb_object_agg(k.id, k.handback_status) FROM ticket k
    WHERE k.tenant_id = t.id AND k.handback_status IS NOT NULL), '{}'))
FROM tenant t;
DROP INDEX ticket_sla_policy_idx;
ALTER TABLE ticket DROP CONSTRAINT ticket_sla_policy_tenant_fk;
ALTER TABLE ticket DROP COLUMN sla_policy_id;
ALTER TABLE ticket DROP COLUMN handback_status;
ALTER TABLE person DROP COLUMN kind;

-- 2. The analytics engine's stored figures (D17: the only new M4a table). One row is one figure: which measure, for which
-- subject (the whole plant, a segment, group, cell, category or machine, by id or code, never by name; per-person figures wait for a ruling on ranking technicians, DATA-MAP question 4), over which
-- period, as the engine saw the data on `as_of`, under which rule set (`profile`: Bhavin's legacy rules or ours). `run_id`
-- groups the rows of one engine run, so there is no table of runs. The same figure for the same as-of day is replaced by
-- a re-run; a later as-of keeps the series. `value` is the number or the structure the screen shows. The period may end
-- after `as_of` (a planning forecast looks ahead). No names, no money rule here: who may read money figures is the
-- server's job (DATA-MAP §4). Kept forever.
CREATE TABLE kpi_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  profile text NOT NULL CHECK (profile ~ '^[a-z][a-z0-9_]{0,31}$'),
  key text NOT NULL CHECK (key ~ '^[a-z][a-z0-9_.:-]{0,79}$'),
  subject_kind text NOT NULL
    CHECK (subject_kind IN ('plant', 'segment', 'group', 'cell', 'category', 'machine')),
  subject_key text NOT NULL DEFAULT '' CHECK (char_length(subject_key) <= 80),
  period_start date NOT NULL,
  period_end date NOT NULL,
  as_of date NOT NULL,
  run_id uuid NOT NULL,
  value jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kpi_snapshot_subject_shape CHECK ((subject_kind = 'plant') = (subject_key = '')),
  CONSTRAINT kpi_snapshot_period_order CHECK (period_end >= period_start),
  UNIQUE (tenant_id, profile, key, subject_kind, subject_key, period_start, period_end, as_of)
);
CREATE INDEX kpi_snapshot_run_idx ON kpi_snapshot (tenant_id, run_id);

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['kpi_snapshot'])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO app_user', t);
  END LOOP;
END $$;

-- 3. Legacy codes resolve through the row they were folded into (Bhavin's retired ELE, HYD and ROT, and the many old
-- codes M4b maps onto one failure code). Several legacy codes may point at one entry, so it is a list. The trigger keeps
-- the list clean (trimmed, lower case, no empties or repeats) and refuses a code another entry of one list claims in any
-- letter case, as its code or as an alias; it takes a per-list lock so two writers cannot both pass the check.
ALTER TABLE list_item ADD COLUMN aliases text[] NOT NULL DEFAULT '{}';
CREATE FUNCTION list_item_check_aliases() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF btrim(NEW.code) = '' THEN
    RAISE EXCEPTION 'list_item: a code cannot be empty' USING ERRCODE = 'check_violation';
  END IF;
  NEW.aliases := ARRAY(SELECT DISTINCT lower(btrim(a)) FROM unnest(NEW.aliases) a WHERE btrim(a) <> '' ORDER BY 1);
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tenant_id::text || '|' || NEW.list, 0));
  IF lower(NEW.code) = ANY(NEW.aliases) OR EXISTS (
    SELECT 1 FROM list_item o WHERE o.tenant_id = NEW.tenant_id AND o.list = NEW.list AND o.id <> NEW.id
      AND (o.aliases && NEW.aliases OR lower(o.code) = ANY(NEW.aliases) OR lower(NEW.code) = ANY(o.aliases)
        OR lower(o.code) = lower(NEW.code))
  ) THEN
    RAISE EXCEPTION 'list_item: a code or alias of "%" is already used in this list', NEW.code
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER list_item_aliases_check BEFORE INSERT OR UPDATE OF list, code, aliases ON list_item
  FOR EACH ROW EXECUTE FUNCTION list_item_check_aliases();

-- 4. The spare cost of a breakdown (Money Matters and the "spares spend" nudge read it; the platform kept up to three
-- spares with a cost each, the report holds the sum). NULL is "not recorded", 0 is "no spare cost".
ALTER TABLE breakdown_report ADD COLUMN spare_cost numeric(12, 2) CHECK (spare_cost IS NULL OR spare_cost >= 0);

-- 5. The platform's cell change log carries the location as well as the cell.
ALTER TABLE machine_move ADD COLUMN from_location text;
ALTER TABLE machine_move ADD COLUMN to_location text;

-- 6. Team Focus status, owner and note, and a nudge's acknowledgement and snooze, live as one `setting` row per item (key
-- `focus:<period>|<action>` or `nudge:<rule>|<subject>`; no table: D31). Their notes are free text and can name a leaver,
-- and `erase_person` does not look in `setting`, so when a person is erased (the row gets its erasure hash) this trigger
-- replaces the person's name, short name, number and own usernames in those rows, with the same whole-word rule as
-- `erase_person`. It runs as the router role, as that function does, so the router role gets exactly this much on `setting` (it reads three columns and writes one).
GRANT SELECT (tenant_id, key, value) ON setting TO app_router;
GRANT UPDATE (value, updated_at) ON setting TO app_router;
CREATE POLICY router_definer ON setting TO app_router USING (true) WITH CHECK (true);
CREATE FUNCTION person_erased_scrub_notes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE pat text;
BEGIN
  -- Only an operator in the router role erases a person (D24); a stray write of the hash by the app role scrubs nothing.
  IF NOT pg_has_role(session_user, 'app_router', 'member') THEN RETURN NEW; END IF;
  SELECT '(?<![^[:space:][:punct:]])(?:' || string_agg(
      regexp_replace(regexp_replace(t, '([^[:alnum:][:space:]])', '\\\1', 'g'), '\s+', '\\s+', 'g'),
      '|' ORDER BY length(t) DESC, t) || ')(?![^[:space:][:punct:]])'
    INTO pat
  FROM (
    SELECT DISTINCT btrim(x) AS t
    FROM unnest(ARRAY[OLD.name, OLD.short_name, OLD.phone]
      || ARRAY(SELECT username FROM login WHERE tenant_id = OLD.tenant_id AND person_id = OLD.id AND NOT shared)) x
    WHERE length(btrim(coalesce(x, ''))) >= 3 AND lower(btrim(x)) <> 'former staff'
  ) s;
  IF pat IS NOT NULL THEN
    UPDATE setting SET value = erase_json_values(value, pat), updated_at = now()
    WHERE tenant_id = OLD.tenant_id AND key ~ '^(focus|nudge):'
      AND erase_json_values(value, pat) IS DISTINCT FROM value;
  END IF;
  RETURN NEW;
END $$;
ALTER FUNCTION person_erased_scrub_notes() OWNER TO app_router;
REVOKE ALL ON FUNCTION person_erased_scrub_notes() FROM PUBLIC;
CREATE TRIGGER person_erased_scrubs_notes BEFORE UPDATE OF erasure_hash ON person
  FOR EACH ROW WHEN (OLD.erasure_hash IS NULL AND NEW.erasure_hash IS NOT NULL)
  EXECUTE FUNCTION person_erased_scrub_notes();

ALTER TABLE person FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;

COMMIT;
