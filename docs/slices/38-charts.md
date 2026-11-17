# M4a-38.5 — the Dashboard shows its object figures (hotfix)

Reported by Nimish on 17 Nov night from the running app: an object-valued figure prints the word **"Ready"** — e.g.
"Bubble chart · Ready" — with no chart, nothing to click. Not an honest placeholder: the engine computes those values
(ticket 38.2, #299) and the face never shows them. Ticket 38 goal 2 says "the dashboard shows them". This pays that debt.
Plan review (glm-5.3-flash, fresh) returned FAIL on ten plan gaps; all ten are settled below.

## Root cause (verified by the plan reviewer)

`FigureTile.tsx:22` returns `t('analytics.value.ready')` ("Ready") for any object value. That tile is shared by
`Dashboard.tsx:63`, `GroupPage.tsx:35` and `DataChecklist.tsx:41`, so the same lie appears on Today, any group screen
with an object figure and the Data checklist. The chart kit (`ui/chart`) draws bar/line only; the loader registers only
`BarChart` + `LineChart`, and its palette has two series colours and no legend component.

## The five object figures (inventory — every one must show data, never "Ready")

| key | engine value (`dashboard-charts.ts`, `dashboard-flags.ts`, `data-checklist.ts`) | rendered as |
| --- | --- | --- |
| `dashboard.breakdown-free` | `{ runningClean, inService }` | text: "<n> of <m> machines" (the key's card: 53 of 125) |
| `dashboard.costliest-problems` | `{ rows: [{ problem, hours, share, breakdowns }], totalHours }` | ranked table: Problem / BD hours / % of BD / Breakdowns, caption with total hours |
| `dashboard.bubble-chart` | `{ axes, datasets: [{ label:'Machines', data: [{ x, y, r, id, model, age, mttr }] }] }` | scatter chart + derived table |
| `dashboard.expansion-timeline` | `{ axes, labels, datasets: [prefix bars …, 'Cumulative Fleet Size'] }` | mixed chart (bars + line) + derived table |
| `data-checklist` | `{ counts: {group: n}, items: [{ group, key, plain }] }` | grouped list with counts (one row per open item) |

Any **other** object value → the tile says `analytics.value.onlyData` = "Only numbers so far" (not "Ready", not
"Chart not drawn yet"): it tells the truth without naming a cause we have not built.

## Packet 38.5a — the kit learns scatter and mixed (one PR, one writer)

`ChartSpec` (`ui/chart/use-chart.ts`) gains exactly two members; bar/line are untouched:

1. `{ kind: 'scatter'; title: string; xLabel: string; yLabel: string; points: { x: number; y: number; r: number; label: string }[] }`
   — `symbolSize` from `r`, tooltip named by `label`, axes titled by `xLabel`/`yLabel` (all three strings are catalogue
   keys supplied by the caller, never engine text). The details table is **derived inside `chart.tsx` from `points`**
   (label / x / y / r) — one table mechanism for every kind, no caller-supplied table.
2. `{ kind: 'mixed'; title: string; categoryLabel: string; categories: string[]; bars: ChartSeries[]; line?: ChartSeries }`
   — **decided**: every bar series uses the single primary chart colour (the prefixes are machine-id letters, not
   semantic categories) and the optional line uses the accent colour with its end label; no legend component is
   registered; the details table underneath (already in the kit) carries the per-series reading. `ChartSeries.name` is a
   catalogue-key string.

Loader: register `charts.ScatterChart` beside Bar/Line (still dynamic `import()` only — the guard stays).
Palette: the option builder takes the colours it needs from the existing CSS tokens (`--color-chart-1/2`); no new token.

Tests: **`chartOption` is exported** from `use-chart.ts` as a pure function (it already is pure) and a new
`ui/chart/use-chart.test.ts` (node env) asserts the option shape for all four kinds: bar/line unchanged, scatter has a
`scatter` series with `symbolSize` per point and both axis titles, mixed has two `yAxis` and a bar series per `bars` plus
the line on the second axis. `chart-guard.test.ts` keeps its existing job (echarts only through `import()` in the door;
gallery bundle split) — the plan does not claim it tests colours or options. Gallery: one scatter frame added and one
mixed frame added, baselines updated deliberately.

## Packet 38.5b — FigureTile renders the five object figures (one PR, one writer)

1. New pure mapper `figure-content.ts`: `contentOf(figure, t, formatNumber)` returns
   `{ kind: 'chart'; spec: ChartSpec } | { kind: 'table'; header: string[]; rows: string[][] } | { kind: 'text'; text: string } | { kind: 'list'; groups: { label: string; rows: string[] }[] } | null`.
   The five keys map as in the table above; the chart spec's titles/axis/series names come from catalogue keys, and
   **only engine data** (numbers, machine ids, prefixes, dates) is printed untranslated.
2. **FigureTile alone** renders the content (no second component): `kind: 'chart'` → `<Chart spec/>`; `table`/`list` → the
   kit's table grammar; `text` → the value line; `null` → `analytics.value.onlyData`. A chart/list/table figure spans
   the grid (the Dashboard's `<li>` gets `sm:col-span-2 lg:col-span-3` when the content is not text); the label, the
   drill link ("See the rows") and `data-figure` stay on every tile. `FigureTile.tsx` stays under the 300-line screen
   budget (today 60 lines).
3. i18n (`analytics.en.ts`, the gu namespace keeps its existing `blank(analyticsEn)` convention): **delete**
   `analytics.value.ready` (unreachable after this change; leaving it is a trap) and add the chart texts, the
   `analytics.value.onlyData` fallback, "See the rows" usage stays, the breakdown-free/timeline/bubble/costliest titles,
   axis labels, series names and table headers, and the checklist group labels.
4. Tests, including the deliberate inversions named by the plan reviewer:
   - pure unit test for `contentOf`: all five keys produce their content kinds with real values (bubble points count and
     radius from the engine, timeline's cumulative series last, checklist groups), and an unknown object → null.
   - `apps/web/e2e/analytics.spec.ts`: **invert** `:55-65` (the `valueText` helper's "null → Ready" rule — delete the
     helper's Ready branch), `:168-181` (the loop that asserts `toContainText('Ready')` for object values) and
     `:199-206` (the data-checklist tile asserting 'Ready'). New assertions: the bubble tile contains
     `[data-testid="chart"][data-chart-state="ready"]`; the timeline tile too; the breakdown-free tile contains
     "of" and two numbers; the costliest tile shows its top problem text; the checklist tile shows its open-item count;
     and **no figure tile contains the string "Ready"**. These fail on main today.
5. `docs/spec/parity.yaml`: update `m4a.dashboard`'s evidence with the new e2e test name (a real ledger update, so the
   parity guard passes on merit rather than a label).

**Write scope:** `apps/web/src/ui/chart/{use-chart.ts,chart.tsx,use-chart.test.ts}`,
`apps/web/src/screens/analytics/{FigureTile.tsx,figure-content.ts,figure-content.test.ts,Dashboard.tsx,DataChecklist.tsx}`,
`packages/shared/src/i18n/analytics.en.ts`, `apps/web/src/gallery/dashboard-section.tsx` (+ its spec/baselines),
`apps/web/e2e/analytics.spec.ts`, `docs/spec/parity.yaml`, `changes/38-charts.md`.

## Rails

Red test first; never delete/skip/weaken a test (the three e2e inversions are a deliberate, named replacement, not a
removal); file ≤ 400 lines, function ≤ 60, screen file ≤ 300; no new dependency; every visible string a catalogue key;
tokens and kit only; no fabricated numbers. One writer per packet; commit locally, no push; report red, green, deviations.

## Acceptance (what Nimish checks)

Open Analytics → Today: the **Bubble chart** draws one bubble per machine with a breakdown (size = MTTR), the
**Expansion timeline** draws its bars and the cumulative line, **Breakdown-free** reads "53 of 125", **Costliest problems**
lists its top three, the **Data checklist** lists its open items — each with its numbers in a table or list, each with
its rows links, and nowhere does a figure say "Ready".
