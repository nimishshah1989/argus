-- Schema v1 — tenancy, people, machines, configuration, tickets, files and imports.
-- Every tenant table has tenant_id and forced row-level security. tenant is the only
-- table without RLS; it is read through app_router.tenant_by_slug before login.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_router') THEN
    CREATE ROLE app_router NOLOGIN BYPASSRLS;
  ELSE
    ALTER ROLE app_router BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user, app_router;

CREATE TABLE tenant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  logo_file_id uuid,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'gu', 'hi')),
  time_zone text NOT NULL DEFAULT 'Asia/Kolkata',
  plan text NOT NULL DEFAULT 'pilot',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE person (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text,
  phone text,
  team text NOT NULL DEFAULT 'maintenance' CHECK (team IN ('maintenance', 'production', 'vendor')),
  title text,
  default_shift text,
  active boolean NOT NULL DEFAULT true,
  kind text NOT NULL DEFAULT 'staff' CHECK (kind IN ('staff', 'production', 'vendor')),
  cell text,
  pending boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX person_phone_unique ON person (tenant_id, phone) WHERE phone IS NOT NULL;

CREATE TABLE login (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  username text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('operator', 'technician', 'supervisor', 'head', 'plant_head', 'admin', 'board')),
  shared boolean NOT NULL DEFAULT false,
  cell text,
  must_change_password boolean NOT NULL DEFAULT false,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, username)
);

CREATE TABLE session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  login_id uuid NOT NULL REFERENCES login(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  device_label text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  acting_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_login_idx ON session (tenant_id, login_id);

CREATE TABLE platform_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  platform_user text NOT NULL,
  granted_by text NOT NULL,
  expires_at timestamptz,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE segment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  show_on_board boolean NOT NULL DEFAULT true,
  group_by text NOT NULL DEFAULT 'letters' CHECK (group_by IN ('letters', 'category')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE machine_group (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  segment_id uuid NOT NULL REFERENCES segment(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  sort integer NOT NULL DEFAULT 0,
  hidden boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, segment_id, code)
);

CREATE TABLE machine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  code text NOT NULL,
  segment_id uuid REFERENCES segment(id) ON DELETE SET NULL,
  group_id uuid REFERENCES machine_group(id) ON DELETE SET NULL,
  category text,
  cell text,
  area text,
  location text,
  criticality text CHECK (criticality IN ('A', 'B', 'C')),
  make text,
  model text,
  serial text,
  controller text,
  controller_model text,
  controller_serial text,
  year integer,
  purchased_on date,
  power_kw numeric(10, 2),
  capacity_kva numeric(10, 2),
  asset_code text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'idle', 'scrapped')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
CREATE INDEX machine_segment_idx ON machine (tenant_id, segment_id);
CREATE INDEX machine_cell_idx ON machine (tenant_id, cell);

CREATE TABLE machine_move (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES machine(id) ON DELETE CASCADE,
  from_cell text,
  to_cell text,
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE list_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  list text NOT NULL,
  code text NOT NULL,
  label text NOT NULL,
  label_gu text,
  label_hi text,
  sort integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  is_vendor boolean NOT NULL DEFAULT false,
  pauses_sla boolean NOT NULL DEFAULT false,
  tag text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, list, code)
);

