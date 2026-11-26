# 0064 — Live breakdowns count in A1; the reports' month charts read every year

Date: 26 Nov 2026 · Decided by: Nimish ("fix the not-done items too", 26 Nov), after the staging check that A1 November read 0.12% against the key's 0.22%.

## Context

- A1 (BD % and PM split) counted only reports whose ticket is `history` (`isHistory`, `rows.ts`). The rule came from the 11 Nov answer key (slice 38, R4): Bhavin's platform kept its CNC breakdowns, including the ones raised in his own app (the 60 `bd_live_` rows), in one log, and the fixture marks that whole log `history`. In our app a breakdown raised live (`raised_channel` floor, desk, whatsapp or qr) is a `live` ticket (`apps/server/src/modules/analytics/load.ts`), so every breakdown raised in the app since cutover was missing from A1.
- ADR 0063 gave the A1/A3 month trends every recorded year. The monthly report's twelve-month chart (`ch-rp-12m`) and the annual report's month chart (`ch-ry-month`) still read only from the data-from date, because the reports read the run date (`reads: 'asOf'`) and were not handed `history`.

## Decision

1. **A1 reads the breakdown log, `breakdownLog` (`packages/domain/src/analytics/rows.ts`):** every history row, plus every report on a live ticket, less a live report whose machine, date, shift and downtime equal a history row's (`reportKey`, the pair `failureEvents` already used). That one is the same breakdown loaded twice and counts once.
2. **The reports' month charts read every recorded year.** `runWith` also hands `history` to the `asOf` figures when the data-from date cuts the run. `ch-rp-12m` then starts at the first recorded month, and `ch-ry-month` runs from January of the first recorded year with `Mon YY` labels, so the kit draws both year over year (ADR 0063 item 4). Every table and headline stays on its own period. The PDF route calls the reports without `history` and is unchanged.
3. **Compare's weekly trend needs no change.** `GET /analytics/compare` loads the whole plant with no data-from cut, so its 12 weeks and last-year totals already read every year.

## Consequences

- Proof: `packages/domain/test/a1-live-tickets.test.ts` turns the key's 60 `bd_live_` rows into live tickets. November reads the key's 0.22% (0.00% under the old rule). The 30 Oct HMC-2 row, which the key counts twice, counts once. Every answer-key test passes unedited.
- Only A1 changed. A2, A3, A10, the dashboard counts and charts, registers, age, machine page, compare, the data checklist and `legacyTotals` still read history rows only (`isHistory`). Moving each to `breakdownLog` is the same one-line change, but each needs its own answer-key check: the dashboard's Total Breakdowns and NO-DT figures leave out the key's 7 live non-CNC rows (R4).
- Staging rows imported from Bhavin's live export (14 Nov, `raised_channel = 'import'`) are history to the engine. The dedupe does not merge them with log rows of the same breakdown: two of them (BD-0041 and BD-0042, 31 Oct) duplicate log rows BD-91286 and BD-91284. That is part of October's 0.43% against 0.42%. Fixing it is a data decision, not an engine one.

## Cost if wrong

Swap `breakdownLog` back to `sourcedReports(...).filter(isHistory)` in `a1-bd-pm.ts`. Drop the `asOf` branch's `history` in `engine.ts` to restore the 12-month and one-year charts.
