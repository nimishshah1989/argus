-- Migration 0010: retention support. Ticket 14, ARCHITECTURE §9 item 33.
-- approved-by: orchestrator ruling (ticket 14 brief, 13 Nov): audit.purge must not delete offboard or erase proof rows yet.
-- backup: none needed. It replaces one function body and adds one function; no row is read, changed or deleted.
--   Apply after the snapshot that migration 0009 already requires on the first staging deploy.
--   Revert: packages/db/migrations/down/0010_retention_support.down.sql.

BEGIN;

-- audit_purge (0009) now leaves the two proof rows alone, however old: `person.erase` (the count-only record of an
-- erasure) and `tenant.offboard` (the proof that a customer's data was removed). Whether they may go after 3 years
-- is a product decision still pending; until it is made, only ordinary audit rows are removed. Same signature, so the
-- owner (app_router) and the grants (router only) stay as 0009 set them.
CREATE OR REPLACE FUNCTION audit_purge(p_older_than timestamptz, p_operator text) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE n bigint;
BEGIN
  IF btrim(coalesce(p_operator, '')) = '' THEN RAISE EXCEPTION 'audit_purge: an operator is required'; END IF;
  IF p_older_than IS NULL OR p_older_than > now() - interval '3 years' THEN
    RAISE EXCEPTION 'audit_purge: the cut-off must be at least 3 years ago';
  END IF;
  WITH gone AS (
    DELETE FROM audit_log
    WHERE at < p_older_than AND action NOT IN ('person.erase', 'tenant.offboard')
    RETURNING tenant_id
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

-- The nightly retention jobs run one customer at a time under that customer's row security. The application role
-- cannot read `tenant`, so this lists every customer that still holds data, active or suspended (id only), as tenants_with_sla_policies() does for SLA.
CREATE FUNCTION job_tenant_ids()
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.id FROM tenant t WHERE t.status <> 'offboarded';
$$;
ALTER FUNCTION job_tenant_ids() OWNER TO app_router;
REVOKE ALL ON FUNCTION job_tenant_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION job_tenant_ids() TO app_user;

COMMIT;
