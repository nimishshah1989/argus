# Coverage: Team Focus (v2, `screens/v2/team-focus/`)

Built from `screens/analytics/TeamFocusPage.tsx` and `TodayRest.tsx` (both deleted by TF-3, ticket 580, the PR that made this screen live and lets the team save status, owner and note), `team-focus-actions.ts` (kept: the v2 adapter and the Dashboard banner read it), `e2e/analytics-compare.spec.ts` (Team Focus part ported), parity `m4a.team-focus` and the engine figure `team-focus` (`team-focus.ts`). Unit-test data is the frozen answer `fixtures/answer-key/team-focus.json`. **Live at v1's address** (`/analytics/today?screen=team-focus`) on `GET /analytics/figures` and the notes routes (`GET`/`PUT /analytics/team-focus/notes`, ADR 0018). Decisions: ADR 0020.

| Item                                                | Source                   | v2      | Where in v2                                                                                                                                                                                                         |
| --------------------------------------------------- | ------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI "Actions" with "x not started, y in progress"   | `team-focus.ts` `kpisOf` | changed | "Open actions" counts the open (not started or in progress); its second line is "y in progress, x not started". Same actions, closed ones left out                                                                  |
| KPI "Done" with "x marked not needed"               | `kpisOf`                 | moved   | the "Done" figure's second line, "x done, y marked not needed"                                                                                                                                                      |
| KPI "Progress %"                                    | `kpisOf`                 | same    | "Done": the share of the month's actions done or not needed                                                                                                                                                         |
| Six lanes, each its own group                       | `FOCUS_LANES`            | changed | the lane name is a pill on every row and decision; rows are one table, filterable; each action's drawer names its lane                                                                                              |
| Lane hint (what the lane is for)                    | `FOCUS_LANE_HINTS`       | moved   | the Why of each "Needs an owner" decision, and the action's drawer                                                                                                                                                  |
| Per-lane "open of total"                            | `LaneCard`               | moved   | the action's drawer: "x open of y" for its lane                                                                                                                                                                     |
| Lane order (A, B, C, F, D, E)                       | `FOCUS_LANES`            | changed | the table keeps the engine's order (lanes in v1's order) until a column is sorted; "Needs an owner" is biggest stake first                                                                                          |
| Every action listed (31 in the key)                 | e2e                      | same    | "Every action this month": 10 a page, search, sort, filters (no owner, in progress, done)                                                                                                                           |
| Action title                                        | `ActionRow`              | same    | the row and the drawer                                                                                                                                                                                              |
| Machine named                                       | `ActionRow`              | better  | a machine chip that opens the machine                                                                                                                                                                               |
| Hours at stake                                      | `stakeText`              | same    | "Hours a month", the engine's figure with v1's places                                                                                                                                                               |
| Status (not started, in progress, done, not needed) | `focusStatusKey`         | better  | same four words; now saved (TF-1) and changed in the action's drawer                                                                                                                                                |
| Owner                                               | `ActionRow`              | better  | a chip, or "Nobody yet"; saved; "I’ll take it" makes you the owner (shown only when the signed-in person and the month are known, ticket 594); changed in the drawer; the chip opens what that owner has this month |
| Note                                                | `ActionRow`; parity row  | better  | under the action's title; saved and edited in the drawer                                                                                                                                                            |
| Drill to the machines the actions name              | `FigureDrill`            | same    | the page's "show the rows behind" control opens every machine the figure names                                                                                                                                      |
| Not-ready message                                   | `TeamFocusPage.tsx`      | changed | "Not computed yet" (`analytics.notComputed`) when the engine has no action                                                                                                                                          |
| Who may open and write it                           | `canAnalytics`           | same    | the figures and the notes routes both use it; a role that may not is refused by the server and the screen says so                                                                                                   |
| An old `?drill=` link on Today                      | `TodayRest.tsx`          | same    | lands in the drawer with the same rows (`LiveFrame`)                                                                                                                                                                |
| Action Center banner above Team Focus               | `TodayRest.tsx`          | moved   | on the Dashboard (Today's first screen) and the Action Center itself                                                                                                                                                |

**Removed from the v2 design (no source, ADR 0020 §5–6):**

- later: a person's load ("Overloaded", "Has room") and its two filters — needs a rule for "overloaded"; the column stays empty until one exists.
- later: a person's role in the people table — owners are saved free text (ADR 0018 §3), not people records.
- later: the suggested owner and the rebalance proposal — no engine rule.
- later: money a year on a decision — v1 showed no money here; a money view would be role-gated (batch1 loss 8).
- later: the 90-day strip on each decision and "vs last month" on the key figures — the engine keeps no earlier month.
- later: the Dashboard's Team Focus banner still counts every action as open — it reads no notes.

## More intelligent

| Idea                                 | What the user sees                                   | Data                     | Engine today?      |
| ------------------------------------ | ---------------------------------------------------- | ------------------------ | ------------------ |
| Who carries what                     | each owner's open actions, hours at stake and closed | saved notes + the figure | yes (adapter sums) |
| Biggest unowned first                | "Needs an owner", biggest stake first                | the figure's stakes      | yes                |
| Overdue Why-Why ageing (batch1 idea) | "Why-Why on the 11-hour stop: due 12 days ago"       | lane F                   | yes; not shown yet |

## ADR 0036 kit rules (ticket #750, sweep #706 batch A)

One row per kit rule, as ADR 0041 / 0043 map them. Nothing here becomes "not built". 2026-11-25.

| Rule                          | Status         | Where, or why not                                                                                                    |
| ----------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------- |
| R1 / R10 TileSet + ShowDetail | done           | `View.tsx`: the KPI row is a `TileSet`                                                                               |
| R2 ActionStrips               | not applicable | dashboard only; no other page has counts with a way in (ADR 0041)                                                    |
| R4 PeriodToggle               | not applicable | the engine serves one period only (`figuresReplySchema`); a toggle would compute figures it did not print (ADR 0041) |
| R5 ReviewMarker               | not applicable | no model carries a held-for-review count and there is no review-tray route (ADR 0041)                                |
| R6 Download Excel             | done           | `DownloadExcel` (`teamFocusSheets`)                                                                                  |
| R11 readable / rupees / exact | not applicable | the page formats no lakh-scale number or money itself; engine-printed strings are never re-rounded (ADR 0041)        |
| R17 ReasonChips               | not applicable | only the Action Center risk table carries reasons; other repeat columns are engine-printed counts (ADR 0041)         |
| R20 RankedBars                | not applicable | no Pareto or ranked bar on this page in ADR 0043's map                                                               |
| R21 Quadrant                  | not applicable | no bubble chart on this page (ADR 0041)                                                                              |
