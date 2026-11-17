# M4a-38.5 — the Dashboard shows its object figures (hotfix)

Reported by Nimish on 17 Nov night from the running app: an object-valued figure prints the word **"Ready"** — e.g.
"Bubble chart · Ready" — with no chart, nothing to click. Not an honest placeholder: the engine computes those values
(ticket 38.2, #299) and the face never shows them. Ticket 38 goal 2 says "the dashboard shows them". This pays that debt.
Two plan reviews (glm-5.3-flash, fresh) checked the diagnosis, the inventory and every decision; this revision fixes their
two dispatch defects and folds in their wording points.

## Root cause (verified)

`FigureTile.tsx:22` returns `t('analytics.value.ready')` ("Ready") for any object value; the same tile is used by
`Dashboard.tsx:63`, `GroupPage.tsx:35` and `DataChecklist.tsx:41`. The chart kit draws bar/line only (`use-chart.ts`
registers `BarChart` + `LineChart`), palette has two series colours, no legend component.

## The five object figures (every one shows data, never "Ready")

| key                            | engine value                                                                                                          | rendered as                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `dashboard.breakdown-free`     | `{ runningClean, inService }` (`dashboard-flags.ts:39`)                                                               | text: "<n> of <m> machines"                                             |
| `dashboard.costliest-problems` | `{ rows: [{ problem, hours, share, breakdowns }], totalHours }` (:88)                                                 | table: Problem / BD hours / % of BD / Breakdowns, caption = total hours |
| `dashboard.bubble-chart`       | `{ axes, datasets: [{ label:'Machines', data: [{ x, y, r, id, model, age, mttr }] }] }` (`dashboard-charts.ts:41-58`) | scatter chart + derived table                                           |
| `dashboard.expansion-timeline` | `{ axes, labels, datasets: [prefix bars …, 'Cumulative Fleet Size'] }` (:75-91)                                       | mixed chart (stacked bars + line) + derived table                       |
| `data-checklist`               | `{ counts: {group: n}, items: [{ group, key, plain }] }` (`data-checklist.ts:227`)                                    | grouped list with counts                                                |

Ready figures whose value is **null** (empty data) keep today's "—" (they have no content to lay out). Any other
non-null object we cannot render says `analytics.value.onlyData` = "Only numbers so far" (not "Ready").

**Engine-authored text is data, not catalogue copy.** The "every visible string a catalogue key" rail covers _chrome_
(titles, axis labels, series names, table headers) — all of which the mapper supplies from `analytics.en.ts`. The engine's
own prose prints as data: the checklist's item sentences ("date missing or invalid", "3 days with no entries"), the
costliest problem names, machine ids, prefixes and dates. Those are values from the reply, never English literals in code.

## Microtask queue (the split; each packet ≤3 files, ≤150 changed lines, one acceptance assertion)

Gallery frames for scatter/mixed are **out of scope** (the gallery is design QA, not this bug; a scatter/mixed gallery
frame is a frontend-overhaul follow-up — the kit is proven by the node test in A1). `more-data.ts` is therefore not in
any write list.

- **A1 — the kit** (3 files: `ui/chart/use-chart.ts`, `ui/chart/chart.tsx`, new `ui/chart/use-chart.test.ts`). Acceptance: the exported pure
  `chartOption(spec, palette)` builds the four kinds correctly — bar/line unchanged; scatter: one `scatter` series with
  per-point `symbolSize` and both axis titles; mixed: two `yAxis`, one **stacked** bar series per `bars` entry (same
  colour, so a year reads as one total; no legend) and the optional line on the second axis. `ScatterChart` registered
  beside Bar/Line (dynamic `import()` only). `chartOption` stays one exported name and delegates to per-kind builders
  (`barOption`, `lineOption`, `scatterOption`, `mixedOption`), each ≤60 lines. Export the `Palette` type. Red first: the
  new test's scatter/mixed cases fail before the branches exist.
- **B1 — mapper + copy** (3 files: new `screens/analytics/figure-content.ts`, `packages/shared/src/i18n/analytics.en.ts`,
  new `figure-content.test.ts`). Acceptance: `contentOf(figure, t)` returns
  `{ kind:'chart', spec } | { kind:'table', header, rows } | { kind:'text', text } | { kind:'list', groups } | null` for the
  five keys, null for a ready-but-null value and for an unknown non-null object; i18n gains every chrome string and
  deletes `analytics.value.ready`; the test pins all five mappings (bubble point count and mttr, timeline's cumulative
  last, checklist groups, null-value and unknown cases).
- **B2 — render** (3 files: `FigureTile.tsx`, `Dashboard.tsx`, `DataChecklist.tsx`). Acceptance: the tile renders the
  mapped content (chart / table / text / list), keeps its label, its "See the rows" link and `data-figure`, and a
  non-text figure spans the grid. The **parent picks the span by calling the same exported pure `contentKind(figure)`**
  (also used by FigureTile), so no content is computed twice and no either/or remains. Ready-null prints "—";
  `onlyData` for unknown objects.
- **B3 — the journey + ledger** (3 files: `apps/web/e2e/analytics.spec.ts`, `docs/spec/parity.yaml`,
  `changes/38-charts.md`). Acceptance: the e2e inverts all three "Ready" blessings (the `valueText` helper's null→Ready
  rule at :52-65, the ready loop at :168-181, the checklist tile at :199-206) and asserts structure instead: the bubble
  and timeline tiles contain `[data-testid="chart"][data-chart-state="ready"]`, breakdown-free prints two numbers joined
  by "of", costliest shows its top problem, the checklist shows its item count, and **no figure tile contains "Ready"**.
  These fail on main today. Parity row `m4a.dashboard` gains the journey's name as evidence.

Order: A1 → B1 → B2 → B3. B1 compiles against A1's types; B2's red e2e needs A1 in the tree.

## Rails

Red test first; never delete/skip/weaken a test (B3's three inversions are a named, deliberate replacement); file ≤ 400
lines, function ≤ 60, screen file ≤ 300; no new dependency; chrome strings are catalogue keys and engine prose is data;
tokens and kit only; no fabricated numbers. One writer per packet; commit locally, no push; report red, green, deviations.

## Acceptance (what Nimish checks)

Analytics → Today: the **Bubble chart** draws one bubble per machine with a breakdown (size = MTTR), the **Expansion
timeline** draws its stacked bars and cumulative line, **Breakdown-free** reads "53 of 125", **Costliest problems** lists
its top three, the **Data checklist** lists its open items — each with a table or list, each with its rows link, and
nowhere does a figure say "Ready".
