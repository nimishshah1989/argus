# Coverage: Footprint (`screens/v2/footprint`)

Built 20-Nov-2026 from the v1 figure tile for `a7-footprint`, `docs/spec/PARITY.md` ("Footprint (A7) packing ... Keep (M4)"), the Guide section 11
(`analytics.guide.footprint.*`) and the engine reply `a7-footprint` (`packages/domain/src/analytics/footprint.ts`). v1 has no e2e spec for it. The test runs the real engine
over the frozen answer key.

**Footprint is not a new screen and it does not mean "20% of machines cause most hours".** In v1, the spec and the Guide it is the floor space screen: each machine's
Length x Width, the smallest square floor that fits them with 1.0 m gaps, and where the space goes. This screen keeps that meaning.

| Item                                                                 | Source                        | v2     | Where in v2                                                                                                                                                                                     |
| -------------------------------------------------------------------- | ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Machines Mapped ("125 / 125, machines with length and width")        | engine KPI 1                  | same   | KPI card                                                                                                                                                                                        |
| Machine Area (sum of L x W)                                          | engine KPI 2                  | same   | KPI card                                                                                                                                                                                        |
| Floor Needed (square, 1.0 m gaps and margin)                         | engine KPI 3                  | same   | KPI card, and the sentence under the verdict                                                                                                                                                    |
| Machine Area Share                                                   | engine KPI 4                  | same   | KPI card, and the verdict                                                                                                                                                                       |
| Avg Footprint per machine                                            | engine KPI 5                  | same   | KPI card                                                                                                                                                                                        |
| Average Footprint by Category table                                  | engine table 1                | same   | table, sortable, searchable                                                                                                                                                                     |
| Footprint by Cell table                                              | engine table 2                | better | table, each cell is a chip that opens the cell drawer                                                                                                                                           |
| Footprint by Location table                                          | engine table 3                | same   | table                                                                                                                                                                                           |
| Footprint Growth by Purchase Year table                              | engine table 4                | same   | table, and the chart of the cumulative area                                                                                                                                                     |
| 10 Largest Footprints table                                          | engine table 5                | better | table, each machine is a chip                                                                                                                                                                   |
| The machines behind the figure (drill ids: machines with dimensions) | `figure.drill.ids`            | same   | live at `/analytics/machines?screen=a7-footprint`: a press on the figure opens the machines behind it in the drawer (`?drawer=figure:a7-footprint`), a row opens its machine, Back closes it    |
| As-of date                                                           | `analytics.asOf`              | same   | source line                                                                                                                                                                                     |
| Not computed yet                                                     | `analytics.notComputed`       | same   | "Not computed yet" for a figure the engine did not compute (`not-computed.test.ts`); the engine also returns nothing when no machine has both dimensions, which says "Nothing to show here yet" |
| Loading, error with retry, offline                                   | StateNotice                   | same   | kit states                                                                                                                                                                                      |
| Guide text (clearance, packing, missing dimensions)                  | `analytics.guide.footprint.*` | better | behind "Why?"                                                                                                                                                                                   |
| Machines screens menu                                                | ScreenMenu                    | moved  | the rail lists sections only (open question to Nimish)                                                                                                                                          |
| Words in English and Gujarati                                        | catalogue                     | same   | `v2m.*` keys                                                                                                                                                                                    |

## More intelligent

| Insight                                                                                   | Data source                                                               | Engine computes it today                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| The verdict says what floor the fleet needs and how much of it the machines fill          | `a7-footprint` KPIs                                                       | yes, built                                                                                  |
| Growth of the fleet's area by purchase year as a line, hover for each year                | `a7-footprint` growth table                                               | yes, built                                                                                  |
| A cell map of the floor (the assumed "Footprint" idea: cells by where the lost hours are) | breakdown map in `a2-category-cell` ranks machines, cells, codes by hours | later: a figure that joins the cell hours to the floor area per cell; to decide with Nimish |
| The packed floor drawn to scale (each machine's place in the square)                      | the engine packs the machines but sends no positions                      | later: positions from the packing                                                           |
| Spare floor against planned machines                                                      | none stored                                                               | later: a plan of machines to add                                                            |

## ADR 0036 kit rules (ticket #751, sweep #706 batch B)

One row per kit rule, as ADR 0041 / 0043 map them. Nothing here becomes "not built". 2026-11-25.

| Rule                          | Status         | Where, or why not                                                                                                    |
| ----------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| R1 / R10 TileSet + ShowDetail | done           | `View.tsx`: the `KpiCard` row is a `TileSet`                                                                         |
| R2 ActionStrips               | not applicable | dashboard only; no other page has counts with a way in (ADR 0041)                                                    |
| R4 PeriodToggle               | not applicable | the engine serves one period only (`figuresReplySchema`); a toggle would compute figures it did not print (ADR 0041) |
| R5 ReviewMarker               | not applicable | no model carries a held-for-review count and there is no review-tray route (ADR 0041)                                |
| R6 Download Excel             | not applicable | not one of Bhavin's exports (ADR 0041)                                                                               |
| R11 readable / rupees / exact | not applicable | the page formats no lakh-scale number or money itself; engine-printed strings are never re-rounded (ADR 0041)        |
| R17 ReasonChips               | not applicable | only the Action Center risk table carries reasons; other repeat columns are engine-printed counts (ADR 0041)         |
| R20 RankedBars                | not applicable | no Pareto or ranked bar on this page in ADR 0043's map                                                               |
| R21 Quadrant                  | not applicable | no bubble chart on this page (ADR 0041)                                                                              |
