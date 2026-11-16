-- Revert of 0014_m4a_schema.sql (ticket 36 part B). destructive-approved: drops `kpi_snapshot` (every stored figure), `list_item.aliases`, `breakdown_report.spare_cost` and the two location columns of `machine_move`, and the triggers; puts the three retired columns back.
-- backup: snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc). Dropping `kpi_snapshot` deletes the figures (the engine can recompute them, but a frozen figure cannot be recomputed); dropping the other columns forgets legacy codes, spare costs and move locations. The three retired columns come back with the values the up file saved in its `migration.0014` audit line (the latest one per customer); a person or ticket created since is left at the default.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL row_security = off;
ALTER TABLE person NO FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket NO FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log NO FORCE ROW LEVEL SECURITY;
ALTER TABLE sla_policy NO FORCE ROW LEVEL SECURITY;  -- read to restore a policy link only where the policy still exists

DROP TRIGGER person_erased_scrubs_notes ON person;
DROP FUNCTION person_erased_scrub_notes();
DROP POLICY router_definer ON setting;
REVOKE UPDATE (value, updated_at) ON setting FROM app_router;
REVOKE SELECT (tenant_id, key, value) ON setting FROM app_router;

ALTER TABLE machine_move DROP COLUMN to_location;
ALTER TABLE machine_move DROP COLUMN from_location;
ALTER TABLE breakdown_report DROP COLUMN spare_cost;
DROP TRIGGER list_item_aliases_check ON list_item;
DROP FUNCTION list_item_check_aliases();
ALTER TABLE list_item DROP COLUMN aliases;
DROP TABLE kpi_snapshot;

ALTER TABLE person ADD COLUMN kind text NOT NULL DEFAULT 'staff' CHECK (kind IN ('staff', 'production', 'vendor'));
ALTER TABLE ticket ADD COLUMN sla_policy_id uuid;
ALTER TABLE ticket ADD COLUMN handback_status text;
-- The latest saved line of each customer holds the values the columns had when they were dropped.
CREATE TEMP TABLE kept_0014 ON COMMIT DROP AS
SELECT DISTINCT ON (tenant_id) tenant_id, after FROM audit_log WHERE action = 'migration.0014'
ORDER BY tenant_id, at DESC, id;
UPDATE person p SET kind = v.value
FROM kept_0014 k, jsonb_each_text(k.after -> 'person_kind') v
WHERE p.tenant_id = k.tenant_id AND p.id::text = v.key;
UPDATE ticket t SET sla_policy_id = v.value::uuid
FROM kept_0014 k, jsonb_each_text(k.after -> 'ticket_sla_policy_id') v
WHERE t.tenant_id = k.tenant_id AND t.id::text = v.key
  AND EXISTS (SELECT 1 FROM sla_policy s WHERE s.tenant_id = t.tenant_id AND s.id = v.value::uuid);
UPDATE ticket t SET handback_status = v.value
FROM kept_0014 k, jsonb_each_text(k.after -> 'ticket_handback_status') v
WHERE t.tenant_id = k.tenant_id AND t.id::text = v.key;
CREATE INDEX ticket_sla_policy_idx ON ticket (tenant_id, sla_policy_id) WHERE sla_policy_id IS NOT NULL;
ALTER TABLE ticket ADD CONSTRAINT ticket_sla_policy_tenant_fk FOREIGN KEY (tenant_id, sla_policy_id)
  REFERENCES sla_policy (tenant_id, id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE ticket VALIDATE CONSTRAINT ticket_sla_policy_tenant_fk;

ALTER TABLE person FORCE ROW LEVEL SECURITY;
ALTER TABLE ticket FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE sla_policy FORCE ROW LEVEL SECURITY;
-- Its own ledger row goes too, so the next runner run applies 0014 again instead of leaving the database pre-0014.
DO $$ BEGIN
  IF to_regclass('public.schema_migration') IS NOT NULL THEN
    DELETE FROM schema_migration WHERE filename = '0014_m4a_schema.sql';
  END IF;
END $$;
COMMIT;
