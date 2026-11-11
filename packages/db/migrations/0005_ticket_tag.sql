-- Schema v2.1 — controlled, tenant-scoped ticket tag assignments.
-- Expand-only. The unmerged setting-table prototype never shipped, so there is no data to backfill.

ALTER TABLE list_item ADD CONSTRAINT list_item_tenant_id_unique UNIQUE (tenant_id, id);

CREATE TABLE ticket_tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES ticket(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES list_item(id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now(),
  applied_by_login_id uuid REFERENCES login(id) ON DELETE SET NULL,
  applied_by_person_id uuid REFERENCES person(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, ticket_id, item_id),
  CONSTRAINT ticket_tag_ticket_tenant_fk FOREIGN KEY (tenant_id, ticket_id)
    REFERENCES ticket (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ticket_tag_item_tenant_fk FOREIGN KEY (tenant_id, item_id)
    REFERENCES list_item (tenant_id, id) ON DELETE CASCADE,
  CONSTRAINT ticket_tag_login_tenant_fk FOREIGN KEY (tenant_id, applied_by_login_id)
    REFERENCES login (tenant_id, id),
  CONSTRAINT ticket_tag_actor_tenant_fk FOREIGN KEY (tenant_id, applied_by_person_id)
    REFERENCES person (tenant_id, id)
);

ALTER TABLE ticket_tag ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_tag FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ticket_tag
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON ticket_tag TO app_user;
