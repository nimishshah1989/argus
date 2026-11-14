-- Migration 0012: the one M2 schema change. Ticket 29, ARCHITECTURE §9 items 30 and 32, D17 (the three M2 tables).
-- approved-by: orchestrator ruling (ticket 29 brief, 14 Nov: tables, columns and defaults); two adversarial schema reviews run on the PR
-- backup: full snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc), its id recorded in the deploy note.
--   Applying changes no row and deletes none: it adds three tables and six columns, and replaces two CHECK constraints on
--   `sla_timer` by wider ones. Revert: packages/db/migrations/down/0012_m2_schema.down.sql (it drops the three tables and
--   the six columns, so take a snapshot before a revert too).

BEGIN;

-- Composite keys for the tenant-safe links below (the pattern of 0001): a row can only point at a row of its own plant.
ALTER TABLE shift ADD CONSTRAINT shift_tenant_id_unique UNIQUE (tenant_id, id);
ALTER TABLE ticket_event ADD CONSTRAINT ticket_event_tenant_id_unique UNIQUE (tenant_id, id);

-- Segments, shifts and glossary terms can be switched off, never deleted (history names them).
ALTER TABLE segment ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE shift ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE glossary_term ADD COLUMN active boolean NOT NULL DEFAULT true;

-- Ticket 66: a work type or breakdown category that needs a lockout before work starts.
ALTER TABLE list_item ADD COLUMN needs_lockout boolean NOT NULL DEFAULT false;

-- Item 32: the person a report is handed over to. `handover_name` stays: it holds the typed text of imported history.
ALTER TABLE breakdown_report ADD COLUMN handover_person_id uuid;
ALTER TABLE breakdown_report ADD CONSTRAINT report_handover_tenant_fk
  FOREIGN KEY (tenant_id, handover_person_id) REFERENCES person (tenant_id, id);

-- Item 30: two more clocks. A `pause` timer is the longest a ticket may stay paused; a `handback` timer is how long
-- production has to confirm or dispute the machine. Each kind has its own stop reasons.
ALTER TABLE sla_timer DROP CONSTRAINT sla_timer_kind_check;
ALTER TABLE sla_timer ADD CONSTRAINT sla_timer_kind_check
  CHECK (kind IN ('ack', 'restore', 'pause', 'handback'));
ALTER TABLE sla_timer DROP CONSTRAINT sla_timer_stop_reason_kind;
ALTER TABLE sla_timer ADD CONSTRAINT sla_timer_stop_reason_kind CHECK (
  (kind = 'ack' AND (stop_reason IS NULL OR stop_reason IN ('acknowledged', 'started', 'closed', 'cancelled')))
  OR (kind = 'restore' AND (stop_reason IS NULL OR stop_reason IN ('machine_running', 'closed', 'cancelled')))
  OR (kind = 'pause' AND (stop_reason IS NULL OR stop_reason IN ('resumed', 'closed', 'cancelled')))
  OR (kind = 'handback' AND (stop_reason IS NULL OR stop_reason IN ('confirmed', 'disputed', 'closed', 'cancelled')))
);

-- Who is on duty at which level, on which date and in which of the plant's shifts. A person appears once per
-- date and shift. Kept one year: the purge goes by `date`.
CREATE TABLE roster_entry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  date date NOT NULL,
  shift_id uuid NOT NULL,
  person_id uuid NOT NULL,
  level text NOT NULL CHECK (level IN ('L1', 'L2', 'L3', 'L4', 'vendor')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, date, shift_id, person_id),
  CONSTRAINT roster_shift_tenant_fk FOREIGN KEY (tenant_id, shift_id) REFERENCES shift (tenant_id, id),
  CONSTRAINT roster_person_tenant_fk FOREIGN KEY (tenant_id, person_id) REFERENCES person (tenant_id, id)
);
CREATE INDEX roster_entry_level_idx ON roster_entry (tenant_id, date, shift_id, level);

-- The ladder: what was missed, from which severity up, who is told at which level, how, after how long, and how
-- often it repeats. Who is a named person or a role (the people on the roster at that level), never both.
-- Repeats come as a pair: every `repeat_minutes` (15 at least), at most `repeat_cap` times.
CREATE TABLE escalation_rule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  trigger text NOT NULL CHECK (trigger IN (
    'ack_missed', 'restore_missed', 'pause_overrun', 'reopened_twice', 'critical_still_down', 'handback_unanswered')),
  severity_min text NOT NULL CHECK (severity_min IN ('S1', 'S2', 'S3', 'S4')),
  level text NOT NULL CHECK (level IN ('L1', 'L2', 'L3', 'L4', 'vendor')),
  notify_person_id uuid,
  notify_role text CHECK (notify_role IN ('technician', 'supervisor', 'head', 'plant_head', 'admin')),
  channel text NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'whatsapp')),
  delay_minutes integer NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
  repeat_minutes integer CHECK (repeat_minutes IS NULL OR repeat_minutes >= 15),
  repeat_cap integer CHECK (repeat_cap IS NULL OR repeat_cap >= 1),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT escalation_rule_who CHECK ((notify_person_id IS NULL) <> (notify_role IS NULL)),
  CONSTRAINT escalation_rule_repeat_pair CHECK ((repeat_minutes IS NULL) = (repeat_cap IS NULL)),
  CONSTRAINT escalation_rule_person_tenant_fk FOREIGN KEY (tenant_id, notify_person_id)
    REFERENCES person (tenant_id, id)
);
-- The same rule twice is a mistake; two people at one level are two rows.
CREATE UNIQUE INDEX escalation_rule_unique_idx ON escalation_rule (
  tenant_id, trigger, severity_min, level, channel, COALESCE(notify_person_id::text, ''), COALESCE(notify_role, ''));

-- One row per message to one person on one channel. It holds ids, never names or wording. `dedupe_key` makes the
-- same message impossible to record twice. Kept 90 days: the purge goes by `created_at`.
CREATE TABLE notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL CHECK (char_length(dedupe_key) BETWEEN 1 AND 200),
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 40),
  person_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('push', 'whatsapp')),
  ticket_id uuid,
  event_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'dead')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text CHECK (last_error IS NULL OR char_length(last_error) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dedupe_key),
  CONSTRAINT notification_pending_shape CHECK ((status = 'pending') = (next_attempt_at IS NOT NULL)),
  CONSTRAINT notification_sent_shape CHECK ((status = 'sent') = (sent_at IS NOT NULL)),
  CONSTRAINT notification_person_tenant_fk FOREIGN KEY (tenant_id, person_id) REFERENCES person (tenant_id, id),
  CONSTRAINT notification_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES ticket (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT notification_event_tenant_fk FOREIGN KEY (tenant_id, event_id)
    REFERENCES ticket_event (tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX notification_due_idx ON notification (tenant_id, next_attempt_at) WHERE status = 'pending';
CREATE INDEX notification_created_idx ON notification (tenant_id, created_at);
CREATE INDEX notification_ticket_idx ON notification (tenant_id, ticket_id) WHERE ticket_id IS NOT NULL;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['roster_entry', 'escalation_rule', 'notification'])
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

COMMIT;
