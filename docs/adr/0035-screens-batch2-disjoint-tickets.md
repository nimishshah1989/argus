# 0035 — Screens batch 2: one insight ticket per screen, on disjoint files

Date: 2026-11-24 · Decided by: Plan (Nimish's ask: batch 2 builds in parallel with batch 1; critical tests only, ADR 0034)

## Decisions

1. **One ticket per remaining v2 screen** on the insight-coverage not-yet list (all but #640–#643's screens), plus S22 Money Matters (#644) split into tickets under budget. Each ticket touches only its own screen folder, its changelog line and its handoff, so any number build at once without merge conflicts.
2. **No ticket edits `insight-coverage.test.ts`.** Batch 1 seeds edit its `NOT_YET`/`SECTIONS`/`MODELS` lines; twenty more tickets doing the same would conflict on every merge. Instead each seed carries its own `<screen>/insight.test.ts` with the same two checks (every section has a takeaway, every tile has a yardstick, via `tilesIn`/`hasYardstick`) plus the figure checks. A finished screen staying on `NOT_YET` is harmless; Plan moves the finished screens into `SECTIONS` in one sweep after the batch merges.
3. **No ticket edits a shared i18n catalogue.** Takeaways come from the kit rules (`takeawayFor` and friends, words in `insight.*`). Tile yardsticks use five new kit keys added here: `insight.yardstick.rank|share|average|target|prior`. Gujarati stays blank (falls back to English, D7) like the other `insight.*` keys. A section no rule fits says `insight.none` or reuses a key its screen already has.
4. **Independent of #620.** Takeaways are computed in the screen's adapter (as #641 does), not from a table's `meaning`; the View draws the kit's `Takeaway` above the section. `KpiData.yardstick`, `FigureData.yardstick` and `Takeaway` are on main (#619).
5. **Tests (ADR 0034):** per screen one render-smoke (main's existing screen test already renders it; a seed adds one only where none exists) and data-correctness tests that assert figures (`toContain('51%')`), never wording, tone, CSS or markup. Every test is passable by editing the ticket's own files; `model.ts` gets `takeaways?: Takeaways` on the seed.

Per-ticket decisions (sections, rule, measured figures) are written in each issue; the ticket list is in HANDOFF.md.
