# Coverage: Compare (v2, `screens/v2/compare/`)

Built from v1's Compare (`screens/analytics/MachinesPage.tsx` → `KeyScreen`, deleted in the PR that made this screen
live), the engine figure `compare` (`packages/domain/src/analytics/compare.ts`, `compare-score.ts`), the answer key
`fixtures/answer-key/compare.json` and `e2e/analytics-compare.spec.ts`. First listed in `scope/batch1.md` (Compare
section). Plan: ADR 0021. Tickets: CMP-1 #584 (domain pair + year so far), CMP-2 #585 (`GET /analytics/compare`),
CMP-3 #586 (the six tables in the view), CMP-4 #587 (live adapter), CMP-5 #588 (live at v1's address, v1 deleted).

**Live (CMP-5).** The screen is at `/analytics/machines?screen=compare` (v1's address) on `GET /analytics/compare`; the
pair is the URL's `?a=&b=` (none: the engine's own pair, the one v1 showed). The gallery keeps the approved fixture.
Shipped 24 Nov 2026 by ticket 588's PR, which deletes v1 `MachinesPage.tsx`.

| Item                                                                         | Source                     | v2      | Where in v2                                                                                                     |
| ---------------------------------------------------------------------------- | -------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| Health score 0–10, age-adjusted                                              | key "Health checkup" row 1 | same    | "Health checkup" table, first row, both machines (CMP-3, CMP-4)                                                 |
| Health scorecard: 5 weighted parts against "expected"                        | key "Health scorecard"     | same    | "Health scorecard" table, the engine's rows whole                                                               |
| Category average column                                                      | key "Health checkup"       | same    | "Health checkup" table, last column; machine A's category (ADR 0021 §1)                                         |
| Availability, Breakdowns, Breakdown hours, MTTR, MTBF (whole period)         | checkup                    | same    | "Health checkup" table rows                                                                                     |
| Availability, Breakdowns, Breakdown hours, MTTR, MTBF (this year so far)     | not in v1                  | better  | the two boxes, each marked against its twin (ADR 0021 §2)                                                       |
| Breakdowns per month, BD hours per month                                     | checkup                    | same    | "Health checkup" table rows                                                                                     |
| Longest breakdown, days since last breakdown                                 | checkup                    | same    | "Health checkup" table rows                                                                                     |
| Spares cost, spares cost per breakdown                                       | checkup                    | same    | "Health checkup" table rows, heads and admin only; the engine prints ₹ 0 (open question to Nimish, ADR 0021 §4) |
| Money lost (hours × value of a machine hour)                                 | not in v1                  | better  | box figure and "Extra money lost" key figure, heads and admin only                                              |
| Breakdowns, last 90 days / the 90 days before                                | checkup                    | same    | "Health checkup" table rows                                                                                     |
| Electrical / Mechanical breakdowns                                           | checkup                    | same    | "Health checkup" table rows                                                                                     |
| PM entries logged                                                            | checkup                    | same    | "Health checkup" table row                                                                                      |
| ✓ on the better value                                                        | checkup                    | same    | in the table as v1 prints it; the boxes also say "Better / 2.0× more / About the same"                          |
| One-line explanation under each row                                          | checkup row hints          | same    | in the table's first column, as the engine prints it                                                            |
| Specifications: category, age, cell, make, model, controller, year, power... | key "Specifications"       | same    | "Specifications" table, whole                                                                                   |
| Longest breakdowns, machine A / machine B (top 5)                            | key tables 4, 5            | same    | the two "— longest breakdowns" tables                                                                           |
| By shift                                                                     | key table 6                | same    | "By shift" table                                                                                                |
| Chart: breakdown hours by maintenance code                                   | key `ch-cmp-code`          | changed | "What is different": the three codes the two differ on most, this year, in words                                |
| Chart: breakdown hours by month                                              | key `ch-cmp-month`         | changed | "Breakdown hours a week", 12 weeks                                                                              |
| Sort any table column                                                        | `key-body.tsx`             | same    | every table: sort, search, ten rows a page                                                                      |
| Drill to the two machines' rows                                              | e2e "See the rows"         | changed | every machine is a chip that opens its drawer                                                                   |
| Choose the two machines                                                      | not in v1                  | better  | the picker; the pair lives in the URL                                                                           |
| Money only for head roles                                                    | PARITY.md                  | same    | the server sends no rate and no spares rows to other roles (ADR 0021 §4)                                        |
| Add the fix to Team Focus                                                    | not in v1 (wireframe)      | changed | "Open Team Focus" link: nothing stores an added action (ADR 0021 §5; open question to Nimish)                   |
| Loading, error, not computed, offline                                        | key screen states          | same    | the v2 screen states                                                                                            |
