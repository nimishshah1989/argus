# Coverage: Action Center (`screens/v2/action-center`)

**Live at `/analytics/today/action-center`** (the address v1 had), inside the v2 shell, for the roles v1 allowed (supervisor, head, plant head, admin; any other login is refused, as the server refuses it); v1's page is deleted.
The e2e `apps/web/e2e/analytics-action-center.spec.ts` (the v1 journey, ported: board, filters, acknowledge with owner, due and note, snooze, reopen across reloads) and `v2-action-center-live.spec.ts` (real server) run it.

Rebuilt 20-Nov-2026 from `GET /analytics/action-center` (the board: 16 rules, status and priority counts, risk rows; `packages/shared/src/action-center.ts`), `PUT` and `DELETE /analytics/action-center/nudges/:key`
(the writes, each answering the fresh board) and the plant's own lists (machine codes, the people an acknowledgement may name). The adapter is `screens/v2/action-center/adapter.ts`; its tests run the real engine's
`actionCenterBoard` over the frozen 11 November answer key, with acknowledgements added the way the server adds them, and v1's mapping assertions on the key's 36 nudges. No money is printed (v1 prints none here).

| Item                                                                    | Source                                     | v2    | Where in v2                                                                                                               |
| ----------------------------------------------------------------------- | ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------- |
| Four priority count tiles (high, medium, low, good news)                | `SeverityTiles`, `bySeverity`              | same  | four cards; "Act now" and "Plan this week" under a high or medium count above zero                                        |
| As-of date and the intro sentence                                       | lede                                       | same  | the line under the verdict                                                                                                |
| "Machines needing attention": machine and model                         | `RiskTable`                                | same  | table: the machine chip (opens it in the drawer) and its model                                                            |
| Risk score (high 3, medium 2, low 1) and "why": the rules that fired    | `action-center-figure.ts` 118–157          | same  | score and Why columns as the engine printed them; the weights are said under the verdict's Why                            |
| Risk table: the engine's top 8, search, sort, paging                    | `RISK_LIMIT`, `useClientTable`             | same  | table of the board's rows, search, sort on every column, ten to a page                                                    |
| Machine opens its machine page                                          | `machineHref`                              | moved | the chip opens the drawer; "Open full page" goes to `/analytics/machines/<id>`                                            |
| Four status tabs Open / Acknowledged / Snoozed / Resolved, counts       | `TAB_ORDER`                                | same  | four buttons with their counts, Open first                                                                                |
| Priority filter; type filter (16 kinds); search over title and machines | `action-center-filters.tsx`, `filterCards` | same  | two selects and a search box; `filter.ts` holds the rule, with v1's tests                                                 |
| Nudges grouped under priority headings, with counts                     | `severityGroups`                           | same  | one group per priority, high first, each with its count; a priority with none draws no heading                            |
| Nudge type label (16 kinds)                                             | `RULE_LABELS`                              | same  | the pill on each card, in the reader's words                                                                              |
| Nudge title; machine chips                                              | card                                       | same  | title; each machine a chip (code, never an id; an id inside a title is replaced by its code)                              |
| Number of entries; latest entry date                                    | `entries`, `evidence`                      | same  | "12 entries"; "Latest entry 10-Nov-2026"                                                                                  |
| "Reopened" mark; "not in production data" mark                          | `reopened`, `excluded`                     | same  | two pills on the card                                                                                                     |
| Good-news nudges (no button at all)                                     | rule `good`, severity `info`               | same  | cards under "Good news" with no button                                                                                    |
| AMC / warranty and legal reminders                                      | rules `amc`, `legal`                       | same  | two of the 16 types, as cards                                                                                             |
| Acknowledge with owner, due date and note                               | `AckForm`                                  | same  | "Acknowledge nudge" form: owner (an active person or none), due date, note (500 characters); one form open at a time      |
| Snooze for N days; Resolved; Reopen                                     | `snoozeDays`, card buttons                 | same  | three buttons on an open card, Reopen on a stored one; each write answers the fresh board, which replaces the page's      |
| The stored acknowledgement shown (owner, due, note, snooze day)         | `StatusLine`                               | same  | the status pill then "Owner: …", "Due …", "Note: …" on the card; the day is DD-MMM-YYYY (UX rule 25), v1 wrote DD-MM-YYYY |
| "Could not save" alert                                                  | `ActionCenterPage` `saveFailed`            | same  | an alert above the nudges; the write is not sent offline                                                                  |
| Empty tab message                                                       | `Cards`                                    | same  | one line under the filters                                                                                                |
| Refused view for a role without analytics                               | `Waiting`; unit and e2e                    | same  | the kit's refused state; the page also refuses a login the server would refuse                                            |
| Loading, error with Retry, offline                                      | `NotReady`, `viewState`                    | same  | kit states                                                                                                                |
| No money on this screen                                                 | `action-center.ts` header                  | same  | no rupee is printed; a test holds it                                                                                      |
| Screen menu to Dashboard, Data checklist                                | shell tabs                                 | moved | a row of Today's screens above the page                                                                                   |

## Removed: sections of the invented v2 Action Center that no data feeds

| Was in the fixture                                            | Why it is gone                                                      | later                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Decisions ranked by hours won back, with rupees a year        | the engine has no value per nudge; v1 shows no money on this screen | `later:` needs server: a value per nudge, money for head roles only           |
| "Who owns what", with suggested people and an "Assign" action | invented suggestions; every stored owner in the key data is empty   | `later:` best placed person from `breakdown_report_person` and `work_segment` |
| A 90-day strip of breakdown days per decision                 | not on the board                                                    | `later:` the board could carry the entry days                                 |
| "vs last week" counts                                         | no daily snapshot of the board                                      | `later:` `kpi_snapshot`                                                       |

## More intelligent

| Idea                                    | What the user sees                                             | Data                               | Engine today                      |
| --------------------------------------- | -------------------------------------------------------------- | ---------------------------------- | --------------------------------- |
| later: raise an inspection from a nudge | "Inspect" makes a real inspection ticket, linked               | `POST …/nudges/:key/ticket`        | yes: `acceptNudge` in `nudges.ts` |
| later: came back after a fix            | "settled on 2-Nov and came back 3 times since"                 | board `reopened`, acknowledgements | yes: `reopened` is on the board   |
| later: slipping commitments             | "2 acknowledged nudges are past the due date their owner gave" | acknowledgement `due`              | data stored; one comparison       |
