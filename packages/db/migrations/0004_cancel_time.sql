-- Schema v1.3 — exact cancelled timestamp.
--
-- Cancelling a ticket records when it happened, so the desk's "Cancelled last 24h" window no
-- longer needs an approximation (previously it fell back to the last event time). Expand-only:
-- one nullable column; existing rows stay NULL and the web UI falls back for them.

ALTER TABLE ticket ADD COLUMN cancelled_at timestamptz;
