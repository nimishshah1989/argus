# 0035 — Screens batch 2: one insight ticket per screen, on disjoint files

Date: 2026-11-24 · Decided by: Plan (Nimish's ask: batch 2 builds in parallel with batch 1; critical tests only, ADR 0034)

## Decisions

1. **One ticket per remaining v2 screen** on the insight-coverage not-yet list (all but #640–#643's screens), plus S22 Money Matters (#644) split into tickets under budget. Each ticket touches only its own screen folder, its changelog line and its handoff, so any number build at once without merge conflicts.
2. **No ticket edits `insight-coverage.test.ts`.** Batch 1 seeds edit its `NOT_YET`/`SECTIONS`/`MODELS` lines; twenty more tickets doing the same would conflict on every merge. Instead each seed carries its own `<screen>/insight.test.ts` with the same two checks (every section has a takeaway, every tile has a yardstick, via `tilesIn`/`hasYardstick`) plus the figure checks. A finished screen staying on `NOT_YET` is harmless; Plan moves the finished screens into `SECTIONS` in one sweep after the batch merges.
3. **No ticket edits a shared i18n catalogue.** Takeaways come from the kit rules (`takeawayFor` and friends, words in `insight.*`). Tile yardsticks use five new kit keys added here: `insight.yardstick.rank|share|average|target|prior`. Gujarati stays blank (falls back to English, D7) like the other `insight.*` keys. A section no rule fits says `insight.none` or reuses a key its screen already has.
4. **Independent of #620.** Takeaways are computed in the screen's adapter (as #641 does), not from a table's `meaning`; the View draws the kit's `Takeaway` above the section. `KpiData.yardstick`, `FigureData.yardstick` and `Takeaway` are on main (#619).
5. **Tests (ADR 0034):** per screen one render-smoke (main's existing screen test already renders it; a seed adds one only where none exists) and data-correctness tests that assert figures (`toContain('51%')`), never wording, tone, CSS or markup. Every test is passable by editing the ticket's own files; `model.ts` gets `takeaways?: Takeaways` on the seed.

Per-ticket decisions (sections, rule, measured figures) are written in each issue; the ticket list is in HANDOFF.md.

## Addendum — tickets seeded (24 Nov)

Tickets (all M2b, seed `plan/t<N>`, independent of #620 and of each other): #654 Action Center, #655 Machines register, #656 Footprint, #657 Age, #658 BD % and PM, #660 Energy, #661 Bottleneck, #662 Forecast Lab, #663 Cell change log, #664 OEM, #665 Category and cell, #666 Entity drawer, #667 MTTR and MTBF, #668 Rows behind, #669 Manpower, #670 Why-Why, #671 Problem Analysis, #672 Fix Finder, #673 PM Calendar, #674 Compare, #675 Data Checklist, #676 Team Focus. S22 (#644) split: #677 (Plan PR, merged: model, register, skeletons, `analytics-v2-money` catalogue, scope doc, `money-matters` on `NOT_YET`), then #644 adapter, #678 View (parallel), #679 go-live and v1 `MoneyPage` deleted (after both). Every seed merges cleanly with main; no two tickets list the same file.

Judgement calls made while seeding (Plan, unattended; each is stated in its issue):

1. **Charts on printed-page screens get no takeaway** (bd-pm, bottleneck, mttr-mtbf, category-cell, forecast-lab, manpower): the shared `printed-page/PageBody.tsx` has no slot above a chart and each chart plots a table that already has its line. A later shared ticket adds the slot; it was kept out of this batch so no two tickets touch one file.
2. **Screens sharing `PrintedPageModel`** get a folder-local `model.ts` that extends it with `takeaways?`; the shared type is untouched.
3. **Tiles with no honest yardstick:** Fix Finder's "Similar cases", "On this machine" (—) and "Last seen" (a date) have nothing to measure against; its test checks only "Typical downtime" and that "—" never gains a figure. Machines register's Process load "—", Robots kW and Robots breakdowns 0, and BD % and PM's machine count print "—" as yardstick (`shortcut:` until a base exists). The NOT_YET sweep must decide: exempt "—"/date tiles in `hasYardstick`, or add a word.
4. **Bottleneck tiles use the engine's sub line as yardstick** (ADR 0031 §4, ticket 642 precedent); the line prints twice until 642's `figure-tile.tsx` guard is on main.
5. **`money-matters` was added to `NOT_YET`** by #677: a brand-new screen, not a regression; the coverage test requires every screen be listed.
6. **S22's "+8% vs the 320 days before" yardstick is unbuilt** (no engine figure). #679 may not merge without Nimish's written yes in its coverage table.
