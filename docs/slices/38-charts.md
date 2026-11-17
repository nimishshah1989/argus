# M4a-38.5 — the Dashboard charts actually draw (hotfix)

Reported by Nimish on 17 Nov night, from the running app: on the analytics Dashboard an object-valued figure prints the
word **"Ready"** — e.g. "Bubble chart · Ready" — with no chart and nothing to click. That is not an honest placeholder:
the engine computes the chart data (ticket 38.2, #299) and the face never draws it. Ticket 38's goal 2 says "the dashboard
shows them"; this packet pays that debt. Screenshot archive: `Desktop/Archive.zip` (8 images, 17 Nov 22:15).

## Root cause (verified)

- `apps/web/src/screens/analytics/FigureTile.tsx:22` — `valueText` returns `t('analytics.value.ready')` = "Ready" for
  any object value; `FigureTile` then prints it as a text tile. The dashboard's object figures are
  `dashboard.bubble-chart` (`dashboard-charts.ts:23`, value `{ axes, datasets: [{ label:'Machines', data: points }] }`)
  and `dashboard.expansion-timeline` (`:67`, value `{ axes, labels, datasets }` = one bar series per machine-id prefix
  plus a "Cumulative Fleet Size" line).
- The chart kit already exists: `apps/web/src/ui/chart/{chart.tsx,use-chart.ts}` (ECharts 6.1, SVG renderer, an
  accessible table under every chart) but `ChartSpec` only supports **bar/line on one category axis**, and the loader
  registers only `BarChart` + `LineChart`. A bubble chart is a scatter; the timeline is multi-series bars + a second-axis
  line. That is why nobody could wire them.

## Packet 38.5a — the kit learns scatter and mixed (one PR, one writer)

Extend `ChartSpec` (and only it) so a chart can be:

1. `{ kind: 'scatter'; title; xLabel; yLabel; points: { x: number; y: number; r: number; label?: string }[]; table: { header: string[]; rows: string[][] } }`
   — draws a scatter, `symbolSize` from `r`, tooltip named by `label`; the accessible table is the engine's own table shape.
2. `{ kind: 'mixed'; title; categoryLabel; categories: string[]; bars: ChartSeries[]; line?: ChartSeries }`
   — stacked-capable bars (one per series) plus an optional line on a second value axis (`y1`), line end-labelled.

Keep bar/line behaviour unchanged. Register `charts.ScatterChart` in `use-chart.ts`'s loader. No new dependency (echarts
is already a dependency). Keep `chart.tsx`'s table-under-chart and `role="img"` + `aria-label`.

Tests: `ui/chart/chart-guard.test.ts` gains the two new kinds' option shape (scatter has `symbolSize`, mixed has two
`yAxis`) and keeps the "colour never the only signal" guard; the gallery section gains one scatter frame (baseline
updated deliberately). Red first: the new option-shape test fails before the builder.

## Packet 38.5b — the Dashboard shows its four object figures, and none says "Ready" (one PR, one writer)

The dashboard has **four** object-valued figures (verified in `dashboard-charts.ts` and `dashboard-flags.ts`); all four
currently print "Ready". The mapper is total for them:

1. New pure mapper `apps/web/src/screens/analytics/figure-content.ts`: `contentOf(figure, t, format)` returns
   `{ kind: 'chart'; spec } | { kind: 'table'; header: string[]; rows: string[][] } | { kind: 'text'; text: string } | null`:
   - `dashboard.bubble-chart` → chart/scatter; x = BD hours, y = breakdown count, r from the engine's radius, label =
     machine id (tooltip: model, age, MTTR); table = machine / BD hours / breakdowns / MTTR.
   - `dashboard.expansion-timeline` → chart/mixed; bars per machine-id prefix + the cumulative line on the second axis;
     table = year / per-prefix counts / cumulative.
   - `dashboard.breakdown-free` → text `"<runningClean> of <inService> machines"` (the engine's own two numbers; the
     key's card is "53 of 125").
   - `dashboard.costliest-problems` → table: Problem / BD hours / % of BD / Breakdowns, with the engine's `totalHours`
     as a caption; rows link to the tickets behind them (the figure already drills to them).
   - any other object value → `null`; the tile then says `analytics.value.chartPending` = "Chart not drawn yet",
     never "Ready".
2. `FigureTile` (or a small `FigureBlock` beside it) renders the mapped content for those keys — the chart, the
   ranked table or the two-number text — keeping the label, the **drill link** (all four figures drill) and
   `data-figure` so tests find the tile. Layout: a chart figure spans the grid (two/three columns) — the kit, no new
   CSS language.
3. i18n: add `analytics.value.chartPending` to `analytics.en.ts` (gu follows the namespace's existing blank convention).
4. Tests: a pure unit test for `contentOf` (bubble → scatter with 100+ points and the engine's radius, timeline →
   mixed with the cumulative line last, breakdown-free → its two numbers, costliest → its ranked table, an unknown object
   → null); the Playwright dashboard journey asserts the bubble chart renders
   (`data-testid="chart"`, `data-chart-state="ready"`) and that the string "Ready" never appears as a figure value, and
   that the bubble tile still offers its drill link. Red first: the journey's chart assertion fails on main today.

**Write scope:** `apps/web/src/ui/chart/*`, `apps/web/src/screens/analytics/{FigureTile.tsx,figure-content.ts,Dashboard.tsx,groups.ts}`,
`packages/shared/src/i18n/analytics.en.ts`, the chart gallery section/spec, the dashboard e2e, `changes/38-charts.md`.

## Rails

Red test first; never delete/skip/weaken a test; file ≤ 400 lines, function ≤ 60, screen file ≤ 300; no new dependency;
every string a catalogue key; tokens and kit only; no fabricated numbers. One writer per packet; commit locally, no push;
report red, green and deviations.

## Acceptance (what Nimish checks)

Open Analytics → Today: the **Bubble chart** draws one bubble per machine with a breakdown (size = MTTR), the
**Expansion timeline** draws its bars and the cumulative line, each has its numbers in a table underneath and its rows
behind a link; nothing on the face says "Ready" as a value.
