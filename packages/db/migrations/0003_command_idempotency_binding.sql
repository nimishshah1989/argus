-- Schema v1.2 — bind idempotency keys to the login and the exact request.
--
-- A reused client key must not silently replay a different command's result. We record the
-- acting login (`login_id`) and a hash of the normalised request (`request_hash`), and make the
-- key unique per (tenant, login) instead of globally per tenant. The lookup also ignores rows
-- older than 24 hours, so a key is only valid for one day.

ALTER TABLE command_idempotency
  ADD COLUMN login_id uuid,
  ADD COLUMN request_hash text;

-- Pre-existing rows are dev/test only; there is nothing to backfill into login_id/request_hash,
-- and the new lookup key (tenant_id, login_id, key) with a non-null login never matches them, so
-- they are left NULL and effectively expire.

-- The old key was global per tenant; a reused key for a different login is a NEW command, so the
-- uniqueness must include the login.
ALTER TABLE command_idempotency DROP CONSTRAINT command_idempotency_tenant_id_key_key;
ALTER TABLE command_idempotency
  ADD CONSTRAINT command_idempotency_tenant_login_key_key UNIQUE (tenant_id, login_id, key);
