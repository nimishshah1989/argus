# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Everything moves to v2, v1 is deleted, the 97 MISSING coverage items get built. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M1 Stabilise (building) · **Branch:** plan/handoff-551-in-ci · **PR:** #562

## State

- Unattended building works: `loop prep` → `loop build <N>` (builder as its own session) → `loop finish`. #560 merged
  (Mac-only check fixes). The builder ends "BLOCKED: stop hook wants HANDOFF.md": ignore it, its ticket handoff is committed.
- **#561 = ticket #551** (G1.1 case clash): built twice by Haiku, local checks pass, CI running on the second build.
  Seed now carries the coverage re-check lines; issue Budget files<=8, Screens S01-dashboard, S11-why-why; PR body set.
- Not built yet: #552 G1.3 (`plan/t552`), #553 G1.2b (`plan/t553`), #554 G1.4 Dashboard, #555 G1.4 Problem Analysis.
- #556 (plan PR, G1.5 escalation test): pr-meta red; needs merge of main (HANDOFF conflict), fragment renamed
  `changes/556-*.md`, full Argus body (Q1–Q16, "Reasons"). #557 (G1.6 money-rights tests) red on purpose until #558.
- #558 (bug): figures route 500s when Team Focus has a value but no drill; needs a ticket (make team-focus `mixed`).
- Open (Plan may decide): Compare's non-money figure has two "Spares cost" rows always `₹ 0` (`compare.ts` L98–99).

## Next step

1. `gh pr checks 561`; green → reviewer subagent → merge → `loop clean 551`. Red → read failing lines only.
2. Before building any ticket that changes a v2 screen `.tsx` (#554, #555): on `plan/t<N>` add a dated "Coverage
   re-checked for ticket #N" line to `docs/design/v2/scope/<screen>.md`; set the issue's `Screens:` and a budget that
   counts renames twice plus the changes note. Then `loop prep`/`build`/`finish`; then `gh pr edit` with the Argus
   body including `## Coverage` (table with a `v2` column), keeping the `Plan-base:` line `loop finish` wrote.
3. Then #552, #553, #556, a ticket for #558.

## Blocked / open questions

- **G1.2a needs Nimish:** the duplicate ticket column is in the Excel Breakdown Log sheet
  (`packages/domain/src/exports/plant-sheets.ts` ~L105, `Ticket ID` + `Ticket No.`), which the frozen answer key
  `fixtures/answer-key/workbook-export.json` requires (30 columns). The v2 screen export already has one column.
- G1.4 for Shift KPIs and Energy: no wireframe yet; Plan writes them, Nimish approves.
- Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Don't repeat

- Hidden tests go in a `holdout/` folder under `tools/`, `apps/web/src/` or `apps/server/test/`; `tests/holdout/` never runs.
- Bash with `>` redirects or a long inline `gh pr create --body` is denied; use Write + `--body-file`.
- Re-snapshotting wireframes changes the hash and voids approval.
