# D12 — Engine results in narrow tables

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

`engine_run` (profile, as-of, input fingerprint) and `kpi_snapshot` (run, metric key, scope, period, value). Screens read these only.

## Why

A new figure needs no migration, and migrations are the serial lane. The triage with Bhavin may drop screens.

## Rejected

- One table per analytics screen.
