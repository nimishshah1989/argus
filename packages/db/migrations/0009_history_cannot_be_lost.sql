-- Migration 0009: history cannot be lost (cutover). Ticket 07, ARCHITECTURE §9 items 21, 24, 25, 27, 31, 33.
-- approved-by: schema-reviewer: PENDING
-- backup: full snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc), its id recorded in the
--   deploy note; then `tsx scripts/preflight-cutover.ts` (must exit 0) and `tsx scripts/export-tags.ts`, which
--   writes ticket_tag-<utc>.csv beside the backup and prints the row count N. If N > 0 the migration runs only
--   with PGOPTIONS='-c uptimo.tags_exported=N'. Revert: packages/db/migrations/down/0009_history_cannot_be_lost.down.sql.
-- Design and every rejected alternative: docs/slices/07-schema-notes.md.

BEGIN;

-- Fail loudly, never silently: with row security off, a query that a policy would filter raises an
-- error instead of returning fewer rows. Every table this file reads, rewrites or re-validates a key
-- on has FORCE lifted for the length of the transaction (the owner is then exempt) and put back in
-- part 9. Needed because the migration role on RDS is the table owner, not a superuser.
SET LOCAL row_security = off;
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['ticket_tag', 'person', 'login', 'ticket', 'ticket_event', 'crew_member',
    'work_segment', 'breakdown_report', 'breakdown_report_person', 'file', 'audit_log', 'platform_access'])
  LOOP
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 1. Guards. Nothing is fixed automatically; a failure here rolls the whole file back.
DO $$
DECLARE
  tags bigint;
  duplicates text;
BEGIN
  SELECT count(*) INTO tags FROM ticket_tag;
  IF tags > 0 AND current_setting('uptimo.tags_exported', true) IS DISTINCT FROM tags::text THEN
    RAISE EXCEPTION 'Cutover stopped: ticket_tag holds % rows. Run scripts/export-tags.ts, then migrate with PGOPTIONS=''-c uptimo.tags_exported=%''', tags, tags;
  END IF;

  SELECT string_agg(format('tenant %s machine %s: %s', d.tenant_id, d.machine_id, d.refs), '; ')
    INTO duplicates
  FROM (
    SELECT tenant_id, machine_id, string_agg(ref, ', ' ORDER BY ref) AS refs
    FROM ticket
    WHERE machine_id IS NOT NULL AND kind <> 'general' AND status NOT IN ('closed', 'cancelled')
    GROUP BY tenant_id, machine_id
    HAVING count(*) > 1
  ) d;
  IF duplicates IS NOT NULL THEN
    RAISE EXCEPTION 'Cutover stopped: more than one open breakdown on a machine (resolve with correct or cancel): %', duplicates;
  END IF;
END $$;

-- 2. The router role stops bypassing row security; it gets explicit policies instead (part 7), so the
-- same design runs where BYPASSRLS cannot be granted. Changed only where it is set: a role that cannot
-- grant the attribute cannot have created it.
DO $$
BEGIN
  IF (SELECT rolbypassrls FROM pg_roles WHERE rolname = 'app_router') THEN
    ALTER ROLE app_router NOBYPASSRLS;
  END IF;
END $$;

-- 3. Tags are removed (D14, D17, DATA-MAP question 12). Rows were exported by the guard's rule above.
DROP TABLE ticket_tag;

-- 4. History references refuse a delete instead of cascading or going empty. Each constraint is
-- re-created with the same columns and target; only ON DELETE changes.
ALTER TABLE login
  DROP CONSTRAINT login_person_id_fkey,
  ADD CONSTRAINT login_person_id_fkey FOREIGN KEY (person_id) REFERENCES person(id) ON DELETE RESTRICT;
