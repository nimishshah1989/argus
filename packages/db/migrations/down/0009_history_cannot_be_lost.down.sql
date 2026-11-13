-- Revert of 0009_history_cannot_be_lost.sql (ticket 07).
-- approved-by: schema-reviewer: PASS-with-conditions (3 rounds, 13 Nov; documentation items applied), orchestrator ruling
-- backup: full snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc). ticket_tag comes back
--   empty; its rows are reloaded from the export made before 0009 with
--   \copy ticket_tag FROM 'ticket_tag-<utc>.csv' WITH (FORMAT csv, HEADER)
-- restore: when this file refuses (a grant was approved or a customer offboarded) the way back is the
--   backup. An RDS snapshot restore is physical, and a full pg_restore into an empty database loads rows
--   before it creates triggers and NOT VALID checks: neither needs anything extra. A data-only reload of
--   platform_access into a database that already has 0009 needs, around the reload:
--     ALTER TABLE platform_access NO FORCE ROW LEVEL SECURITY;
--     ALTER TABLE platform_access DISABLE TRIGGER platform_access_guard;
--     ALTER TABLE platform_access DROP CONSTRAINT platform_access_approver_required;
--     ... reload ...
--     ALTER TABLE platform_access ADD CONSTRAINT platform_access_approver_required
--       CHECK (approved_by_login_id IS NOT NULL) NOT VALID;
--     ALTER TABLE platform_access ENABLE TRIGGER platform_access_guard;
--     ALTER TABLE platform_access FORCE ROW LEVEL SECURITY;
--   `pg_restore --disable-triggers` can stand in for the DISABLE and ENABLE lines, but it needs a superuser:
--   not for RDS. Data-only reload only from a dump taken after 0009. A pre-0009 backup is restored in full
--   into an empty database and 0009 is then run again.
-- Not reverted, on purpose: app_router stays without BYPASSRLS and keeps its router_definer policies on
-- login, session and sla_policy, which auth_lookup and tenants_with_sla_policies now depend on.
-- Refuses to run once support access has been used under the new rules or a customer has been offboarded:
-- restore the snapshot instead.

BEGIN;

SET LOCAL row_security = off;
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['person', 'login', 'ticket', 'ticket_event', 'crew_member', 'work_segment',
    'breakdown_report', 'breakdown_report_person', 'file', 'audit_log', 'platform_access', 'list_item',
    'machine'])
  LOOP
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM audit_log WHERE platform_access_id IS NOT NULL)
    OR EXISTS (SELECT 1 FROM platform_access WHERE approved_by_login_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Revert stopped: support-access approvals or audit links would be lost. Restore the snapshot instead.';
  END IF;
  IF EXISTS (SELECT 1 FROM tenant WHERE status = 'offboarded') THEN
    RAISE EXCEPTION 'Revert stopped: an offboarded customer''s record would be lost. Restore the snapshot instead.';
  END IF;
END $$;

DROP FUNCTION import_undo(uuid, uuid, text);
DROP FUNCTION erase_person(uuid, uuid, text, text);
DROP FUNCTION erase_json_values(jsonb, text);
DROP FUNCTION offboard_tenant(uuid, text, text, text);
DROP FUNCTION audit_purge(timestamptz, text);
DROP TRIGGER platform_access_guard ON platform_access;
DROP FUNCTION platform_access_guard();

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'person', 'push_subscription', 'ticket', 'ticket_event', 'work_segment', 'crew_member',
    'breakdown_report', 'breakdown_report_person', 'file', 'import_batch', 'import_row', 'audit_log',
    'command_idempotency', 'ai_suggestion'
  ])
  LOOP
    EXECUTE format('DROP POLICY router_definer ON %I', t);
  END LOOP;
END $$;
REVOKE ALL ON push_subscription, ticket, ticket_event, work_segment, crew_member, breakdown_report,
  breakdown_report_person, file, import_batch, import_row, audit_log, command_idempotency,
  ai_suggestion FROM app_router;
REVOKE UPDATE, DELETE ON person, login, session FROM app_router;
REVOKE INSERT, DELETE ON tenant FROM app_router;
ALTER TABLE tenant
  DROP CONSTRAINT tenant_status_check,
  ADD CONSTRAINT tenant_status_check CHECK (status IN ('active', 'suspended'));

GRANT UPDATE, DELETE ON ticket_event TO app_user;
GRANT DELETE ON ticket, work_segment, crew_member, breakdown_report, breakdown_report_person,
  list_item, login, person, machine, machine_move, file, platform_access, import_batch TO app_user;

DROP INDEX ticket_open_breakdown_unique, ticket_event_actor_idx, work_segment_person_idx,
  ticket_reporter_idx, ticket_reported_idx;

ALTER TABLE audit_log DROP COLUMN platform_access_id;  -- its foreign key and index go with it
ALTER TABLE platform_access
  DROP CONSTRAINT platform_access_approver_required,
  DROP CONSTRAINT platform_access_approver_tenant_fk,
  DROP CONSTRAINT platform_access_expiry_window,
  DROP CONSTRAINT platform_access_tenant_id_unique,
  DROP COLUMN approved_by_login_id,
  ALTER COLUMN expires_at DROP NOT NULL;
-- Put back each expiry 0009 changed, from the latest trace it left, but never later than now: a revert
-- must not re-open a grant that 0009 closed (an open-ended or far-future one stays closed). least() skips
-- an empty old value, so an open-ended grant ends now. The trace rows stay.
UPDATE platform_access pa SET expires_at = least((a.before ->> 'expires_at')::timestamptz, now()),
  updated_at = now()
