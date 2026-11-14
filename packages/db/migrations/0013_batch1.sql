-- Migration 0013: migration batch 1. Three additive changes and one function replaced: an index for the day board,
-- push registrations that end with their sign-in, and the stored proof that an erased person stays erased.
-- approved-by: orchestrator ruling (backend lane, 14 Nov: migration batch 1 brief; erased-stays-erased ruled by Nimish 14 Nov); two adversarial schema reviews run on the PR
-- backup: full snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc), its id recorded in the deploy note.
--   Applying changes no existing row and deletes none: one index, one unique constraint and one index on small tables,
--   three nullable columns that start NULL, one trigger, and `erase_person` replaced by a version that takes one more
--   argument. Row counts touched by each statement are listed in the PR body (all zero). Revert:
--   packages/db/migrations/down/0013_batch1.down.sql. Take a snapshot before a revert too: it drops `person.erasure_hash` and `erasure_name_hash`,
--   and with it the only record of who was erased, and `push_subscription.session_id`.

BEGIN;

-- A stuck deploy must fail, not queue behind a long transaction and block the app behind it.
SET LOCAL lock_timeout = '5s';

-- 1. The day board filters on the day a breakdown was closed. Closed tickets only: an open ticket has no
-- `closed_at`, so the index stays as narrow as the closed history is long. (The runner wraps a file in one
-- transaction, so it cannot build the index CONCURRENTLY; the build blocks writes to `ticket` for its length.)
CREATE INDEX ticket_closed_idx ON ticket (tenant_id, closed_at) WHERE closed_at IS NOT NULL;

-- 2. A push registration belongs to the sign-in (session) that made it. Every way a sign-in ends sets
-- `revoked_at` (sign out, password change, switch-off, the device list): none deletes the row. So the registration
-- is dropped by a trigger on that one column, which no current or future caller can forget; the foreign key's
-- cascade covers the later purge of old sessions and `erase_person`, which delete the row. A registration with no
-- session (one made before this change) is untouched until its phone registers again, which binds it.
ALTER TABLE session ADD CONSTRAINT session_tenant_id_unique UNIQUE (tenant_id, id);
ALTER TABLE push_subscription ADD COLUMN session_id uuid;
ALTER TABLE push_subscription ADD CONSTRAINT push_session_tenant_fk
  FOREIGN KEY (tenant_id, session_id) REFERENCES session (tenant_id, id) ON DELETE CASCADE;
CREATE INDEX push_subscription_session_idx ON push_subscription (tenant_id, session_id)
  WHERE session_id IS NOT NULL;

-- Runs as the caller, inside the tenant transaction that revokes the session, so row security still applies:
-- it can only ever drop the registrations of the plant the caller is in.
CREATE FUNCTION push_subscription_drop_on_signout() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM push_subscription WHERE tenant_id = NEW.tenant_id AND session_id = NEW.id;
  RETURN NULL;
END $$;
CREATE TRIGGER session_signout_drops_push AFTER UPDATE OF revoked_at ON session
  FOR EACH ROW WHEN (OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL)
  EXECUTE FUNCTION push_subscription_drop_on_signout();

-- 3. Erased stays erased. The person row stays (history names it); this keyed hash of the normalised name and
-- number (HMAC-SHA256, the key lives in the server's environment and never in the database) is what a later create
-- or import is compared with (the number is part of it). NULL for everyone not erased, and for people erased before this change: their name is
-- gone, so no hash can be made for them.
ALTER TABLE person ADD COLUMN erasure_hash text;
ALTER TABLE person ADD CONSTRAINT person_erasure_hash_shape
  CHECK (erasure_hash IS NULL OR erasure_hash ~ '^[0-9a-f]{64}$');
CREATE INDEX person_erasure_hash_idx ON person (tenant_id, erasure_hash) WHERE erasure_hash IS NOT NULL;
-- The same keyed hash over the normalised name alone. An import carries names and no numbers, so it can only ever
-- say "possible match with a previously erased person": two colleagues can share a name, so this never blocks.
ALTER TABLE person ADD COLUMN erasure_name_hash text;
ALTER TABLE person ADD CONSTRAINT person_erasure_name_hash_shape
  CHECK (erasure_name_hash IS NULL OR erasure_name_hash ~ '^[0-9a-f]{64}$');
CREATE INDEX person_erasure_name_hash_idx ON person (tenant_id, erasure_name_hash)
  WHERE erasure_name_hash IS NOT NULL;

-- erase_person gains the hash as its last argument and stores it on the person in the same statement that
-- replaces the name. It is 0012's version otherwise; the owner and the grants are set again because the signature is new.
CREATE FUNCTION erase_person(p_tenant_id uuid, p_person_id uuid, p_request_ref text, p_operator text, p_erasure_hash text, p_erasure_name_hash text) RETURNS jsonb
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
  -- The keyed hash is computed by the server from the name and number before this call (the key never enters the
  -- database). Without one the erasure is refused: a person erased without it could be created again.
  IF p_erasure_hash IS NULL OR p_erasure_hash !~ '^[0-9a-f]{64}$'
    OR p_erasure_name_hash IS NULL OR p_erasure_name_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'erase_person: an erasure hash is required';
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
    default_shift = NULL, active = false, erasure_hash = p_erasure_hash, erasure_name_hash = p_erasure_name_hash, updated_at = now() WHERE id = p.id;
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
DROP FUNCTION erase_person(uuid, uuid, text, text);
ALTER FUNCTION erase_person(uuid, uuid, text, text, text, text) OWNER TO app_router;
REVOKE ALL ON FUNCTION erase_person(uuid, uuid, text, text, text, text) FROM PUBLIC;

COMMIT;