ALTER TABLE ticket
  DROP CONSTRAINT ticket_reported_by_person_id_fkey,
  DROP CONSTRAINT ticket_raised_login_id_fkey,
  DROP CONSTRAINT ticket_lead_person_id_fkey,
  DROP CONSTRAINT ticket_transfer_to_person_id_fkey,
  DROP CONSTRAINT ticket_paused_by_person_id_fkey,
  DROP CONSTRAINT ticket_assigned_to_person_id_fkey,
  DROP CONSTRAINT ticket_closed_by_person_id_fkey,
  DROP CONSTRAINT ticket_parent_id_fkey,
  ADD CONSTRAINT ticket_reported_by_person_id_fkey FOREIGN KEY (reported_by_person_id) REFERENCES person(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ticket_raised_login_id_fkey FOREIGN KEY (raised_login_id) REFERENCES login(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ticket_lead_person_id_fkey FOREIGN KEY (lead_person_id) REFERENCES person(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ticket_transfer_to_person_id_fkey FOREIGN KEY (transfer_to_person_id) REFERENCES person(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ticket_paused_by_person_id_fkey FOREIGN KEY (paused_by_person_id) REFERENCES person(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ticket_assigned_to_person_id_fkey FOREIGN KEY (assigned_to_person_id) REFERENCES person(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ticket_closed_by_person_id_fkey FOREIGN KEY (closed_by_person_id) REFERENCES person(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ticket_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES ticket(id) ON DELETE RESTRICT;
ALTER TABLE ticket_event
  DROP CONSTRAINT ticket_event_ticket_id_fkey,
  DROP CONSTRAINT ticket_event_login_id_fkey,
  DROP CONSTRAINT ticket_event_acting_person_id_fkey,
  ADD CONSTRAINT ticket_event_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ticket_event_login_id_fkey FOREIGN KEY (login_id) REFERENCES login(id) ON DELETE RESTRICT,
  ADD CONSTRAINT ticket_event_acting_person_id_fkey FOREIGN KEY (acting_person_id) REFERENCES person(id) ON DELETE RESTRICT;
ALTER TABLE crew_member
  DROP CONSTRAINT crew_member_ticket_id_fkey,
  ADD CONSTRAINT crew_member_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE RESTRICT;
ALTER TABLE work_segment
  DROP CONSTRAINT work_segment_ticket_id_fkey,
  ADD CONSTRAINT work_segment_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE RESTRICT;
ALTER TABLE breakdown_report
  DROP CONSTRAINT breakdown_report_ticket_id_fkey,
  DROP CONSTRAINT breakdown_report_submitted_by_person_id_fkey,
  ADD CONSTRAINT breakdown_report_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE RESTRICT,
  ADD CONSTRAINT breakdown_report_submitted_by_person_id_fkey FOREIGN KEY (submitted_by_person_id) REFERENCES person(id) ON DELETE RESTRICT;
ALTER TABLE breakdown_report_person
  DROP CONSTRAINT breakdown_report_person_report_id_fkey,
  ADD CONSTRAINT breakdown_report_person_report_id_fkey FOREIGN KEY (report_id) REFERENCES breakdown_report(id) ON DELETE RESTRICT;
ALTER TABLE file
  DROP CONSTRAINT file_ticket_id_fkey,
  DROP CONSTRAINT file_uploaded_by_fkey,
  ADD CONSTRAINT file_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES ticket(id) ON DELETE RESTRICT,
  ADD CONSTRAINT file_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES person(id) ON DELETE RESTRICT;
ALTER TABLE audit_log
  DROP CONSTRAINT audit_log_login_id_fkey,
  ADD CONSTRAINT audit_log_login_id_fkey FOREIGN KEY (login_id) REFERENCES login(id) ON DELETE RESTRICT;

-- 5. Support access (item 31). A grant ends within 7 days and names the customer admin who approved it;
-- an audit line can say which grant it was taken under.
INSERT INTO audit_log (tenant_id, action, entity, entity_id, before, after)
SELECT tenant_id, 'migration.0009.platform_access_expiry', 'platform_access', id,
       jsonb_build_object('expires_at', expires_at),
       jsonb_build_object('expires_at', created_at + interval '7 days')
FROM platform_access
WHERE expires_at IS NULL OR expires_at > created_at + interval '7 days';
UPDATE platform_access SET expires_at = created_at + interval '7 days', updated_at = now()
WHERE expires_at IS NULL OR expires_at > created_at + interval '7 days';

ALTER TABLE platform_access
  ADD COLUMN approved_by_login_id uuid,
  ALTER COLUMN expires_at SET NOT NULL,
  ADD CONSTRAINT platform_access_tenant_id_unique UNIQUE (tenant_id, id),
  ADD CONSTRAINT platform_access_expiry_window CHECK (expires_at <= created_at + interval '7 days'),
  ADD CONSTRAINT platform_access_approver_tenant_fk FOREIGN KEY (tenant_id, approved_by_login_id)
    REFERENCES login (tenant_id, id) ON DELETE RESTRICT,
  -- NOT VALID: enforced on every new or changed row; rows from before the rule keep an empty approver.
  ADD CONSTRAINT platform_access_approver_required CHECK (approved_by_login_id IS NOT NULL) NOT VALID;
ALTER TABLE audit_log
  ADD COLUMN platform_access_id uuid,
  ADD CONSTRAINT audit_log_platform_access_tenant_fk FOREIGN KEY (tenant_id, platform_access_id)
    REFERENCES platform_access (tenant_id, id) ON DELETE RESTRICT;
CREATE INDEX audit_log_platform_access_idx ON audit_log (tenant_id, platform_access_id)
  WHERE platform_access_id IS NOT NULL;

-- 6. Indexes (items 24 and 25).
CREATE INDEX ticket_reported_idx ON ticket (tenant_id, reported_at);
CREATE INDEX ticket_reporter_idx ON ticket (tenant_id, reported_by_person_id, reported_at);
CREATE INDEX work_segment_person_idx ON work_segment (tenant_id, person_id, started_at);
CREATE INDEX ticket_event_actor_idx ON ticket_event (tenant_id, acting_person_id, at);
CREATE UNIQUE INDEX ticket_open_breakdown_unique ON ticket (tenant_id, machine_id)
  WHERE kind <> 'general' AND status NOT IN ('closed', 'cancelled');

-- 7. What the app role can no longer do, and what the router role's functions may touch.
REVOKE UPDATE, DELETE ON ticket_event FROM app_user;
REVOKE DELETE ON ticket, work_segment, crew_member, breakdown_report, breakdown_report_person,
  list_item, login, person FROM app_user;

GRANT SELECT, UPDATE, DELETE ON person, login, session, push_subscription, ticket, ticket_event,
  work_segment, crew_member, breakdown_report, breakdown_report_person, file, import_batch, import_row,
  audit_log, command_idempotency TO app_router;
GRANT INSERT ON audit_log TO app_router;
GRANT DELETE ON tenant TO app_router;
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'person', 'login', 'session', 'push_subscription', 'ticket', 'ticket_event', 'work_segment',
    'crew_member', 'breakdown_report', 'breakdown_report_person', 'file', 'import_batch', 'import_row',
    'audit_log', 'command_idempotency', 'sla_policy'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS router_definer ON %I', t);  -- three survive a revert
    EXECUTE format('CREATE POLICY router_definer ON %I TO app_router USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;

-- 8. The four definer functions: the only paths that delete history or edit it. Each is owned by
-- app_router, pins search_path, and is executable by app_router alone (never by app_user or app_api).

-- Removes what one import batch created. Tickets come from the batch's own rows, never from the caller.
CREATE FUNCTION import_undo(p_batch_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  b record;
  ids uuid[];
  fingerprint uuid[];
  removed integer;
BEGIN
  SELECT tenant_id, status, stats INTO b FROM import_batch
  WHERE id = p_batch_id AND source = 'bhavin' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'import_undo: batch not found'; END IF;
  IF b.status NOT IN ('done', 'failed') THEN
    RAISE EXCEPTION 'import_undo: batch status % is not undoable', b.status;
  END IF;
  IF jsonb_typeof(b.stats #> '{completion,tickets}') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'import_undo: batch has no completion fingerprint';
  END IF;
  ids := ARRAY(SELECT r.ticket_id FROM import_row r
    WHERE r.tenant_id = b.tenant_id AND r.batch_id = p_batch_id AND r.status = 'imported'
      AND r.ticket_id IS NOT NULL);
  fingerprint := ARRAY(SELECT (t ->> 'ticketId')::uuid
    FROM jsonb_array_elements(b.stats #> '{completion,tickets}') t);
  IF NOT (ids @> fingerprint AND fingerprint @> ids) THEN
    RAISE EXCEPTION 'import_undo: the batch rows and its completion fingerprint name different tickets';
  END IF;
  IF EXISTS (SELECT 1 FROM ticket WHERE tenant_id = b.tenant_id AND id = ANY(ids)
      AND raised_channel NOT IN ('import', 'backfill')) THEN
    RAISE EXCEPTION 'import_undo: a ticket of this batch was not raised by an import';
  END IF;
  IF EXISTS (SELECT 1 FROM ticket WHERE tenant_id = b.tenant_id AND parent_id = ANY(ids)
      AND id <> ALL(ids)) THEN
    RAISE EXCEPTION 'import_undo: a ticket outside the batch follows one inside it';
  END IF;
  IF EXISTS (SELECT 1 FROM file WHERE tenant_id = b.tenant_id AND ticket_id = ANY(ids))
    OR EXISTS (SELECT 1 FROM breakdown_report WHERE tenant_id = b.tenant_id AND ticket_id = ANY(ids)
      AND (signature_file_id IS NOT NULL OR pdf_file_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'import_undo: a file is attached to a ticket or report of this batch';
  END IF;

  DELETE FROM breakdown_report_person WHERE tenant_id = b.tenant_id AND report_id IN (
    SELECT id FROM breakdown_report WHERE tenant_id = b.tenant_id AND ticket_id = ANY(ids));
  DELETE FROM breakdown_report WHERE tenant_id = b.tenant_id AND ticket_id = ANY(ids);
  DELETE FROM work_segment WHERE tenant_id = b.tenant_id AND ticket_id = ANY(ids);
  DELETE FROM crew_member WHERE tenant_id = b.tenant_id AND ticket_id = ANY(ids);
  DELETE FROM ticket_event WHERE tenant_id = b.tenant_id AND ticket_id = ANY(ids);
  -- import_row.ticket_id goes empty and sla_timer rows go with the ticket (their keys are unchanged).
  DELETE FROM ticket WHERE tenant_id = b.tenant_id AND id = ANY(ids);
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed <> cardinality(ids) THEN
    RAISE EXCEPTION 'import_undo: expected % tickets, removed %', cardinality(ids), removed;
  END IF;

  UPDATE import_batch SET status = 'undone', updated_at = now() WHERE id = p_batch_id;
  INSERT INTO audit_log (tenant_id, action, entity, entity_id, before, after)
  VALUES (b.tenant_id, 'import.undo', 'import_batch', p_batch_id,
    jsonb_build_object('status', b.status, 'fingerprintDigest', b.stats #>> '{completion,digest}',
      'ticketIds', to_jsonb(ids)),
    jsonb_build_object('status', 'undone', 'deleted', removed));
  RETURN removed;
END $$;

-- Replaces a leaver's name in every place DATA-MAP §5 lists. Deletes no history row. Writes one audit
-- row holding counts only. Returns the counts and the storage keys the caller must delete.
CREATE FUNCTION erase_person(p_person_id uuid, p_request_ref text) RETURNS jsonb
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
  IF btrim(coalesce(p_request_ref, '')) = '' THEN
    RAISE EXCEPTION 'erase_person: a request reference is required';
  END IF;
  SELECT * INTO p FROM person WHERE id = p_person_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'erase_person: person not found'; END IF;
  logins := ARRAY(SELECT id FROM login WHERE tenant_id = p.tenant_id AND person_id = p.id);

  -- Search terms: name, short name, mobile number and own usernames; longest first. A term under three
  -- characters would match ordinary words, so it is counted and left for the plant's manual review.
  SELECT coalesce(array_agg(t) FILTER (WHERE length(t) >= 3), '{}'), count(*) FILTER (WHERE length(t) < 3)
    INTO terms, n
  FROM (
    SELECT DISTINCT btrim(x) AS t
    FROM unnest(ARRAY[p.name, p.short_name, p.phone]
      || ARRAY(SELECT username FROM login WHERE id = ANY(logins) AND NOT shared)) x
    WHERE btrim(coalesce(x, '')) <> '' AND lower(btrim(x)) <> 'former staff'
  ) s;
  counts := jsonb_build_object('terms_too_short', n);
  IF EXISTS (SELECT 1 FROM unnest(terms) t WHERE t ~ '["\\]') THEN
    RAISE EXCEPTION 'erase_person: the name holds a quote or backslash; correct the person first';
  END IF;
  -- Whole words only: a neighbour that is not a letter or digit ends the word. Every other character
  -- of a term is taken literally; a run of spaces matches any run of spaces. NULL when there is no term.
  SELECT '(?<![[:alnum:]])(?:' || string_agg(
      regexp_replace(regexp_replace(t, '([^[:alnum:][:space:]])', '\\\1', 'g'), '\s+', '\\s+', 'g'),
      '|' ORDER BY length(t) DESC, t) || ')(?![[:alnum:]])'
    INTO pat FROM unnest(terms) t;
  IF p_request_ref ~* pat THEN
    RAISE EXCEPTION 'erase_person: the request reference must not hold the name';
  END IF;

  UPDATE person SET name = 'Former staff', short_name = NULL, phone = NULL, title = NULL,
    default_shift = NULL, active = false, updated_at = now() WHERE id = p.id;
  UPDATE login SET username = 'former-' || id, password_hash = '!', must_change_password = false,
    disabled_at = coalesce(disabled_at, now()), updated_at = now() WHERE id = ANY(logins);
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('login', n);
  DELETE FROM session WHERE tenant_id = p.tenant_id AND (login_id = ANY(logins) OR acting_person_id = p.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('session', n);
  DELETE FROM push_subscription WHERE tenant_id = p.tenant_id AND (login_id = ANY(logins) OR acting_person_id = p.id);
  GET DIAGNOSTICS n = ROW_COUNT;
  counts := counts || jsonb_build_object('push_subscription', n);
  UPDATE command_idempotency SET result = '{}', updated_at = now()
  WHERE tenant_id = p.tenant_id AND result <> '{}' AND (login_id = ANY(logins) OR result::text ~* pat);
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
      overrides = regexp_replace(overrides::text, pat, 'Former staff', 'gi')::jsonb,
      updated_at = now()
    WHERE tenant_id = p.tenant_id AND concat_ws(' ', problem, close_note, waiting_spare, task_reason,
      overrides::text) ~* pat;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('ticket', n);
    -- The one permitted edit of ticket history (DATA-MAP §5).
    UPDATE ticket_event SET
      text = regexp_replace(text, pat, 'Former staff', 'gi'),
      payload = regexp_replace(payload::text, pat, 'Former staff', 'gi')::jsonb,
      updated_at = now()
    WHERE tenant_id = p.tenant_id AND concat_ws(' ', text, payload::text) ~* pat;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('ticket_event', n);
    UPDATE import_row SET payload = '{}', updated_at = now()
    WHERE tenant_id = p.tenant_id AND payload::text ~* pat;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('import_row', n);
    UPDATE audit_log SET
      before = regexp_replace(before::text, pat, 'Former staff', 'gi')::jsonb,
      after = regexp_replace(after::text, pat, 'Former staff', 'gi')::jsonb,
      updated_at = now()
    WHERE tenant_id = p.tenant_id AND concat_ws(' ', before::text, after::text) ~* pat;
    GET DIAGNOSTICS n = ROW_COUNT;
    counts := counts || jsonb_build_object('audit_log', n);
  END IF;

  INSERT INTO audit_log (tenant_id, action, entity, entity_id, after)
  VALUES (p.tenant_id, 'person.erase', 'person', p.id,
    counts || jsonb_build_object('request_ref', p_request_ref));
  RETURN counts || jsonb_build_object('s3_keys', to_jsonb(keys));
END $$;

-- Deletes one customer: the tenant row, whose ON DELETE CASCADE keys take every row that carries its
-- tenant_id (the history checks of part 4 run after the cascades, so they pass). Refuses without an
-- export and a backup reference, and unless the customer was suspended first. The app role has no
-- right on tenant, so apart from the database owner this is the only path that deletes a customer.
CREATE FUNCTION offboard_tenant(p_tenant_id uuid, p_export_ref text, p_backup_ref text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF btrim(coalesce(p_export_ref, '')) = '' OR btrim(coalesce(p_backup_ref, '')) = '' THEN
    RAISE EXCEPTION 'offboard_tenant: an export reference and a backup reference are both required';
  END IF;
  DELETE FROM tenant WHERE id = p_tenant_id AND status = 'suspended';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'offboard_tenant: tenant not found or not suspended';
  END IF;
  RAISE LOG 'offboard_tenant % export=% backup=%', p_tenant_id, p_export_ref, p_backup_ref;
END $$;

-- Retention: removes audit rows older than the caller's cut-off, which may never be newer than 3 years.
CREATE FUNCTION audit_purge(p_older_than timestamptz) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  IF p_older_than IS NULL OR p_older_than > now() - interval '3 years' THEN
    RAISE EXCEPTION 'audit_purge: the cut-off must be at least 3 years ago';
  END IF;
  DELETE FROM audit_log WHERE at < p_older_than;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

ALTER FUNCTION import_undo(uuid) OWNER TO app_router;
ALTER FUNCTION erase_person(uuid, text) OWNER TO app_router;
ALTER FUNCTION offboard_tenant(uuid, text, text) OWNER TO app_router;
ALTER FUNCTION audit_purge(timestamptz) OWNER TO app_router;
REVOKE ALL ON FUNCTION import_undo(uuid), erase_person(uuid, text),
  offboard_tenant(uuid, text, text), audit_purge(timestamptz) FROM PUBLIC;

-- 9. Row security is forced again on every table opened at the top (ticket_tag is gone).
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['person', 'login', 'ticket', 'ticket_event', 'crew_member',
    'work_segment', 'breakdown_report', 'breakdown_report_person', 'file', 'audit_log', 'platform_access'])
  LOOP
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

COMMIT;
