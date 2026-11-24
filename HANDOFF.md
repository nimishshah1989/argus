# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-24 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2b screens lane · **Branch:** plan/adr-0036-colour-shifts-language

## State

- ADR 0036 is the one v2 kit rulebook (R1–R25), per Nimish 24 Nov 19:54/19:56. Migration 0016 dropped (no effective-dated shifts, no per-person language). Groundwork in this PR: v2 status + segment tokens (contrast-tested), `Status` type, kit words in `insight.en.ts`.
- Kit tickets #684–#701 created (full specs in each issue). Seeds pushed and proven red: `plan/t684`, `plan/t685`, `plan/t686`. #687–#701 NOT seeded yet (context budget).
- Parallel now: #684 #685 #686 #687 #690 #691 #692 #693 #694 #697 #698 #699 #700 #701. After #687: #688 #689. After #694: #695 #696.

## Next step

Plan (next job, first): seed #687–#701 from their issue bodies (critical tests only, prove red, `git add` named files only — the seed worktree's node_modules symlinks must never be committed). Coordinator: build #684 #685 #686 now. Plan (then): ADR 0036 "Remaining" 1–4 — verdict chip (after #642), drawers at 3 figures (after #666), Shift KPIs one span (engine bug), per-screen adoption sweep after each batch-2 ticket.

## Blocked / open questions

- Bug, found: Shift KPIs "Failures" count all years while working hours are the year to date (`standardTotals` → `eventsAt`), so MTBF/availability mix spans on any plant with no `dataFrom` cut. Ticket comes in the next Plan job (Remaining 3).
- Still open from before: S22 "vs the 320 days before" yes (#679); #651 yes/no.

## Don't repeat

- Kit tickets must not list files held by open #642 (figure-tile, verdict, insight.ts) or #666 (cell drawer).
- Batch tickets must not edit `insight-coverage.test.ts` or shared catalogues (ADR 0035).
- The main checkout is shared with other sessions: commit from a temp worktree.
