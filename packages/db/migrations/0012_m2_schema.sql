-- Migration 0012: the one M2 schema change. Ticket 29, ARCHITECTURE §9 items 30 and 32, D17 (the three M2 tables).
-- approved-by: orchestrator ruling (ticket 29 brief, 14 Nov: tables, columns and defaults); two adversarial schema reviews run on the PR
-- backup: full snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc), its id recorded in the deploy note.
--   Applying changes no row and deletes none: it adds three tables and six columns, and replaces two CHECK constraints on
--   `sla_timer` by wider ones. Revert: packages/db/migrations/down/0012_m2_schema.down.sql (it drops the three tables and
--   the six columns, so take a snapshot before a revert too).

BEGIN;

-- A stuck deploy must fail, not queue behind a long transaction and block the app behind it.
SET LOCAL lock_timeout = '5s';

-- Composite keys for the tenant-safe links below (the pattern of 0001): a row can only point at a row of its own plant.
ALTER TABLE shift ADD CONSTRAINT shift_tenant_id_unique UNIQUE (tenant_id, id);
-- (An event is only ever named together with its ticket, so a notification cannot cite another ticket's event.)
ALTER TABLE ticket_event ADD CONSTRAINT ticket_event_tenant_ticket_id_unique UNIQUE (tenant_id, ticket_id, id);

-- Segments, shifts and glossary terms can be switched off, never deleted (history names them): the application role
-- loses its DELETE right on them, as 0009 did for the history tables. Offboarding still removes them with the plant.
ALTER TABLE segment ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE shift ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE glossary_term ADD COLUMN active boolean NOT NULL DEFAULT true;
REVOKE DELETE ON segment, shift, glossary_term FROM app_user;

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
  -- A provider's error code only (`410`, `InvalidToken`), never a message: a message can hold a number or a name that
  -- erasing a person would leave behind.
  last_error text CHECK (last_error IS NULL OR last_error ~ '^[A-Za-z0-9_.:-]{1,40}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dedupe_key),
  CONSTRAINT notification_pending_shape CHECK ((status = 'pending') = (next_attempt_at IS NOT NULL)),
  CONSTRAINT notification_sent_shape CHECK ((status = 'sent') = (sent_at IS NOT NULL)),
  CONSTRAINT notification_person_tenant_fk FOREIGN KEY (tenant_id, person_id) REFERENCES person (tenant_id, id),
  CONSTRAINT notification_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES ticket (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT notification_event_needs_ticket CHECK (event_id IS NULL OR ticket_id IS NOT NULL),
  CONSTRAINT notification_event_tenant_fk FOREIGN KEY (tenant_id, ticket_id, event_id)
    REFERENCES ticket_event (tenant_id, ticket_id, id) ON DELETE CASCADE
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

-- A report handed over to a person now holds a link, not their typed name (and no typed copy), so erasure finds the
-- signature on a report handed over to the leaver by that link as well as by the typed name of imported history.
-- This is 0009's erase_person with that one condition widened in the two places it looks for the signature; the
-- owner and the grants (router only) stay as 0009 set them.
CREATE OR REPLACE FUNCTION erase_person(p_tenant_id uuid, p_person_id uuid, p_request_ref text, p_operator text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  p person%ROWTYPE;
  logins uuid[];
  terms text[];
  pat text;
  keys text[];
  n bigint;
  counts jsonb := '{}';
BEGIN
  IF btrim(coalesce(p_request_ref, '')) = '' OR btrim(coalesce(p_operator, '')) = '' THEN
    RAISE EXCEPTION 'erase_person: a request reference and an operator are required';
  END IF;
  SELECT * INTO p FROM person WHERE id = p_person_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'erase_person: person not found'; END IF;
  IF p.tenant_id IS DISTINCT FROM p_tenant_id THEN
    RAISE EXCEPTION 'erase_person: the person does not belong to this customer';
  END IF;
  logins := ARRAY(SELECT id FROM login WHERE tenant_id = p.tenant_id AND person_id = p.id);

  -- Search terms: name, short name, mobile number and own usernames. A term under three characters
  -- would match ordinary words, so it is counted and left for the plant's manual review.
  SELECT coalesce(array_agg(t) FILTER (WHERE length(t) >= 3), '{}'), count(*) FILTER (WHERE length(t) < 3)
    INTO terms, n
  FROM (
    SELECT DISTINCT btrim(x) AS t
    FROM unnest(ARRAY[p.name, p.short_name, p.phone]
      || ARRAY(SELECT username FROM login WHERE id = ANY(logins) AND NOT shared)) x
    WHERE btrim(coalesce(x, '')) <> '' AND lower(btrim(x)) <> 'former staff'
  ) s;
  counts := jsonb_build_object('skipped_short_terms', n, 'text_searched', cardinality(terms) > 0);
  -- Whole words only: each neighbour must be a space, ASCII punctuation or the start or end of the
  -- text, so a name inside a longer word (in any script) is left alone. Every other character of a
  -- term is taken literally; a run of spaces matches any run of spaces. NULL when there is no term:
  -- then nothing below searches text, and only the rows tied to the person by id are changed.
  SELECT '(?<![^[:space:][:punct:]])(?:' || string_agg(
      regexp_replace(regexp_replace(t, '([^[:alnum:][:space:]])', '\\\1', 'g'), '\s+', '\\s+', 'g'),
      '|' ORDER BY length(t) DESC, t) || ')(?![^[:space:][:punct:]])'
    INTO pat FROM unnest(terms) t;
  IF pat IS NOT NULL AND concat_ws(' ', p_request_ref, p_operator) ~* pat THEN
    RAISE EXCEPTION 'erase_person: the request reference and operator must not hold the name';
  END IF;

  UPDATE person SET name = 'Former staff', short_name = NULL, phone = NULL, title = NULL,
    default_shift = NULL, active = false, updated_at = now() WHERE id = p.id;
  UPDATE login SET username = 'former-' || id, password_hash = '!', must_change_password = false,
    disabled_at = coalesce(disabled_at, now()), updated_at = now() WHERE id = ANY(logins);
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('login', n);
  -- Their own devices go. A shared floor phone stays signed in; it only forgets who was acting.
  DELETE FROM session WHERE tenant_id = p.tenant_id AND login_id = ANY(logins);
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('session', n);
  DELETE FROM push_subscription WHERE tenant_id = p.tenant_id AND login_id = ANY(logins);
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('push_subscription', n);
  UPDATE session SET acting_person_id = NULL, updated_at = now()
  WHERE tenant_id = p.tenant_id AND acting_person_id = p.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('session_unlinked', n);
  UPDATE push_subscription SET acting_person_id = NULL, updated_at = now()
  WHERE tenant_id = p.tenant_id AND acting_person_id = p.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('push_subscription_unlinked', n);
  UPDATE command_idempotency SET result = '{}', updated_at = now()
  WHERE tenant_id = p.tenant_id AND result <> '{}'
    AND (login_id = ANY(logins)
      OR (pat IS NOT NULL AND erase_json_values(result, pat) IS DISTINCT FROM result));
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('command_idempotency', n);

  -- Stored files that show the name: the signature on a report handed over to this person, and every
  -- cached report PDF of the plant (a PDF is re-made on the next request, from the cleaned records).
  WITH cleared AS (
    UPDATE breakdown_report r SET
      signature_file_id = CASE WHEN r.handover_person_id = p.id OR r.handover_name ~* pat THEN NULL ELSE r.signature_file_id END,
      pdf_file_id = NULL, qr_payload = '{}', updated_at = now()
    FROM breakdown_report old
    WHERE old.id = r.id AND r.tenant_id = p.tenant_id
      AND (r.pdf_file_id IS NOT NULL
        OR (r.signature_file_id IS NOT NULL AND (r.handover_person_id = p.id OR r.handover_name ~* pat)))
    RETURNING old.pdf_file_id AS pdf_id,
      CASE WHEN r.signature_file_id IS NULL THEN old.signature_file_id END AS signature_id
  ), gone AS (
    DELETE FROM file f USING cleared c
    WHERE f.tenant_id = p.tenant_id AND f.id IN (c.pdf_id, c.signature_id) RETURNING f.s3_key
  )
  SELECT coalesce(array_agg(s3_key), '{}') INTO keys FROM gone;
  counts := counts || jsonb_build_object('file', cardinality(keys));

  -- Audit lines about this person or their logins keep the fact, the time, the actor and which fields
  -- changed; every stored value is blanked.
  UPDATE audit_log SET
    before = CASE WHEN jsonb_typeof(before) = 'object'
      THEN (SELECT jsonb_object_agg(k, NULL) FROM jsonb_object_keys(before) k) END,
    after = CASE WHEN jsonb_typeof(after) = 'object'
      THEN (SELECT jsonb_object_agg(k, NULL) FROM jsonb_object_keys(after) k) END,
    updated_at = now()
  WHERE tenant_id = p.tenant_id AND entity IN ('person', 'login') AND entity_id = ANY(logins || p.id)
    AND action <> 'person.erase';
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('audit_log_own', n);
  -- The address a leaver's logins signed in from is personal data too.
  UPDATE audit_log SET ip = NULL, updated_at = now()
  WHERE tenant_id = p.tenant_id AND login_id = ANY(logins) AND ip IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('audit_log_ip', n);

  IF pat IS NOT NULL THEN
    UPDATE breakdown_report SET
      problem = regexp_replace(problem, pat, 'Former staff', 'gi'),
      observed_by = regexp_replace(observed_by, pat, 'Former staff', 'gi'),
      corrective_action = regexp_replace(corrective_action, pat, 'Former staff', 'gi'),
      spare_used = regexp_replace(spare_used, pat, 'Former staff', 'gi'),
      root_cause = regexp_replace(root_cause, pat, 'Former staff', 'gi'),
      handover_name = regexp_replace(handover_name, pat, 'Former staff', 'gi'),
      updated_at = now()
    WHERE tenant_id = p.tenant_id AND concat_ws(' ', problem, observed_by, corrective_action,
      spare_used, root_cause, handover_name) ~* pat;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('breakdown_report', n);
    UPDATE ticket SET
      problem = regexp_replace(problem, pat, 'Former staff', 'gi'),
      close_note = regexp_replace(close_note, pat, 'Former staff', 'gi'),
      waiting_spare = regexp_replace(waiting_spare, pat, 'Former staff', 'gi'),
      task_reason = regexp_replace(task_reason, pat, 'Former staff', 'gi'),
      location = regexp_replace(location, pat, 'Former staff', 'gi'),
      overrides = erase_json_values(overrides, pat),
      updated_at = now()
    WHERE tenant_id = p.tenant_id AND (concat_ws(' ', problem, close_note, waiting_spare, task_reason,
      location) ~* pat OR erase_json_values(overrides, pat) IS DISTINCT FROM overrides);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('ticket', n);
    -- The one permitted edit of ticket history (DATA-MAP §5).
    UPDATE ticket_event SET
      text = regexp_replace(text, pat, 'Former staff', 'gi'),
      payload = erase_json_values(payload, pat),
      updated_at = now()
    WHERE tenant_id = p.tenant_id
      AND (text ~* pat OR erase_json_values(payload, pat) IS DISTINCT FROM payload);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('ticket_event', n);
    UPDATE import_row SET payload = '{}', updated_at = now()
    WHERE tenant_id = p.tenant_id AND erase_json_values(payload, pat) IS DISTINCT FROM payload;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('import_row', n);
    -- stats.completion is the undo fingerprint (ids and digests, no names) and is kept as it is.
    UPDATE import_batch SET
      stats = erase_json_values(stats - 'completion', pat)
        || CASE WHEN stats ? 'completion' THEN jsonb_build_object('completion', stats -> 'completion') ELSE '{}' END,
      updated_at = now()
    WHERE tenant_id = p.tenant_id
      AND erase_json_values(stats - 'completion', pat) IS DISTINCT FROM (stats - 'completion');
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('import_batch', n);
    UPDATE audit_log SET
      before = erase_json_values(before, pat),
      after = erase_json_values(after, pat),
      updated_at = now()
    WHERE tenant_id = p.tenant_id AND (erase_json_values(before, pat) IS DISTINCT FROM before
      OR erase_json_values(after, pat) IS DISTINCT FROM after);
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('audit_log', n);
  END IF;

  INSERT INTO audit_log (tenant_id, action, entity, entity_id, after)
  VALUES (p.tenant_id, 'person.erase', 'person', p.id,
    counts || jsonb_build_object('request_ref', p_request_ref, 'operator', p_operator));
  RETURN counts || jsonb_build_object('s3_keys', to_jsonb(keys));
END $$;

COMMIT;
