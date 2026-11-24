# 0028 — M2b kit tickets, a time-boxed kit carve-out, and the screens lane order

Date: 2026-11-24 · Decided by: Plan (under ADR 0026 §3–4, Nimish away per ADR 0012)

## Decisions

1. **Tickets 613, 614, 615 are superseded** by ADR 0026 §4 (rules in the kit, not hand-built per screen). 613's build (not merged) is mined: its `dashboard/test-model.ts` (seed `plan/t613`) and its "needs you now" count line are reused by the Dashboard declaration ticket. The coordinator closes the three and runs `loop clean 613|614|615`.
2. **Two kit tickets:** 619 (four takeaway rules `target`, `change`, `concentration`, `outlier` picked by `takeawayFor` from a declared `Meaning`; a `yardstick` on `KpiData`/`FigureData`; `tilesIn`/`hasYardstick` so the insight-coverage test fails a tile without one) and 620 (tables: a column declares `meaning`; the kit ranks worst first, marks the worst row, draws in-cell bars, folds the tail, offers an expand row and draws the takeaway).
3. **Rule order in `takeawayFor`:** target, then change, then concentration (only for `additive` measures where high is worse: an average cannot "make up half the total"), then outlier. An equal value meets a target.
4. **Kit carve-out, time-boxed — PROPOSED, needs Nimish's yes (not applied).** `apps/web/src/ui/**` is protected, so a builder could not do 619/620. `.loop.json` now protects the same tree with globs that leave exactly eight files open to builders: `ui/v2/{table-model.ts,data-table.tsx,paged-table.tsx,table-parts.tsx,kpi-card.tsx,figure-tile.tsx,domain/engine-table.tsx,domain/printed-table.tsx}` (and new `ui/v2/table-*` files). Checked by script: every other file under `apps/web/src/ui` stays protected. **When 620 merges, Plan restores `apps/web/src/ui/**`.** CSS and tokens stay protected; Plan adds kit CSS on seeds.
5. **Screens lane order:** 619 → 620 → S20–S26 screen tickets (on the insight-aware kit; two shifts A/B only, ADR 0026 §1) → per-screen M2b declaration tickets (size:small where only declarations).

## Why

A carve-out of eight named files keeps every other kit file under CI guard while letting a builder, not Plan, write product code. Picking a rule from declared meaning makes every screen ticket a declaration, as Nimish asked.

## Addendum — 24 Nov 14:33 IST

Nimish said yes to the kit carve-out (§4). `.loop.json` now lists every `apps/web/src/ui` file except the eight named ones, plus all `ui` CSS; new non-CSS kit files (for example `ui/v2/table-*`, a yardstick part) are open to builders. **When #620 merges, restore the single glob `apps/web/src/ui/**` and drop `_kit_carve_out`.**
