-- Migration 0006: add CHECK constraints for severity columns and default matrix
-- This is an expand-only migration; no existing data is altered.

BEGIN;

-- 1. Add CHECK constraints to enforce valid severity/criticality values
ALTER TABLE ticket
  ADD CONSTRAINT ticket_severity_check CHECK (severity IS NULL OR severity IN ('S1', 'S2', 'S3', 'S4')),
  ADD CONSTRAINT ticket_criticality_snapshot_check CHECK (criticality_snapshot IS NULL OR criticality_snapshot IN ('A', 'B', 'C'));

-- 2. Insert default severity matrix setting (key 'severity_matrix')
-- Default values match docs/spec/DOMAIN.md §Severity
INSERT INTO setting (tenant_id, key, value)
SELECT id, 'severity_matrix', jsonb_build_object(
  'default', jsonb_build_object(
    'A', jsonb_build_object('stopped', 'S1', 'support', 'S2'),
    'B', jsonb_build_object('stopped', 'S2', 'support', 'S3'),
    'C', jsonb_build_object('stopped', 'S3', 'support', 'S4')
  ),
  'workRequest', 'S4',
  'urgentWorkRequest', 'S3'
)
FROM tenant
WHERE NOT EXISTS (
  SELECT 1 FROM setting WHERE setting.tenant_id = tenant.id AND key = 'severity_matrix'
);

-- 3. RLS policies already exist for 'setting' table (from 0001); no change needed.

COMMIT;