FROM (
  SELECT DISTINCT ON (entity_id) tenant_id, entity_id, before FROM audit_log
  WHERE action = 'migration.0009.platform_access_expiry' ORDER BY entity_id, at DESC, created_at DESC
) a
WHERE a.entity_id = pa.id AND a.tenant_id = pa.tenant_id;

ALTER TABLE login
  DROP CONSTRAINT login_person_id_fkey,
  ADD CONSTRAINT login_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE ticket
  DROP CONSTRAINT ticket_reported_by_person_id_fkey,
  DROP CONSTRAINT ticket_raised_login_id_fkey,
  DROP CONSTRAINT ticket_lead_person_id_fkey,
  DROP CONSTRAINT ticket_transfer_to_person_id_fkey,
  DROP CONSTRAINT ticket_paused_by_person_id_fkey,
  DROP CONSTRAINT ticket_assigned_to_person_id_fkey,
  DROP CONSTRAINT ticket_closed_by_person_id_fkey,
  DROP CONSTRAINT ticket_parent_id_fkey,
  DROP CONSTRAINT ticket_machine_id_fkey,
  ADD CONSTRAINT ticket_reported_by_person_id_fkey FOREIGN KEY (reported_by_person_id) REFERENCES person(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_raised_login_id_fkey FOREIGN KEY (raised_login_id) REFERENCES login(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_lead_person_id_fkey FOREIGN KEY (lead_person_id) REFERENCES person(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_transfer_to_person_id_fkey FOREIGN KEY (transfer_to_person_id) REFERENCES person(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_paused_by_person_id_fkey FOREIGN KEY (paused_by_person_id) REFERENCES person(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_assigned_to_person_id_fkey FOREIGN KEY (assigned_to_person_id) REFERENCES person(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_closed_by_person_id_fkey FOREIGN KEY (closed_by_person_id) REFERENCES person(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES ticket(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES machine(id) ON DELETE SET NULL;
ALTER TABLE ticket_event
  DROP CONSTRAINT ticket_event_ticket_id_fkey,
  DROP CONSTRAINT ticket_event_login_id_fkey,
  DROP CONSTRAINT ticket_event_acting_person_id_fkey,
  ADD CONSTRAINT ticket_event_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE,
  ADD CONSTRAINT ticket_event_login_id_fkey FOREIGN KEY (login_id) REFERENCES login(id) ON DELETE SET NULL,
  ADD CONSTRAINT ticket_event_acting_person_id_fkey FOREIGN KEY (acting_person_id) REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE crew_member
  DROP CONSTRAINT crew_member_ticket_id_fkey,
  ADD CONSTRAINT crew_member_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE;
ALTER TABLE work_segment
  DROP CONSTRAINT work_segment_ticket_id_fkey,
  ADD CONSTRAINT work_segment_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE CASCADE;
ALTER TABLE breakdown_report
  DROP CONSTRAINT breakdown_report_ticket_id_fkey,
  DROP CONSTRAINT breakdown_report_submitted_by_person_id_fkey,
  ADD CONSTRAINT breakdown_report_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE SET NULL,
  ADD CONSTRAINT breakdown_report_submitted_by_person_id_fkey FOREIGN KEY (submitted_by_person_id) REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE breakdown_report_person
  DROP CONSTRAINT breakdown_report_person_report_id_fkey,
  ADD CONSTRAINT breakdown_report_person_report_id_fkey FOREIGN KEY (report_id) REFERENCES breakdown_report(id) ON DELETE CASCADE;
ALTER TABLE file
  DROP CONSTRAINT file_ticket_id_fkey,
  DROP CONSTRAINT file_uploaded_by_fkey,
  ADD CONSTRAINT file_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE SET NULL,
  ADD CONSTRAINT file_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES person(id) ON DELETE SET NULL;
ALTER TABLE audit_log
  DROP CONSTRAINT audit_log_login_id_fkey,
  ADD CONSTRAINT audit_log_login_id_fkey FOREIGN KEY (login_id) REFERENCES login(id) ON DELETE SET NULL;

CREATE TABLE ticket_tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES list_item(id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by_login_id uuid REFERENCES login(id) ON DELETE SET NULL,
  applied_by_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ticket_id, item_id),
  CONSTRAINT ticket_tag_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES ticket (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ticket_tag_item_tenant_fk FOREIGN KEY (tenant_id, item_id)
    REFERENCES list_item (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ticket_tag_login_tenant_fk FOREIGN KEY (tenant_id, applied_by_login_id)
    REFERENCES login (tenant_id, id),
  CONSTRAINT ticket_tag_actor_tenant_fk FOREIGN KEY (tenant_id, applied_by_person_id)
    REFERENCES person (tenant_id, id)
);
ALTER TABLE ticket_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tag FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ticket_tag
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON ticket_tag TO app_user;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['person', 'login', 'ticket', 'ticket_event', 'crew_member', 'work_segment',
    'breakdown_report', 'breakdown_report_person', 'file', 'audit_log', 'platform_access', 'list_item',
    'machine'])
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DO $$ BEGIN
  IF to_regclass('public.schema_migration') IS NOT NULL THEN
    DELETE FROM schema_migration WHERE filename = '0009_history_cannot_be_lost.sql';
  END IF;
END $$;

COMMIT;
