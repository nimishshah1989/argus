# ADR 0014 — Team Focus is a `mixed` figure

Date: 2026-11-23 · Status: accepted (Plan, under ADR 0012 §3; Nimish away)

## Decision

Team Focus's registry entry gets `mixed: true`, like the data checklist, `pm-compliance` and `dashboard.breakdown-free`.

## Why

Its lane-E "data|multi" action ("N machine and problem pairs are logged four or more times") is a fleet-wide data gap
and names no machine. On a plant where that is the only action, the figure has a value and no drill rows, the engine's
`drillOf` guard throws, and every `GET /analytics/figures` read returns 500 (issue #558, reproduced by
`packages/domain/test/analytics-team-focus-no-drill.test.ts` and PR #557's money-rights server test). Inventing a machine
for a fleet-wide action would be a false drill; `mixed` is the existing, documented way to say "this value can stand on
rows the drill can't name".

## Consequences

Ticket #558 (seed `plan/t558`, which also carries #557's G1.6 tests; #557 closed) is a one-line registry change.
