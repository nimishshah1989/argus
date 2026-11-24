# HANDOFF

> **24 Nov 19:50 — ADR 0036 (Nimish's 19:35 decisions: colour with meaning, effective-dated shifts, language per person, one period per page).** Groundwork on `plan/adr-0036-colour-shifts-language`: ADR, migration 0016 (`shift.valid_from`, `person.language`), v2 status tokens + contrast test, `ui/v2/status.ts` (`Status` type), `insight.status|period|tiles|language` words, GLOSSARY (Shift calendar, Status, Period). Session hit context budget before creating issues.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/adr-0036-colour-shifts-language

## State

- Plan PR for ADR 0036 groundwork open (see branch); merge when CI green. Migration 0016 passed `migrations:check`, `migrations:immutable` and `packages/db/test/migration-runner.test.ts` (23/23, real Postgres).
- No issues created yet for ADR 0036. The ticket plan (S1–S6, H1–H5, L1–L4, P1–P2) with files and blockers is in ADR 0036 "Tickets".
- Screens batch 2 (#654–#679) unchanged; still building.

## Next step

Plan (`loop plan`): after the groundwork PR merges, create the ADR 0036 issues and seed `plan/t<N>` for S1 S2 S3 S4 S5 H1 H2 L1 L4 P1 (critical tests only, ADR 0034; prove red). L2, L3 and H4 can be seeded with pure-function tests; S6, P2 wait for #642 and H5 waits for Nimish. Then add the ticket numbers to ADR 0036.

## Blocked / open questions

- Nimish: Cosmos's two shift windows for 16 h, and the date the 16 h started. Seed/answer key say 21 h (08:00–18:30, 18:29–05:00); dating 16 h back over 2026 moves every 2026 availability/MTBF away from the answer key.
- Nimish: who at Cosmos translates the blank Gujarati keys (until then every v2 page shows English to Gujarati pickers, by his rule).
- Bug, found: Shift KPIs "Failures" count all years while working hours are the year to date (`standardTotals` → `eventsAt`), so MTBF/availability mix spans on any plant with no `dataFrom` cut (P1 fixes).
- Still open from before: S22 "vs the 320 days before" yes (#679); #651 yes/no.

## Don't repeat

- Kit tickets must not list files held by open PRs #650 (tables) or #649 (verdict, figure-tile, shift-kpis).
- Batch tickets must not edit `insight-coverage.test.ts` or shared catalogues (ADR 0035).
- The main checkout is shared with other sessions: commit from a temp worktree.
