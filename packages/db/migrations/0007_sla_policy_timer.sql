-- Migration 0007: per-tenant SLA policies, durable timer projections, and job discovery.
-- BACKUP PREREQUISITE: take a full database/RDS snapshot before applying this migration.
-- Legacy pause events are enriched additively with their historical SLA flag. No event `at`,
-- severity, ticket figure, or existing pause flag is changed. Unresolved reasons abort everything.

BEGIN;

CREATE TABLE sla_policy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('S1', 'S2', 'S3', 'S4')),
  ack_minutes integer NOT NULL CHECK (ack_minutes > 0),
  restore_minutes integer NOT NULL CHECK (restore_minutes > 0),
  pause_max_minutes integer CHECK (pause_max_minutes IS NULL OR pause_max_minutes > 0),
  handback_minutes integer CHECK (handback_minutes IS NULL OR handback_minutes > 0),
  business_hours_only boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, severity),
  UNIQUE (tenant_id, id)
);

CREATE TABLE sla_timer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ack', 'restore')),
  due_at timestamptz,
  paused_at timestamptz,
  fired_at timestamptz,
  stopped_at timestamptz,
  stop_reason text,
  state text NOT NULL CHECK (state IN ('running', 'paused', 'stopped')),
  job_id uuid,
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ticket_id, kind),
  UNIQUE (tenant_id, id),
  CONSTRAINT sla_timer_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES ticket (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT sla_timer_due_required CHECK (state = 'paused' OR due_at IS NOT NULL),
  CONSTRAINT sla_timer_paused_shape CHECK ((state = 'paused') = (paused_at IS NOT NULL)),
  CONSTRAINT sla_timer_stopped_at_shape CHECK ((state = 'stopped') = (stopped_at IS NOT NULL)),
  CONSTRAINT sla_timer_stop_reason_shape CHECK ((state = 'stopped') = (stop_reason IS NOT NULL)),
  CONSTRAINT sla_timer_stop_reason_kind CHECK (
    (kind = 'ack' AND (stop_reason IS NULL OR stop_reason IN ('acknowledged', 'started', 'closed', 'cancelled')))
    OR
    (kind = 'restore' AND (stop_reason IS NULL OR stop_reason IN ('machine_running', 'closed', 'cancelled')))
  )
);
CREATE INDEX sla_timer_due_idx ON sla_timer (tenant_id, due_at)
  WHERE state <> 'stopped' AND fired_at IS NULL;
CREATE INDEX ticket_sla_policy_idx ON ticket (tenant_id, sla_policy_id)
  WHERE sla_policy_id IS NOT NULL;

ALTER TABLE ticket
  ADD CONSTRAINT ticket_sla_policy_tenant_fk FOREIGN KEY (tenant_id, sla_policy_id)
  REFERENCES sla_policy (tenant_id, id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE ticket VALIDATE CONSTRAINT ticket_sla_policy_tenant_fk;

ALTER TABLE sla_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_policy FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sla_policy
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
ALTER TABLE sla_timer ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_timer FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sla_timer
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON sla_policy, sla_timer TO app_user;
GRANT SELECT ON sla_policy TO app_router;

-- Resolve before changing anything. Inactive reasons still resolve historical pauses.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ticket_event e
    LEFT JOIN list_item li
      ON li.tenant_id = e.tenant_id AND li.list = 'wait_reason'
      AND li.code = e.payload->>'reason'
    WHERE e.type = 'pause' AND (
      (NOT (e.payload ? 'pausesSla') AND li.id IS NULL)
      OR ((e.payload ? 'pausesSla') AND jsonb_typeof(e.payload->'pausesSla') <> 'boolean')
    )
  ) THEN
    RAISE EXCEPTION 'Cannot migrate SLA timers: unresolved legacy pause reason';
  END IF;

  UPDATE ticket_event e
  SET payload = e.payload || jsonb_build_object('pausesSla', li.pauses_sla)
  FROM list_item li
  WHERE li.tenant_id = e.tenant_id AND li.list = 'wait_reason'
    AND li.code = e.payload->>'reason'
    AND e.type = 'pause' AND NOT (e.payload ? 'pausesSla');

  IF EXISTS (
    SELECT 1 FROM ticket_event e
    WHERE e.type = 'pause' AND (
      NOT (e.payload ? 'pausesSla') OR jsonb_typeof(e.payload->'pausesSla') <> 'boolean'
    )
  ) THEN
    RAISE EXCEPTION 'Cannot migrate SLA timers: unresolved legacy pause reason';
  END IF;
END $$;

CREATE FUNCTION tenants_with_sla_policies()
RETURNS TABLE (tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT DISTINCT p.tenant_id FROM sla_policy p;
$$;
ALTER FUNCTION tenants_with_sla_policies() OWNER TO app_router;
REVOKE ALL ON FUNCTION tenants_with_sla_policies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenants_with_sla_policies() TO app_user;

COMMIT;
