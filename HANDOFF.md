# HANDOFF

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-26 ~23:15 IST · **By:** session `c39914a2…` (515k context, handing over) · **Mode (ADR 0057):** organic session, parallel agents · **Branch:** plan/handoff-s33 · **Staging:** 78d2eb52 + #871 (docs)

## State (merged and on staging)

- Nothing old remains (guard `tools/old-ui-left.test.ts`); kit catalogue `docs/design/v2/KIT.md`. Every card goes somewhere (ADR 0060). Tables colour themselves + "On this page" (ADR 0061). Multi-year + year picker (ADR 0063). Real names (ADR 0059). TV board fits any screen, "+N more" (Nimish's choice over "and N more").
- `v2/table-polish` (PR open, not merged): duration columns read as time ("40 min", "2 h 26 min") on Breakdown log, Why-Why, Fix Finder; Breakdowns vs PM month grids coloured (BD % loss, PM % plan). Guard coverage for the 14 skipped screens postponed.
- 2026 log loaded on staging (snapshot `uptimo-pre-history-20261126155839`, batch `9aa60229…`); 2022–2025 was already there. Do NOT run `history-load.yml -f legacy=true` until its source is checked.
- **Live breakdowns in A1, report charts over every year (ADR 0064, #874):** A1 counts live tickets (key's November holds); monthly/annual report month charts read 2022–2026. Other figures still history-only.

## In flight (Nimish: "fix the not-done items too") — four agents started by c39914a2, no commits yet at handover

- `plan/analytics-live-and-years`: A1 ignores live tickets (real bug; explains Nov 0.12 vs key 0.22, check Oct); monthly/annual charts and Compare weekly trend read all years; trace the old 2022–2025 load (ADR 0064).
- `v2/table-polish`: durations as "40 min", colour bd-pm month grids, table-look guard covers the 14 skipped screens.
- `v2/free-text-names`: names instead of `[P1]` in free text (AI/engine stay redacted); ADR 0059 addendum goes on a plan/ branch.
- `v2/split-big-files`: `pnpm size`/`shortcuts` (floor/View.tsx, live.tsx, ticket/adapter.ts).
- Their worktrees: `.claude/worktrees/agent-*`. Each opens one PR.

## Next steps

1. Merge those four PRs. Rule (Nimish, "Yes, merge those", 26 Nov): merge when every check is green, or the only red is loop-guard with only "existing test modified on a build branch". Verify staging health.
2. Floor segment tiles (ADR 0055 point 1), after the file split merges (same screen).
3. Click through staging: Nimish must sign in (browser pane) first.

## Don't repeat

- "What's left" comes from the guards, never from memory or tickets.
- Protected files (kit, ADRs, docs/design) only on plan/ branches. A PR's `Screens:` line holds approval ids (`S30-board`) or `none`; loop-guard reads the body from the push event.
- Reserve ADR numbers before parallel agents write (0058 collided; next free after 0064).
