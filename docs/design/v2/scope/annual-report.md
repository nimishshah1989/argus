# Coverage: Annual Report (`screens/v2/annual-report`), S24, ticket #765

Written 25-Nov-2026 by Plan from the approved wireframe `design/wireframes/S24-annual-report.html` (its Coverage
section), v1 `screens/analytics/ReportsPage.tsx` + `report-view.ts`, the engine figure `annual-report` and its answer key
`fixtures/answer-key/annual-report.json`. Built as drawn; the wireframe's questions are notes below and do not block the
ticket. This ticket deletes v1's Reports page (`ReportsPage.tsx`, `report-view.ts` and their tests).

**MISSING (needs Nimish's written yes): none.** Tails and extra columns open in place or sit under "Show the numbers".

| Item                                                                                                                  | Source                  | v2     | Where in v2                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| Tab row, title, period line ("2026 to 11 November")                                                                   | shell, `report-view.ts` | same   | row under the lede                                                                                                |
| "Download PDF" (`/api/v1/reports/annual.pdf`), "Export the whole data set (Excel)"                                    | `ReportsPage.tsx`       | same   | row under the lede                                                                                                |
| Chart `ch-ry-month`: breakdowns and hours by month, partial month starred                                             | engine chart            | better | ranked bars with numbers beside them, "Nov*" starred; exact numbers under "Show the numbers"                      |
| Chart `ch-ry-pareto`: 15 costliest machines, running share                                                            | engine chart            | better | 5 bars plus the tail, running share in the bar label; all 15 under "Show the numbers"                             |
| Month by month: 8 columns                                                                                             | engine table            | better | five default columns, worst months first, the rest open in place; all eight, in calendar order, under the numbers |
| Quarter by quarter: 7 columns                                                                                         | engine table            | better | five default columns; Q4 to date in the tail; all seven under "Show the numbers"                                  |
| Where the downtime comes from: #, machine, category, age, cell, breakdowns, hours, share, cumulative, months in top 5 | engine table            | better | five default columns; category, age, cell, breakdowns open in place; all ten under the numbers                    |
| By cell; By cause; Machine categories — reliability; Machine age; Maintenance team                                    | engine tables           | better | each: takeaway, yardstick against the plant, top 3, tail, all columns under "Show the numbers"; age as bars       |
| Preventive maintenance and long breakdowns (two tables, one engine title)                                             | engine tables           | same   | both kept with the same title, sub-lines "1 of 2" / "2 of 2"; first as bars, second a ranked table                |
| Machines added month by month: category, start of year, Jan…last month, added, end                                    | engine table            | better | a cell strip per category for the months; all 14 columns under "Show the numbers"                                 |
| Management commentary and actions (blank rows)                                                                        | untitled table          | same   | unchanged, a blank paper form; no takeaway                                                                        |
| One takeaway per table section, computed                                                                              | none in v1              | new    | `months, quarters, machines, cells, causes, categories, age, team, pm, long, added`                               |
| "See the rows", old `?drill=ticket` address, empty line, Not computed yet, loading, error, offline                    | `FigureDrill`, states   | same   | page action, drawer, kit states                                                                                   |
| Gujarati                                                                                                              | i18n keys               | same   | takeaway sentences added in en + gu                                                                               |

## Notes: open questions for Nimish (from the wireframe; built as drawn meanwhile)

1. As Monthly: only the screen sorts worst first and collapses tails; the PDF prints everything. Assumed yes.
2. "Month by month" sorts worst first on screen, so months are out of calendar order there (the bar chart and the
   table under "Show the numbers" stay in calendar order). Built as drawn.
3. MTBF basis (3,120 working hours per machine in the wireframe's sample). The screen prints the engine's own MTBF;
   no new basis is introduced.
4. The two tables titled "Preventive maintenance and long breakdowns" keep the engine title with "1 of 2" / "2 of 2".
   Built as drawn; the engine title is not changed.