CREATE TABLE shift (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  crosses_midnight boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

CREATE TABLE setting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

CREATE TABLE glossary_term (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  source text NOT NULL,
  english text NOT NULL,
  direction text NOT NULL DEFAULT 'gu' CHECK (direction IN ('gu', 'gu-Latn', 'en')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source)
);

CREATE TABLE ticket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  ref text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('stopped', 'support', 'general')),
  status text NOT NULL CHECK (status IN ('open', 'working', 'waiting', 'closed', 'cancelled')),
  machine_id uuid REFERENCES machine(id) ON DELETE SET NULL,
  machine_snapshot jsonb NOT NULL DEFAULT '{}',
  location text,
  work_type text,
  urgent boolean NOT NULL DEFAULT false,
  problem text NOT NULL,
  problem_lang text,
  reported_at timestamptz NOT NULL,
  reported_by_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  reported_by_role text,
  raised_login_id uuid REFERENCES login(id) ON DELETE SET NULL,
  raised_channel text NOT NULL DEFAULT 'floor' CHECK (raised_channel IN ('floor', 'desk', 'whatsapp', 'qr', 'import', 'backfill')),
  self_started boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  lead_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  segment_started_at timestamptz,
  handed_over boolean NOT NULL DEFAULT false,
  handover_since timestamptz,
  transfer_to_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  transfer_to_shift text,
  transfers integer NOT NULL DEFAULT 0,
  wait_reason text,
  wait_since timestamptz,
  paused_by_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  assigned_to_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  expected_back_at timestamptz,
  waiting_spare text,
  machine_running_at timestamptz,
  machine_stopped_at timestamptz,
  closed_at timestamptz,
  closed_by_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  close_kind text CHECK (close_kind IN ('report', 'no_report', 'done')),
  close_note text,
  parent_id uuid REFERENCES ticket(id) ON DELETE SET NULL,
  task_reason text,
  task_expected_on date,
  task_down_min integer CHECK (task_down_min BETWEEN 0 AND 1440),
  severity text,
  criticality_snapshot text,
  sla_policy_id uuid,
  handback_status text,
  response_min integer,
  active_min integer,
  wait_min integer,
  vendor_min integer,
  handover_wait_min integer,
  down_acc_min integer,
  downtime_min integer,
  follow_min integer,
  repair_min integer,
  overrides jsonb NOT NULL DEFAULT '{}',
  kind_upgraded_at timestamptz,
  last_event_seq integer NOT NULL DEFAULT 0,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ref)
);
CREATE INDEX ticket_open_idx ON ticket (tenant_id, status, updated_at);
CREATE INDEX ticket_machine_idx ON ticket (tenant_id, machine_id, reported_at);
CREATE INDEX ticket_parent_idx ON ticket (tenant_id, parent_id);

CREATE TABLE ticket_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  seq integer NOT NULL,
  type text NOT NULL,
  idempotency_key text,
  at timestamptz NOT NULL DEFAULT now(),
  login_id uuid REFERENCES login(id) ON DELETE SET NULL,
  acting_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  text text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, seq),
  UNIQUE (ticket_id, idempotency_key)
);
CREATE INDEX ticket_event_ticket_idx ON ticket_event (tenant_id, ticket_id, seq);

CREATE TABLE crew_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('primary', 'support')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  left_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE work_segment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES person(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('lead', 'primary', 'support')),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  end_reason text CHECK (end_reason IN ('pause', 'transfer', 'leave', 'close', 'cancel')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX work_segment_ticket_idx ON work_segment (tenant_id, ticket_id, started_at);

CREATE TABLE breakdown_report (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES ticket(id) ON DELETE SET NULL,
  machine_id uuid NOT NULL REFERENCES machine(id) ON DELETE RESTRICT,
  date date NOT NULL,
  shift_code text NOT NULL,
  problem text NOT NULL,
  observed_by text,
  corrective_action text,
  done_by uuid[] NOT NULL DEFAULT '{}',
  supported_by uuid[] NOT NULL DEFAULT '{}',
  downtime_min integer NOT NULL DEFAULT 0,
  response_min integer,
  repair_min integer,
  breakdown_category text,
  maint_code text,
  spare_used text,
  root_cause text,
  handover_name text,
  signature_file_id uuid,
  pdf_file_id uuid,
  qr_payload jsonb NOT NULL DEFAULT '{}',
  submitted_by_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE file (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('pdf', 'photo', 'voice', 'signature', 'import', 'logo')),
  s3_key text NOT NULL,
  mime text NOT NULL,
  bytes bigint NOT NULL,
  sha256 text NOT NULL,
  ticket_id uuid REFERENCES ticket(id) ON DELETE SET NULL,
  uploaded_by uuid REFERENCES person(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, s3_key)
);

CREATE TABLE push_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  login_id uuid NOT NULL REFERENCES login(id) ON DELETE CASCADE,
  acting_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  endpoint text NOT NULL UNIQUE,
  keys jsonb NOT NULL DEFAULT '{}',
  role text,
  last_ok_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  login_id uuid REFERENCES login(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz NOT NULL DEFAULT now(),
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_tenant_idx ON audit_log (tenant_id, at);

CREATE TABLE import_batch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'done', 'failed', 'undone')),
  started_at timestamptz,
  finished_at timestamptz,
  stats jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_row (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES import_batch(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  source_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'skipped', 'error')),
  error text,
  payload jsonb NOT NULL DEFAULT '{}',
  ticket_id uuid REFERENCES ticket(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_number)
);

