-- Migration 0008: ai_suggestion, one stored AI answer per subject, feature and prompt version.
-- Ticket 55 (slice 55a), ADR 0007 D16/D22. Expand-only: creates one table, no existing row or
-- column is touched. Revert: packages/db/migrations/down/0008_ai_suggestion.down.sql.

BEGIN;

CREATE TABLE ai_suggestion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  feature text NOT NULL CHECK (length(feature) BETWEEN 1 AND 40),
  subject_type text NOT NULL CHECK (length(subject_type) BETWEEN 1 AND 40),
  subject_id text NOT NULL CHECK (length(subject_id) BETWEEN 1 AND 100),
  ticket_id uuid,
  prompt_version text NOT NULL CHECK (length(prompt_version) BETWEEN 1 AND 40),
  model_ref text NOT NULL,
  mode text NOT NULL DEFAULT 'shadow' CHECK (mode IN ('shadow', 'live')),
  status text NOT NULL CHECK (status IN ('running', 'retry_wait', 'ready', 'failed')),
  outcome text CHECK (outcome IN ('ok', 'redaction_failed', 'provider_error', 'rate_limited',
    'overloaded', 'provider_rejected', 'schema_invalid')),
  output jsonb,
  evidence_ticket_ids uuid[] NOT NULL DEFAULT '{}',
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 4),
  input_tokens integer NOT NULL DEFAULT 0 CHECK (input_tokens >= 0),
  output_tokens integer NOT NULL DEFAULT 0 CHECK (output_tokens >= 0),
  cost_micro_usd bigint NOT NULL DEFAULT 0 CHECK (cost_micro_usd >= 0),
  decision text CHECK (decision IN ('accepted', 'changed', 'rejected')),
  decided_by_person_id uuid,
  decided_by_login_id uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_suggestion_key
    UNIQUE (tenant_id, subject_type, subject_id, feature, prompt_version),
  CONSTRAINT ai_suggestion_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES ticket (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ai_suggestion_decider_tenant_fk FOREIGN KEY (tenant_id, decided_by_person_id)
    REFERENCES person (tenant_id, id) ON DELETE SET NULL (decided_by_person_id),
  CONSTRAINT ai_suggestion_decider_login_tenant_fk FOREIGN KEY (tenant_id, decided_by_login_id)
    REFERENCES login (tenant_id, id) ON DELETE SET NULL (decided_by_login_id),
  CONSTRAINT ai_suggestion_ticket_subject CHECK ((subject_type = 'ticket') = (ticket_id IS NOT NULL)),
  CONSTRAINT ai_suggestion_ticket_subject_id CHECK (ticket_id IS NULL OR subject_id = ticket_id::text),
  CONSTRAINT ai_suggestion_ready_shape CHECK ((status = 'ready') = (output IS NOT NULL)),
  CONSTRAINT ai_suggestion_ready_ok CHECK (status <> 'ready' OR outcome = 'ok'),
  CONSTRAINT ai_suggestion_decision_shape CHECK ((decision IS NULL) = (decided_at IS NULL)),
  CONSTRAINT ai_suggestion_decision_ready CHECK (decision IS NULL OR status = 'ready')
);
CREATE INDEX ai_suggestion_month_idx ON ai_suggestion (tenant_id, created_at);

ALTER TABLE ai_suggestion ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestion FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ai_suggestion
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE ON ai_suggestion TO app_user;

COMMIT;
