-- Migration 0011: the company profile can be written, and a logo is kept in the database. Ticket 23, goal 2.
-- approved-by: orchestrator ruling (ticket 23, 14 Nov): company name, language, time zone and logo must be real settings; logo bytes live in the database (reviewer ruling, same day).
-- backup: none needed to apply. Additive: one nullable column on `file`, one column-level right and three functions. Applying it reads, changes and deletes no row.
--   Before a revert, take a snapshot: the down file drops the column, and with it every stored logo.
--   Revert: packages/db/migrations/down/0011_tenant_profile.down.sql.

BEGIN;

-- A logo is at most 256 KB, so its bytes live in the row itself: database backups cover it, a redeploy cannot
-- lose it, and no disk is needed on the server. Only a `logo` may carry content; `s3_key` for such a row is a
-- placeholder (`db:logo/<id>`), `bytes` and `sha256` describe the content as for any file.
ALTER TABLE file ADD COLUMN content bytea;
ALTER TABLE file ADD CONSTRAINT file_content_logo_only
  CHECK (content IS NULL OR (kind = 'logo' AND octet_length(content) <= 262144));

-- The application role cannot touch `tenant` (0001): it reads name, language and time zone through definer
-- functions. These three are the only ways to write them, and to find a logo, without opening the table.
-- Each is owned by app_router, pins search_path, and is executable by app_user alone (PUBLIC is revoked).

-- app_router may change exactly these columns, and only through the two writing functions below.
GRANT UPDATE (name, language, time_zone, logo_file_id, updated_at) ON tenant TO app_router;

-- Changes the signed-in plant's name, language and time zone; a NULL argument leaves that value as it is.
-- The plant is `app.tenant_id`, the setting every request transaction already carries for row security:
-- when it is missing or not a uuid the function stops, so it can never write a plant the caller is not in.
CREATE FUNCTION tenant_update_profile(p_name text, p_language text, p_time_zone text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  scope uuid := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
  zone text;
BEGIN
  IF scope IS NULL THEN RAISE EXCEPTION 'tenant_update_profile: no plant in scope'; END IF;
  IF p_name IS NOT NULL AND btrim(p_name) = '' THEN
    RAISE EXCEPTION 'tenant_update_profile: the name cannot be empty';
  END IF;
  IF p_language IS NOT NULL AND p_language NOT IN ('en', 'gu', 'hi') THEN
    RAISE EXCEPTION 'tenant_update_profile: unsupported language';
  END IF;
  -- The zone is stored as the database spells it (`asia/kolkata` becomes `Asia/Kolkata`): every shift and
  -- report query hands this value back to the database, which is the judge of what a zone is.
  IF p_time_zone IS NOT NULL THEN
    SELECT z.name INTO zone FROM pg_catalog.pg_timezone_names z
     WHERE lower(z.name) = lower(p_time_zone) ORDER BY z.name = p_time_zone DESC LIMIT 1;
    IF zone IS NULL THEN RAISE EXCEPTION 'tenant_update_profile: unknown time zone'; END IF;
  END IF;
  UPDATE tenant SET
    name = COALESCE(btrim(p_name), name),
    language = COALESCE(p_language, language),
    time_zone = COALESCE(zone, time_zone),
    updated_at = now()
  WHERE id = scope;
END $$;

-- Points the signed-in plant at one of its own logo files (or at none, with NULL). The file must be a
-- `logo` of that plant; the trigger from 0001 also refuses another plant's file.
CREATE FUNCTION tenant_set_logo(p_file_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE scope uuid := NULLIF(current_setting('app.tenant_id', true), '')::uuid;
BEGIN
  IF scope IS NULL THEN RAISE EXCEPTION 'tenant_set_logo: no plant in scope'; END IF;
  IF p_file_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM file f WHERE f.id = p_file_id AND f.tenant_id = scope AND f.kind = 'logo'
  ) THEN
    RAISE EXCEPTION 'tenant_set_logo: not a logo of this plant';
  END IF;
  UPDATE tenant SET logo_file_id = p_file_id, updated_at = now() WHERE id = scope;
END $$;

-- The public brand route runs before anyone signs in: given a company's address it returns that company's
-- logo file id, and only when the file is a `logo` kept by that same company (never another plant's, never
-- another kind of file).
CREATE FUNCTION tenant_logo(p_slug text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT f.id
  FROM tenant t
  JOIN file f ON f.id = t.logo_file_id AND f.tenant_id = t.id AND f.kind = 'logo'
  WHERE t.slug = p_slug AND t.status = 'active';
$$;

ALTER FUNCTION tenant_update_profile(text, text, text) OWNER TO app_router;
ALTER FUNCTION tenant_set_logo(uuid) OWNER TO app_router;
ALTER FUNCTION tenant_logo(text) OWNER TO app_router;
REVOKE ALL ON FUNCTION tenant_update_profile(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION tenant_set_logo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION tenant_logo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_update_profile(text, text, text) TO app_user;
GRANT EXECUTE ON FUNCTION tenant_set_logo(uuid) TO app_user;
GRANT EXECUTE ON FUNCTION tenant_logo(text) TO app_user;

COMMIT;
