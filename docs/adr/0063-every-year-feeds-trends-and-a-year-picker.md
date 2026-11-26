# 0063 — Every year feeds the trends and forecasts; one year picker in the shell

Date: 26 Nov 2026 · Decided by: Nimish ("I was hoping we'll be using this data for improving our analytics, forecasts. Wherever there is historical data, the line graphs and scatter plots will become richer. We'll have a toggle to choose years of data and use all of that data to create trend lines or better represent stuff. I didn't realize we had to choose between one of the two. How do we make that happen in the most code efficient way?")

Supersedes ADR 0027 points 2 and 3 where they say the default read hides the older years from every figure. The data-from date itself stays.

## Context

Staging now holds 2022–2025 (4,220 reports) beside 2026, with `analytics.data-from` = 2026-01-01. Under ADR 0027 the default run cut everything before that date, so the forecast, Forecast Lab, compare, team focus, money matters, fix finder, the data checklist and every trend line lost the old years, and the web could not ask for a span at all (`GET /analytics/figures` took only `asOf`). The engine could already run over a named span (ticket 76) and already marked the figures that learn from every year (`reads: 'history'` in `registry.ts`).

## Decision

1. **Headlines keep the data-from date; history feeds the rest.** In `runWith` (`packages/domain/src/analytics/engine.ts`), when the data-from date cuts a default run:
   - figures with `reads: 'history'` (A9 bottleneck and forecast, Forecast Lab, compare and its spares cost, team focus and its cost, money matters, fix finder, data checklist, OEM analytics) read every recorded year, as they would with no data-from date;
   - every span figure is also handed `history`, the plant over every recorded year (cut exactly as a span over all of them is), and the two trend series built over calendar months (A1's `ch-a1-trend`, A3's `ch-a3-planttrend`) run over it. Their KPIs, tables and drill stay on the data-from period;
   - every other figure is unchanged, so Bhavin's 2026 answer key holds (`packages/domain/test/analytics-*.test.ts` and `history-parity.test.ts`, which now pins every non-history figure with those two trend charts set aside, and proves the history figures and trends read 2022 and 2024).
2. **A year span on the figures read.** `GET /api/v1/analytics/figures?years=2024`, `?years=2022-2026` or `?years=all` (`yearsChoice` in `packages/shared/src/analytics.ts`) runs the engine over 1 January of the first year to 31 December of the last, stopped at the run date (`all` starts at the first recorded year). Anything else, or a first year after the run date's, is a 422 on `years`. Each choice is kept as its own served run (`kpi_snapshot` key `figures-run:<years>`, same stamp, lock, warm job and prune as the default). The reply gains `period` (the span read, with its no-record months) and `years` (the calendar years with records, before the data-from cut). The drill route needs no change: it looks rows up by id over the whole plant, so the rows behind a figure are always the ones that figure counted, in whatever span.
3. **One year picker, in the shell header.** `LiveFrame` puts `YearPicker` (`ui/v2/period-toggle.tsx`: the default, each year with records newest first, "All years") under the screen tabs of every analytics screen with a figure. The choice lives in the address (`?years=`), so Back, links and reload keep it. Every figures read takes it from the address in one place (`analyticsFiguresQuery` in `apps/web/src/analytics-figures.ts`); `useScreenModel` and `useRefreshOnFigures` load again when it changes. No screen was edited. A screen whose figures all read the plant on the day (registers, footprint, energy, the reports) or every year on purpose (forecast, compare, …) says under the picker that the years picked do not change it.
4. **Year over year in the kit.** `lineOption` (`ui/chart/option-lines.ts`) redraws any line chart whose categories are the engine's `Mon YY` month labels and in which a month comes round again: one line per series and year on a shared Jan–Dec axis, a legend, the latest year thicker in its series colour and older years thinner (`ui/chart/year-over-year.ts`). Scatter and bubble plots needed no change: their points are the figure's own, so a span over older years brings the older points with it.

## Consequences

- The default page still opens on 2026 and its headline numbers match the key; the forecast and the two trend lines are richer on the same page with no choice made.
- A card that mixes headline numbers with an all-year trend now shows two spans on one page (the trend's months say which); the dashboard's day-based cards (machine counts) do not say per card that the years do not move them, only screens whose every figure is like that do.
- Each year choice costs one engine run per plant and date, kept like the default one; the prune still keeps the newest eight runs per plant, now across choices.

## Cost if wrong

Remove `history` from `runWith` and the `history` figures' read of the uncut data to restore ADR 0027's default read; the `?years=` read and the picker are independent of it.
