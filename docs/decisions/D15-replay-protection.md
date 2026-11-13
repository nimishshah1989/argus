# D15 — Replay protection is stored by the module that owns the write

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

The kernel parses the `Idempotency-Key` header and owns no table. `command_idempotency` belongs to `tickets`; acknowledge and handback use it because they end in `tickets.applyCommand`. Any other replayable write stores a unique key on its own table (`notification.dedupe_key`, `pm_execution.idempotency_key`). `idempotency.purge` deletes keys older than the outbox window.

## Why

The kernel owns no tables, and a shared table would be written by every module.

## Rejected

- A kernel-owned idempotency table.
