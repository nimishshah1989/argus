-- Revert of 0012_m2_schema.sql (ticket 29). destructive-approved: drops the three M2 tables and six columns this migration added, removes the pause and handback timers (projections that the ticket history can rebuild), and puts the two narrower CHECK constraints back.
-- backup: snapshot first (RDS: aws rds create-db-snapshot; elsewhere pg_dump -Fc). Dropping `roster_entry`, `escalation_rule` and `notification` deletes the duty roster, the ladder and every recorded message; dropping `breakdown_report.handover_person_id` loses the person a report was handed to (the typed `handover_name` of imported history stays).
BEGIN;
DROP TABLE notification;
DROP TABLE escalation_rule;
DROP TABLE roster_entry;

-- Only `ack` and `restore` timers fit the old constraints; the other two kinds are derived from events.
DELETE FROM sla_timer WHERE kind IN ('pause', 'handback');
ALTER TABLE sla_timer DROP CONSTRAINT sla_timer_stop_reason_kind;
ALTER TABLE sla_timer ADD CONSTRAINT sla_timer_stop_reason_kind CHECK (
  (kind = 'ack' AND (stop_reason IS NULL OR stop_reason IN ('acknowledged', 'started', 'closed', 'cancelled')))
  OR
  (kind = 'restore' AND (stop_reason IS NULL OR stop_reason IN ('machine_running', 'closed', 'cancelled')))
);
ALTER TABLE sla_timer DROP CONSTRAINT sla_timer_kind_check;
ALTER TABLE sla_timer ADD CONSTRAINT sla_timer_kind_check CHECK (kind IN ('ack', 'restore'));

ALTER TABLE breakdown_report DROP CONSTRAINT report_handover_tenant_fk;
ALTER TABLE breakdown_report DROP COLUMN handover_person_id;
ALTER TABLE list_item DROP COLUMN needs_lockout;
ALTER TABLE glossary_term DROP COLUMN active;
ALTER TABLE shift DROP COLUMN active;
ALTER TABLE segment DROP COLUMN active;
ALTER TABLE ticket_event DROP CONSTRAINT ticket_event_tenant_id_unique;
ALTER TABLE shift DROP CONSTRAINT shift_tenant_id_unique;
COMMIT;
