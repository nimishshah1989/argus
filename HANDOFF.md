# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-25 · **By:** Plan · **Model:** Opus 5.5
**Milestone:** M2 (last old-design screens) · **Branch:** plan/v2-last-screens (stopped at context budget)

## State

- Job: plan S19 Login, S23 Monthly, S24 Annual, S25 Guide, S26 Settings onto the v2 kit (ADR 0036 rules).
- Done: v1 inventories of all five + wireframe reads; the ticket split and every assumption are in
  `docs/adr/0044-last-four-screens-split.md` (12 tickets: S19, S23, S24, S25, S26-0 kit … S26-8).
- NOT done: no GitHub issues, no seed branches, no coverage tables yet.

## Next

1. Next Plan session: from ADR 0044 alone, create the issues (Budget:/Screens: lines), seeds `plan/t<N>` with
   skeleton + visible + a few hidden tests (ADR 0034), coverage tables in `docs/design/v2/scope/<folder>.md`.
2. Build order: S26-0 kit first (CRUD pages need it); S19, S23, S25, S26-1 in parallel; then S24 (after S23) and
   S26-2…8 (after S26-0 and S26-1).

## Blocked

- Nothing blocked. Open questions for Nimish (wireframe "Questions" sections; not built until he answers):
  Settings attention badges beyond failed jobs; Reports PDF full rows; Guide groups.

## Don't repeat

- `design/approved.json` shows as modified in the working tree; not by Plan. Never commit it.
- Don't re-inventory v1: ADR 0044 has the file:line facts.
