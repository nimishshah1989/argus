# ADR 0020 — Compare goes live: a chosen pair from the server, the year so far, v1's six tables, money for heads

Date: 2026-11-24 · Status: accepted (Plan, under ADR 0012 §3; Nimish away)

## Context

The v2 Compare screen (S15, wireframe approved 23 Nov) runs on invented fixture data. Going live needs five things the
code does not have: (1) the reader picks the two machines, but the engine's `compareFigure`
(`packages/domain/src/analytics/compare.ts`) picks its own pair (the worst two of the biggest CNC category); (2) the
wireframe's boxes, key figures, "What is different" and weekly chart read "this year so far", a basis the engine's
Compare page does not compute; (3) `docs/design/v2/scope/batch1.md` lists 20 Compare rows as MISSING (health score,
scorecard, category average, eleven checkup rows, specifications, the longest-breakdown and by-shift tables, column
sort, money for heads only); ADR 0013 already decided they are built, not waived; (4) the money rule; (5) the
wireframe's "Add the fix to Team Focus" button, which nothing on the server can store.

## Decision

1. **A chosen pair is a server input.** New pure domain function `comparePair(input, pair?)` in `compare.ts`; the
   engine's `compareFigure` becomes `comparePair(input)` with no pair, so its value stays byte-for-byte the frozen answer
   key (`fixtures/answer-key/compare.json`). A new read `GET /api/v1/analytics/compare?a=<code>&b=<code>&asOf=` answers
   the pair's page; no `a`/`b` means the engine's own pair. Both machines must be compare machines (`compareMachines`)
   of one category and differ, else 422 naming the field (`a` when `a` is unknown, `b` otherwise). The picker offers
   the machines of machine A's category, in the engine's order (worst age-adjusted health first). The category
   average column is A's category. Same auth as `/analytics/figures` (`canAnalytics`).
2. **"This year so far" is computed in the domain, from the rows v1's Compare reads** (`historyRows`, PM excluded):
   `pairYear` gives each machine its breakdowns and hours from 1 January of `asOf`'s year to `asOf`, planned hours
   (days × the profile's production hours a day spread over the year, as `compareFigure` does), hours by maintenance
   code, breakdown hours in each of the 12 seven-day weeks ending `asOf`, and the same window one year earlier. The
   v2 boxes, key figures, "What is different" (by maintenance code, replacing v1's code chart) and the weekly chart read
   only this. The checkup table keeps v1's whole-period basis; the two bases are labelled ("This year so far" against
   the checkup's own hints), so neither changes a figure.
3. **v1's six tables are printed whole, under the wireframe's sections**: scorecard, health checkup (score, all
   seventeen rows, category average, ✓), specifications, longest breakdowns of each machine, by shift — through the
   shared printed-page `tablesOf` and the kit's `PrintedDataTable` (sort, search). This clears 18 of the 20 MISSING rows
   without new figures. The gallery fixture carries no tables, so the approved gallery markup does not move.
4. **Money: both rows stay; only heads and admin see either.** v2's "Money lost" (breakdown hours × the profile's
   `mmThroughput`) and v1's "Spares cost" rows are different figures; dropping either would shrink scope, so both stay.
   The compare reply sends `rate: null` and removes the checkup's two "Spares cost" rows for anyone without `canMoney`;
   the adapter then shows no money figure and no money key figure. The engine's spares cost is a placeholder `₹ 0`
   (frozen in the answer key); whether it should read `breakdown_report.spare_cost` is Nimish's call (open question),
   so it is printed as the engine gives it.
5. **The "Add the fix to Team Focus" button opens Team Focus** (`/analytics/today?screen=team-focus`) and reads "Open
   Team Focus": Team Focus actions are the engine's, and no store accepts an added one (ADR 0018 stores notes against
   engine actions only). A button that claimed to add something it did not would be worse than an honest link. A real
   "add" is new scope for Nimish to ask for.
6. **Go-live ships in one PR with the v1 page's deletion** (`MachinesPage.tsx`, Compare is its last screen), blocked
   by #580 (Team Focus go-live), which edits `live.tsx`, `live.test.ts` and `Analytics.tsx`.

## Tickets

#584 CMP-1 domain · #585 CMP-2 server (after #584) · #586 CMP-3 tables in the view (independent) · #587 CMP-4 live
adapter (after #585, #586) · #588 CMP-5 go-live and v1 deletion (after #587 and #580).

## Not decided here (Nimish's)

- Spares cost: keep the engine's `₹ 0` placeholder, or read `breakdown_report.spare_cost` (moves the frozen answer key).
- Whether Compare should be able to add a new action to Team Focus (new scope, needs a store).
