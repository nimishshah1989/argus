# Coverage: Footprint (`screens/v2/footprint`)

Built 20-Nov-2026 from the v1 figure tile for `a7-footprint`, `docs/spec/PARITY.md` ("Footprint (A7) packing ... Keep (M4)"), the Guide section 11
(`analytics.guide.footprint.*`) and the engine reply `a7-footprint` (`packages/domain/src/analytics/footprint.ts`). v1 has no e2e spec for it. The test runs the real engine
over the frozen answer key.

**Footprint is not a new screen and it does not mean "20% of machines cause most hours".** In v1, the spec and the Guide it is the floor space screen: each machine's
Length x Width, the smallest square floor that fits them with 1.0 m gaps, and where the space goes. This screen keeps that meaning.

| Item                                                                 | Source                        | v2                     | Where in v2                                                                               |
| -------------------------------------------------------------------- | ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| Machines Mapped ("125 / 125, machines with length and width")        | engine KPI 1                  | same                   | KPI card                                                                                  |
| Machine Area (sum of L x W)                                          | engine KPI 2                  | same                   | KPI card                                                                                  |
| Floor Needed (square, 1.0 m gaps and margin)                         | engine KPI 3                  | same                   | KPI card, and the sentence under the verdict                                              |
| Machine Area Share                                                   | engine KPI 4                  | same                   | KPI card, and the verdict                                                                 |
| Avg Footprint per machine                                            | engine KPI 5                  | same                   | KPI card                                                                                  |
| Average Footprint by Category table                                  | engine table 1                | same                   | table, sortable, searchable                                                               |
| Footprint by Cell table                                              | engine table 2                | better                 | table, each cell is a chip that opens the cell drawer                                     |
| Footprint by Location table                                          | engine table 3                | same                   | table                                                                                     |
| Footprint Growth by Purchase Year table                              | engine table 4                | same                   | table, and the chart of the cumulative area                                               |
| 10 Largest Footprints table                                          | engine table 5                | better                 | table, each machine is a chip                                                             |
| The machines behind the figure (drill ids: machines with dimensions) | `figure.drill.ids`            | needs kit: rows-behind | kit part in review (PR 508)                                                               |
| As-of date                                                           | `analytics.asOf`              | same                   | source line                                                                               |
| Not computed yet                                                     | `analytics.notComputed`       | same                   | designed empty state; the engine also returns nothing when no machine has both dimensions |
| Loading, error with retry, offline                                   | StateNotice                   | same                   | kit states                                                                                |
| Guide text (clearance, packing, missing dimensions)                  | `analytics.guide.footprint.*` | better                 | behind "Why?"                                                                             |
| Machines screens menu                                                | ScreenMenu                    | moved                  | the rail lists sections only (open question to Nimish)                                    |
| Words in English and Gujarati                                        | catalogue                     | same                   | `v2m.*` keys                                                                              |

## More intelligent

| Insight                                                                                   | Data source                                                               | Engine computes it today                                                                           |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| The verdict says what floor the fleet needs and how much of it the machines fill          | `a7-footprint` KPIs                                                       | yes, built                                                                                         |
| Growth of the fleet's area by purchase year as a line, hover for each year                | `a7-footprint` growth table                                               | yes, built                                                                                         |
| A cell map of the floor (the assumed "Footprint" idea: cells by where the lost hours are) | breakdown map in `a2-category-cell` ranks machines, cells, codes by hours | needs server: a figure that joins the cell hours to the floor area per cell; to decide with Nimish |
| The packed floor drawn to scale (each machine's place in the square)                      | the engine packs the machines but sends no positions                      | needs server: positions from the packing                                                           |
| Spare floor against planned machines                                                      | none stored                                                               | needs server: a plan of machines to add                                                            |
