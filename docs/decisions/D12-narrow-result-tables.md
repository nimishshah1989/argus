# D12 — Engine results in narrow tables

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

`engine_run` (profile, as-of, input fingerprint) and `kpi_snapshot` (run, metric key, scope, period, value). KPI, trend and scorecard screens read these only. Registers and drill-down lists (breakdown rows, machines, PM tasks) read their own module's tables through its interface.

## Why

A new figure needs no migration, and migrations are the serial lane. The triage with Bhavin may drop screens.

## Rejected

- One table per analytics screen.
