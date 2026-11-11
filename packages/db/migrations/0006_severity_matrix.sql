-- Migration 0006: add CHECK constraints, default matrix, and legacy severity backfill
-- Expand-only: missing values are populated; explicit severity/snapshots are preserved.

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

-- 3. Backfill pre-M2 tickets using the default matrix and the machine's current
-- criticality (the best available report-time snapshot for legacy rows).
UPDATE ticket AS t
SET
  severity = COALESCE(t.severity, CASE
    WHEN t.kind = 'general' THEN CASE WHEN t.urgent THEN 'S3' ELSE 'S4' END
    WHEN m.criticality = 'A' THEN CASE WHEN t.kind = 'stopped' THEN 'S1' ELSE 'S2' END
    WHEN m.criticality = 'B' THEN CASE WHEN t.kind = 'stopped' THEN 'S2' ELSE 'S3' END
    ELSE CASE WHEN t.kind = 'stopped' THEN 'S3' ELSE 'S4' END
  END),
  criticality_snapshot = COALESCE(t.criticality_snapshot, m.criticality)
FROM machine AS m
WHERE t.machine_id = m.id
  AND t.tenant_id = m.tenant_id
  AND (t.severity IS NULL OR t.criticality_snapshot IS NULL);

-- General requests and machine-less rows use the same fallback as computeSeverity.
UPDATE ticket
SET severity = CASE
  WHEN kind = 'general' THEN CASE WHEN urgent THEN 'S3' ELSE 'S4' END
  WHEN kind = 'stopped' THEN 'S3'
  ELSE 'S4'
END
WHERE severity IS NULL;

-- 4. Every ticket now has derived severity; snapshots remain nullable for
-- general requests and machines whose criticality is unknown.
ALTER TABLE ticket ALTER COLUMN severity SET NOT NULL;

-- 5. RLS policies already exist for 'setting' table (from 0001); no change needed.

COMMIT;