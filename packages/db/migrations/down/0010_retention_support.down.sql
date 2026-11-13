-- Revert of 0010_retention_support.sql (ticket 14). destructive-approved: drops only active_tenant_ids and puts the 0009 body back.
-- backup: none needed; no table is touched.
BEGIN;
DROP FUNCTION active_tenant_ids();
CREATE OR REPLACE FUNCTION audit_purge(p_older_than timestamptz, p_operator text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  IF btrim(coalesce(p_operator, '')) = '' THEN RAISE EXCEPTION 'audit_purge: an operator is required'; END IF;
  IF p_older_than IS NULL OR p_older_than > now() - interval '3 years' THEN
    RAISE EXCEPTION 'audit_purge: the cut-off must be at least 3 years ago';
  END IF;
  WITH gone AS (
    DELETE FROM audit_log WHERE at < p_older_than RETURNING tenant_id
  ), per_tenant AS (
    SELECT tenant_id, count(*) AS removed FROM gone GROUP BY tenant_id
  ), noted AS (
    INSERT INTO audit_log (tenant_id, action, entity, after)
    SELECT tenant_id, 'audit.purge', 'audit_log', jsonb_build_object(
      'older_than', p_older_than, 'deleted', removed, 'operator', p_operator)
    FROM per_tenant
  )
  SELECT coalesce(sum(removed), 0) INTO n FROM per_tenant;
  RETURN n;
END $$;
DO $$ BEGIN
  IF to_regclass('public.schema_migration') IS NOT NULL THEN
    DELETE FROM schema_migration WHERE filename = '0010_retention_support.sql';
  END IF;
END $$;
COMMIT;