CREATE TABLE ref_counter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  prefix text NOT NULL,
  next_value integer NOT NULL DEFAULT 1 CHECK (next_value > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, prefix)
);

CREATE TABLE command_idempotency (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  key text NOT NULL,
  command text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

-- Composite keys make a cross-tenant reference impossible: a child row's tenant_id
-- must match its parent's tenant_id, not only the parent id.
ALTER TABLE person ADD CONSTRAINT person_tenant_id_unique UNIQUE (tenant_id, id);
ALTER TABLE login ADD CONSTRAINT login_tenant_id_unique UNIQUE (tenant_id, id);
ALTER TABLE segment ADD CONSTRAINT segment_tenant_id_unique UNIQUE (tenant_id, id);
ALTER TABLE machine_group ADD CONSTRAINT machine_group_tenant_id_unique UNIQUE (tenant_id, id);
ALTER TABLE machine ADD CONSTRAINT machine_tenant_id_unique UNIQUE (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_tenant_id_unique UNIQUE (tenant_id, id);
ALTER TABLE import_batch ADD CONSTRAINT import_batch_tenant_id_unique UNIQUE (tenant_id, id);

ALTER TABLE login ADD CONSTRAINT login_person_tenant_fk FOREIGN KEY (tenant_id, person_id) REFERENCES person (tenant_id, id);
ALTER TABLE session ADD CONSTRAINT session_login_tenant_fk FOREIGN KEY (tenant_id, login_id) REFERENCES login (tenant_id, id);
ALTER TABLE session ADD CONSTRAINT session_acting_person_tenant_fk FOREIGN KEY (tenant_id, acting_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE machine_group ADD CONSTRAINT machine_group_segment_tenant_fk FOREIGN KEY (tenant_id, segment_id) REFERENCES segment (tenant_id, id);
ALTER TABLE machine ADD CONSTRAINT machine_segment_tenant_fk FOREIGN KEY (tenant_id, segment_id) REFERENCES segment (tenant_id, id);
ALTER TABLE machine ADD CONSTRAINT machine_group_tenant_fk FOREIGN KEY (tenant_id, group_id) REFERENCES machine_group (tenant_id, id);
ALTER TABLE machine_move ADD CONSTRAINT machine_move_machine_tenant_fk FOREIGN KEY (tenant_id, machine_id) REFERENCES machine (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_machine_tenant_fk FOREIGN KEY (tenant_id, machine_id) REFERENCES machine (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_reporter_tenant_fk FOREIGN KEY (tenant_id, reported_by_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_raised_login_tenant_fk FOREIGN KEY (tenant_id, raised_login_id) REFERENCES login (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_lead_tenant_fk FOREIGN KEY (tenant_id, lead_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_paused_tenant_fk FOREIGN KEY (tenant_id, paused_by_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_assigned_tenant_fk FOREIGN KEY (tenant_id, assigned_to_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_closed_tenant_fk FOREIGN KEY (tenant_id, closed_by_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_transfer_tenant_fk FOREIGN KEY (tenant_id, transfer_to_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE ticket ADD CONSTRAINT ticket_parent_tenant_fk FOREIGN KEY (tenant_id, parent_id) REFERENCES ticket (tenant_id, id);
ALTER TABLE ticket_event ADD CONSTRAINT ticket_event_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id) REFERENCES ticket (tenant_id, id);
ALTER TABLE ticket_event ADD CONSTRAINT ticket_event_login_tenant_fk FOREIGN KEY (tenant_id, login_id) REFERENCES login (tenant_id, id);
ALTER TABLE ticket_event ADD CONSTRAINT ticket_event_actor_tenant_fk FOREIGN KEY (tenant_id, acting_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE crew_member ADD CONSTRAINT crew_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id) REFERENCES ticket (tenant_id, id);
ALTER TABLE crew_member ADD CONSTRAINT crew_person_tenant_fk FOREIGN KEY (tenant_id, person_id) REFERENCES person (tenant_id, id);
ALTER TABLE work_segment ADD CONSTRAINT work_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id) REFERENCES ticket (tenant_id, id);
ALTER TABLE work_segment ADD CONSTRAINT work_person_tenant_fk FOREIGN KEY (tenant_id, person_id) REFERENCES person (tenant_id, id);
ALTER TABLE breakdown_report ADD CONSTRAINT report_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id) REFERENCES ticket (tenant_id, id);
ALTER TABLE breakdown_report ADD CONSTRAINT report_machine_tenant_fk FOREIGN KEY (tenant_id, machine_id) REFERENCES machine (tenant_id, id);
ALTER TABLE breakdown_report ADD CONSTRAINT report_submitter_tenant_fk FOREIGN KEY (tenant_id, submitted_by_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE file ADD CONSTRAINT file_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id) REFERENCES ticket (tenant_id, id);
ALTER TABLE file ADD CONSTRAINT file_uploader_tenant_fk FOREIGN KEY (tenant_id, uploaded_by) REFERENCES person (tenant_id, id);
ALTER TABLE push_subscription ADD CONSTRAINT push_login_tenant_fk FOREIGN KEY (tenant_id, login_id) REFERENCES login (tenant_id, id);
ALTER TABLE push_subscription ADD CONSTRAINT push_actor_tenant_fk FOREIGN KEY (tenant_id, acting_person_id) REFERENCES person (tenant_id, id);
ALTER TABLE audit_log ADD CONSTRAINT audit_login_tenant_fk FOREIGN KEY (tenant_id, login_id) REFERENCES login (tenant_id, id);
ALTER TABLE import_row ADD CONSTRAINT import_row_batch_tenant_fk FOREIGN KEY (tenant_id, batch_id) REFERENCES import_batch (tenant_id, id);
ALTER TABLE import_row ADD CONSTRAINT import_row_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id) REFERENCES ticket (tenant_id, id);

-- Forced RLS on every tenant table. tenant is resolved only through app_router.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'person', 'login', 'session', 'platform_access', 'segment', 'machine_group',
    'machine', 'machine_move', 'list_item', 'shift', 'setting', 'glossary_term',
    'ticket', 'ticket_event', 'crew_member', 'work_segment', 'breakdown_report',
    'file', 'push_subscription', 'audit_log', 'import_batch', 'import_row',
    'ref_counter', 'command_idempotency'
  ])
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)',
      t
    );
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
REVOKE ALL ON tenant FROM app_user;
GRANT SELECT ON tenant, person, login, session TO app_router;

CREATE FUNCTION tenant_by_slug(p_slug text)
RETURNS TABLE (id uuid, slug text, name text, language text, time_zone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT t.id, t.slug, t.name, t.language, t.time_zone
  FROM tenant t
  WHERE t.slug = p_slug AND t.status = 'active';
$$;

CREATE FUNCTION auth_lookup(p_token_hash text)
RETURNS TABLE (
  tenant_id uuid, login_id uuid, person_id uuid, role text,
  shared boolean, acting_person_id uuid, expires_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT s.tenant_id, s.login_id, l.person_id, l.role, l.shared, s.acting_person_id, s.expires_at
  FROM session s
  JOIN login l ON l.id = s.login_id
  WHERE s.token_hash = p_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > now()
    AND l.disabled_at IS NULL;
$$;

ALTER FUNCTION tenant_by_slug(text) OWNER TO app_router;
ALTER FUNCTION auth_lookup(text) OWNER TO app_router;
REVOKE ALL ON FUNCTION tenant_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_lookup(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION tenant_by_slug(text) TO app_user;
GRANT EXECUTE ON FUNCTION auth_lookup(text) TO app_user;
