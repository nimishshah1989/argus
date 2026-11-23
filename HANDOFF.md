# HANDOFF

> **Read ADR 0012 first.** Nimish is away; the loop runs unattended. Everything moves to v2, v1 is deleted, the 97 MISSING coverage items get built. Plan decides §6 (ADR each) except answer-key changes, production, money, irreversible data steps.

_Overwritten at the end of every session. Keep under 30 lines. Facts only._

**Updated:** 2026-11-23 · **By:** Plan · **Model:** claude-opus-5-5
**Milestone:** M1 Stabilise (building) · **Branch:** plan/escalation-clock-free · **PR:** #556

## State

- Merged: #561 (= #551, G1.1 case clash; browser 3/5 was a `who-is-acting` flake, rerun green), #562 handoff.
- #556 (G1.5, this PR): main merged in; was red only for "HANDOFF.md not updated" (this file fixes it). Merge when green.
- Ticket PRs open, reviewer not run yet: **#563** (#552 G1.3), **#564** (#558 G1.6), **#565** (#553 G1.2b). Each got a
  Prettier fix on its handoff note + "No parity:" line; #563 got `Screens: S03-machines-register` (the cell change log
  lives at `/analytics/machines`, S03; no own wireframe). CI re-running. Green → `reviewer` → merge → `loop clean`.
- Not built: #554 Dashboard, #555 Problem Analysis (build folders are stale: `loop clean`, sync `plan/t<N>` with main, re-prep).

## Next step

1. #556 merge. 2. #563/#564/#565: CI → reviewer → merge; tick G1.3, G1.6 in PROJECT.md (ADR-free: ticks only).
2. #554/#555 per the old recipe (dated "Coverage re-checked for ticket #N" line in `docs/design/v2/scope/<screen>.md`,
   Argus body + `## Coverage` table). 4. Shift KPIs + Energy: both are already v2; only `numbers` is missing on
   `ChartCard` (`screens/v2/shift-kpis/View.tsx:43`, `energy/View.tsx:28`). `scope/energy.md:16` says "moved" — the M1
   goal overrides it. Still needs gallery view + fixture → wireframe → Nimish approval before the frontend ticket.
3. Proof fix: add `pnpm format:check` to `.loop.json` `lint_command` (check `loop finish` runs it via a shell first).

## Blocked / open questions

- **G1.2a needs Nimish:** duplicate ticket column is pinned by the frozen answer key (`workbook-export.json`, 30 cols).
- **G1.4 Shift KPIs + Energy:** wireframes need Nimish's `loop approve` (none exist yet).
- Nimish (old): branch protection; answer-key last digit; support tickets 0 downtime.

## Don't repeat

- An old build folder can't take main (guard blocks orchestrator and builder): `loop clean <N>`, sync `plan/t<N>`, `loop prep`.
- Builders: stop hook nags for HANDOFF.md in build folders — ignore it; "checks not run" under Blocked fails `loop finish`.
- `cd` into the main checkout + git write in one Bash call → guard says "you're on main"; use separate calls.
- PR bodies need "No parity: <reason>" or pr-meta fails; builder handoff notes need Prettier.
