-- Revert of 0012_m2_schema.sql (ticket 29). destructive-approved: drops the three M2 tables and six columns this migration added, removes the pause and handback timers (projections that the ticket history can rebuild), and puts the two narrower CHECK constraints back.
-- backup: snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc). Dropping `roster_entry`, `escalation_rule` and `notification` deletes the duty roster, the ladder and every recorded message; dropping `breakdown_report.handover_person_id` loses the person a report was handed to (the typed `handover_name` of imported history stays).
BEGIN;
SET LOCAL lock_timeout = '5s';
-- erase_person goes back to 0009's version (it finds a signature by the typed name only).
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
      signature_file_id = CASE WHEN r.handover_name ~* pat THEN NULL ELSE r.signature_file_id END,
      pdf_file_id = NULL, qr_payload = '{}', updated_at = now()
    FROM breakdown_report old
    WHERE old.id = r.id AND r.tenant_id = p.tenant_id
      AND (r.pdf_file_id IS NOT NULL OR (r.signature_file_id IS NOT NULL AND r.handover_name ~* pat))
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

DROP TABLE notification;
DROP TABLE escalation_rule;
DROP TABLE roster_entry;

-- Only `ack` and `restore` timers fit the old constraints; the other two kinds are derived from events.
DELETE FROM sla_timer WHERE kind IN ('pause', 'handback');
ALTER TABLE sla_timer DROP CONSTRAINT sla_timer_stop_reason_kind;
ALTER TABLE sla_timer ADD CONSTRAINT sla_timer_stop_reason_kind CHECK (
  (kind = 'ack' AND (stop_reason IS NULL OR stop_reason IN ('acknowledged', 'started', 'closed', 'cancelled')))
  OR
  (kind = 'restore' AND (stop_reason IS NULL OR stop_reason IN ('machine_running', 'closed', 'cancelled')))
);
ALTER TABLE sla_timer DROP CONSTRAINT sla_timer_kind_check;
ALTER TABLE sla_timer ADD CONSTRAINT sla_timer_kind_check CHECK (kind IN ('ack', 'restore'));

ALTER TABLE breakdown_report DROP CONSTRAINT report_handover_tenant_fk;
ALTER TABLE breakdown_report DROP COLUMN handover_person_id;
ALTER TABLE list_item DROP COLUMN needs_lockout;
GRANT DELETE ON segment, shift, glossary_term TO app_user;
ALTER TABLE glossary_term DROP COLUMN active;
ALTER TABLE shift DROP COLUMN active;
ALTER TABLE segment DROP COLUMN active;
ALTER TABLE ticket_event DROP CONSTRAINT ticket_event_tenant_ticket_id_unique;
ALTER TABLE shift DROP CONSTRAINT shift_tenant_id_unique;
COMMIT;
