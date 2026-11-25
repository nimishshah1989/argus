# Coverage: Monthly Report (`screens/v2/monthly-report`), S23, ticket #763

Written 25-Nov-2026 by Plan from the approved wireframe `design/wireframes/S23-monthly-report.html` (its Coverage
section), v1 `screens/analytics/ReportsPage.tsx` + `report-view.ts`, the engine figure `monthly-report` and its answer key
`fixtures/answer-key/monthly-report.json`. Built as drawn; the wireframe's questions are notes below and do not block the
ticket. v1's page is deleted by S24 (#765), once both reports are v2 (ADR 0044 decision 2).

**MISSING (needs Nimish's written yes): none.** Tails and extra columns open in place or sit under "Show the numbers".

| Item                                                                                       | Source                   | v2     | Where in v2                                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------ | ------ | ------------------------------------------------------------------------------------------------ |
| Tab row Monthly / Annual, title                                                            | shell, engine title      | same   | "Screens in Reports"; `FIRST.reports` is the monthly report                                      |
| Period line ("October 2026": the month before the plant date)                              | `report-view.ts` L57-75  | same   | row under the lede                                                                               |
| "Download PDF" (`/api/v1/reports/monthly.pdf`), "Export the whole data set (Excel)"        | `ReportsPage.tsx` L35-60 | same   | row under the lede                                                                               |
| Chart `ch-rp-daily`: breakdowns and hours by day, against the month before                 | engine chart             | better | month calendar of heat cells + takeaway; day-by-day against September under "Show the numbers"   |
| Chart `ch-rp-12m`: 12 months to the report month                                           | engine chart             | better | ranked monthly bars, breakdowns and hours beside each; exact numbers under "Show the numbers"    |
| "Where the time went" x4 (machine, cell, category, code): breakdowns, hours, prev., change | engine tables 1-4        | better | four tables, each with a takeaway, worst first; prev. hrs opens in place; tail collapsed         |
| "Longest breakdowns this period": date, machine, problem, code, done by, hours             | engine table 5           | better | five default columns, "Done by" opens in place, code as a chip; all six under "Show the numbers" |
| "Maintenance team": 11 columns                                                             | engine table 6           | better | five default columns, the rest open in place; all eleven under "Show the numbers"                |
| "Machines added": category, fleet at start, added, added prev. month, change, fleet at end | engine table 7           | better | five columns (prev. month and change folded into "Against September"); all six under the numbers |
| "Management commentary and actions": blank Action / Owner / Due date rows                  | untitled table, caption  | same   | unchanged, a blank paper form; no takeaway                                                       |
| One takeaway per section, computed                                                         | none in v1               | new    | `daily, months, machine, cell, category, code, longest, team, added`                             |
| "See the rows", old `?drill=ticket` address                                                | `FigureDrill`            | same   | page action, drawer                                                                              |
| Empty report line, Not computed yet, loading, error, offline                               | `analytics.report.empty` | same   | kit states                                                                                       |
| Gujarati                                                                                   | i18n keys                | same   | takeaway sentences added in en + gu                                                              |

## Notes: open questions for Nimish (from the wireframe; built as drawn meanwhile)

1. The PDF and printed workbook keep the full plain tables; only the screen sorts worst first and collapses tails.
   Assumed yes (the PDF route is not touched).
2. Tail rows ("4 more machines") are collapsed on screen; the PDF still prints every row. Assumed yes.
3. Daily chart as a calendar (as drawn) or a line of days against September? Built: the calendar, as approved; the
   September comparison sits under "Show the numbers".
