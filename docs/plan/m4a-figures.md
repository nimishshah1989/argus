# M4a figures: who computes what, from what, and what main is missing

For tickets 37 to 45 and for part B of ticket 36 (the migration). Verdicts are in `docs/plan/m4a-triage.md`; the answer key is `fixtures/answer-key/<id>.json`; `input.json` there is the data the platform computed from (platform shape, names coded). Table and column names are as on main at `3d05d1f` (migrations 0001 to 0012).

## 1. For part B: the migration (candidate list)

Constraint: D17 caps new tables at 12, and `kpi_snapshot` is the M4a one. Everything else needs an existing home confirmed by the schema reviewer, or is dropped in `DIFFERENCES.md`.

1. **`kpi_snapshot`** (new table, D17): run id, as-of, measure key, scope, period, value. `engine.run` writes it (ticket 37).
2. **Alias column on `list_item`:** old Bhavin codes (19 live, ELE, HYD, ROT retired) resolve to one item. Needed by 37 and by M4b ticket 47.
3. **Why-Why records:** 24 candidates, 0 saved on real data, so nothing to migrate. Proposed home: a `ticket_event` of a new type on the closed ticket (five whys, conclusion, who, when; history is append-only), with the conclusion copied to `breakdown_report.root_cause`. Schema reviewer to confirm.
4. **Team Focus status, owner, note; nudge acknowledge and snooze:** the platform keeps these in its settings blob (`acAcks`: 6 real entries; Team Focus: none yet). Proposed home: `setting` rows, one key per nudge or action (`nudge:<rule>|<machine>`, `focus:<period>|<action>`), so two heads cannot overwrite each other. Snooze length is the existing threshold `snoozeDays` (7).
5. **Spare cost:** the platform stores spare 1 to 3 and a cost for each; `breakdown_report` has `spare_used` text only. Money Matters and the "spares spend" nudge read the cost. Needs one numeric column (or a list on the row); the schema reviewer decides.
6. **Machine footprint, conveyor side, efficiency factor:** no column. `machine.metadata` (jsonb) exists and is the cheapest home; no migration unless the reviewer wants columns.
7. **Move locations:** the cell change log carries from and to location as well as cell; `machine_move` has cells only. Two nullable columns, or fold into `metadata`.
8. **PDF import by QR:** dropped (triage `pdf-import`). `breakdown_report.qr_payload` stays for printing; nothing is lost. The drop is recorded as DIFFERENCES D21 (PR #268).

**Safe to drop?** `person.kind`, `ticket.sla_policy_id`, `ticket.handback_status`: no product code reads or writes them. `tools/retired-columns.test.ts` fails on any such use in `apps/server/src`, `packages/shared/src`, `packages/domain/src`, `packages/db/src` and `scripts` and passes on main today. It matches the snake_case names only, so the camelCase `slaPolicyId` below is not covered by it. It is **not a blocker**, but the drop must also change these, found by search (not run):

- `packages/db/migrations/0007_sla_policy_timer.sql` created `ticket_sla_policy_idx` and `ticket_sla_policy_tenant_fk` on `sla_policy_id`; both go with the column.
- `packages/db/test/seed.sql` line 6 inserts `person.kind` (and lines 110 and 112 write `sla_policy_id`).
- `packages/db/test/sla-migration.test.ts` (line 99, a cross-tenant policy update on that column) writes it. The test checks the dropped foreign key, so it is retired with the column; the orchestrator must rule on that, since a test may not be deleted to go green.
- `apps/server/test/fixtures/state-golden.ts` (line 180) inserts it.
- `packages/shared/src/ticket-reply.ts` (line 55) still lists `slaPolicyId` as an optional reply field; `apps/web/src/components/actionSpecs.test.ts` and `apps/web/src/screens/desk/views.test.ts` set it to null; `packages/domain/test/sla.test.ts` (line 828) asserts it is absent.
- `packages/shared/src/sla.ts` exports `handbackStatusSchema` (values requested, confirmed, disputed, timed_out) for handback events. No column reader; part B may keep the name.
- `person.kind` has a CHECK in migration 0001 (staff, production, vendor). No reader found; `person.team` carries the same fact.

Part B also needs a backup step before the drop (CLAUDE.md), and a revert on a production copy (ticket 36 goal 3).

## 2. Figure family to engine ticket to inputs

The engine is `packages/engine`, pure (`run(profile, input)`); ticket 37 maps tickets and settings to its input. Where a figure needs something main lacks, the last column says so; section 1 collects them.

| Figures (fixture)                                                                                                 | Ticket | Inputs on main                                                                                                                                                                      | Missing on main                                                                 |
| ----------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Dashboard tiles, bubble, timeline, data checklist (`dashboard`, `data-checklist`)                                 | 38     | `machine` (segment, category, cell, `purchased_on`), closed `ticket` + `breakdown_report`, `setting`                                                                                | `kpi_snapshot` to store them                                                    |
| Registers, splits, cell log, footprint, age, machine page (`registers`, `a7-footprint`, `a8-age`, `machine-page`) | 39     | `machine` (make, model, serial, controller\*, year, `power_kw`, `capacity_kva`, `asset_code`), `machine_move`, `machine.metadata`                                                   | Length, width, conveyor side, efficiency factor (see 2.6); move locations (1.7) |
| Breakdown log, A1 to A3 (`breakdown-log`, `a1-bd-pm`, `a2-category-cell`, `a3-mttr-mtbf`)                         | 40     | Closed `ticket` rows from the past-breakdown path, `breakdown_report` (`downtime_min`, `breakdown_category`, `maint_code`, `shift_code`, `spare_used`), `list_item`, `machine_move` | Spare cost per breakdown (1.5); legacy codes through the alias column (1.2)     |
| A4 manpower, A5 energy, A6 Why-Why, A10 problems (`a4-manpower`, `a5-energy`, `a6-why-why`, `a10-problems`)       | 41     | `breakdown_report_person`, `crew_member`, `work_segment`, `machine.power_kw`, `setting` (efficiency factor, Why-Why threshold)                                                      | Home for a saved Why-Why (1.3)                                                  |
| A9 bottleneck, planning forecast, Forecast Lab (`a9-bottleneck-forecast`, `forecast-lab`)                         | 42     | Same as A1 to A3, plus `setting` (half-life, throughput)                                                                                                                            | Nothing (`forecast` freezing is M4b)                                            |
| Health score, Team Focus, Money, Fix Finder (`compare`, `team-focus`, `money-matters`, `fix-finder`)              | 43     | Same, plus `setting` (cost per hour, turnover)                                                                                                                                      | Team Focus status, owner, note (1.4)                                            |
| Action Center, 13 rules (`action-center`)                                                                         | 44     | Same, `setting` (thresholds `ac`), `machine`, AMC and legal lines (M4b)                                                                                                             | Nudge acknowledge and snooze (1.4)                                              |
| Monthly and annual report, workbook export, Guide (`monthly-report`, `annual-report`, `workbook-export`, `guide`) | 45     | Everything above; `file` for PDFs                                                                                                                                                   | Writer library (ADR)                                                            |
| Platform settings (`legacy-settings`)                                                                             | 37     | `setting` (hours per day 20, days per year 300, efficiency 20, throughput 1800, thresholds)                                                                                         | Keys to be named by 37; nothing to migrate                                      |
| PM Plan, PM Reports, AMC, Legal (`pm-plan`, `input`)                                                              | 49, 51 | Not on main: `pm_plan`, `asset_register` arrive in M4b (46)                                                                                                                         | M4b tables; only the parity rows and the key are here                           |

**The 13 data rules of the Action Center** (rule key in the platform): `recur` recurring fault, `freq` frequent breakdowns, `rise` worsening machine, `cell` same cause in a cell, `long` long breakdown without Why-Why, `spike` plant trend, `mttr` slow repairs, `hum` human mistakes, `shift` shift pattern, `team` team workload, `newm` new machine, `spares` spares spend, `age` ageing machines. Three more types are not data rules: `good` good news, `amc` AMC or warranty ending, `legal` legal due. Thresholds and the 36 nudges on the real data are in `action-center.json`.

## 3. A9 and Forecast Lab: column names, units and axes

Names are the platform's own header cells (line breaks read as spaces), units from its Guide (section 17 for A9 and the forecast, section 19 for the lab) and from the figures themselves; the matching key is `a9-bottleneck-forecast.json` and `forecast-lab.json` (each chart carries `axes` and `tickLabels`). All are computed by ticket 42; none is a ticket 43 figure. Where the Guide did not say, it is marked **not confirmed**.

**A9 "Highest-risk machines"** (one row per machine, worst first)

| Column                     | Unit and meaning                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #, Machine, Category, Cell | rank (1 is worst), machine code, category, cell                                                                                                                                          |
| Same kind                  | count of machines in the same category                                                                                                                                                   |
| Available                  | percent of machine hours the machine was not down                                                                                                                                        |
| BD hrs, Breakdowns         | hours of breakdown downtime (PM excluded; NO DT counts as 0 h); number of breakdowns                                                                                                     |
| Longest                    | hours, the longest single breakdown, written like `15.0 h`                                                                                                                               |
| Capacity left if down      | percent of the category's capacity left if this machine stops: (same kind minus 1) divided by same kind                                                                                  |
| Score                      | 0 to 100, higher is worse: 50 percent likelihood (unavailable share minus plant average, divided by 4, capped at 1) plus 50 percent consequence (1 divided by machines of the same kind) |
| Rating                     | Low, Watch (score 30 or more), High (40 or more), Critical (the only one of its kind and worse than average, or 55 or more with 10 or fewer of its kind)                                 |

**A9 "Capacity by machine category" and "by cell"**: Machines (count); Effective machines (count, fractional); Avg availability (percent); BD hrs (hours); BD % (percent of machine hours); Weakest machine (code and its availability in percent); Capacity left if it stops (percent).

**A9 "Downtime forecast for Planning"** (next calendar month; the page names it, for example December 2026)

| Column                | Unit and meaning                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Expected breakdowns   | count in the planning month                                                                                                     |
| Chance of at least 1  | percent probability of one or more breakdowns, from the same spread of counts                                                   |
| Expected hrs          | hours, the routine figure (median of the 2,000 seeded runs; **median versus mean not confirmed**)                               |
| Plan for (80%)        | hours, the 80th percentile: the machine stayed below it about 4 months in 5                                                     |
| Worst case (90%)      | hours, the 90th percentile                                                                                                      |
| Chance of a 8+ hr one | percent probability of at least one breakdown of 8 hours or more (`FC_LONG` = 8)                                                |
| Band                  | Hot (6 or more expected hours), Likely (3 to 6), Watch (1 to 3), Stable (under 1)                                               |
| Confidence            | High (6 or more breakdowns and 150 or more days), Medium (2 or more and 90 or more), otherwise Low (**Low rule not confirmed**) |
| Note                  | text: the recent-rate remark and the trend remark run together in one cell                                                      |

**A9 trend tables ("is it getting worse or better?")**: Breakdowns (count); "Per machine per month before → last 90 days" for categories and "Per month before → last 90 days" for machines, both in **breakdowns per month** (per machine for categories), two numbers joined by an arrow; Test score (the Laplace trend statistic, no unit; beyond plus or minus 1.96 is a clear trend); Verdict (More frequent, Less frequent, No clear trend). **Repeat faults**: Type (Recurring), Code (maintenance code), How often (text: `N separate times in D days`), From – to (dates), Downtime (hrs) (hours), Latest problem logged (text).

**A9 charts.** The scatter map (`ch-a9-map`): the x axis is titled "Unavailable (% of machine hours) — further right = more downtime" (percent). The platform gives the y axis **no title**; each lane is one machine category, labelled `<category> (<machines in it>)` (the list is in `tickLabels`), top to bottom in rank order. Points are machines, coloured by Rating (Low, Watch, High, Critical), radius 4 plus 0.7 times the square root of BD hours, capped at 15; only High and Critical are labelled with the machine code. The bar chart (`ch-fc`): one bar pair per machine labelled `<machine> · <category>` on the y axis (no title); the x axis is titled "Hours of downtime expected in <month>"; series "Expected routine hrs" (coloured by Band) and "Plan for (80%)".

**Forecast Lab "How each method did"** (one row per method: Current model, Age-adjusted, Recent-weighted, Age + recent)

| Column                              | Unit and meaning                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Accuracy score (lower is better)    | **hours**: the average quantile (pinball) loss at the median, 80 and 90 percent points over every machine and month          |
| Change vs current                   | percent change of that score against the current model (shown as a dash on the current model)                                |
| Above 80% line (about 20% is right) | percent of machine-months where real downtime beat the 80 percent figure; about 20 is what a correct method gives            |
| Above 90% line (about 10% is right) | the same for the 90 percent figure; about 10 is correct                                                                      |
| Plant inside 80% range              | count of months out of the months tested, written `4 of 7`, where the plant total fell inside its 10 to 90 percent range     |
| Top-10 caught                       | percent: hours really lost by the method's ten highest-ranked machines, over hours lost by the ten that really lost the most |
| Better than current                 | count of months (shown as a dash on the current model; format **not confirmed**, read the key)                               |
| Verdict                             | text, with its reason joined on (for example `Baseline` and its sentence)                                                    |

**Forecast Lab "Month detail"**: Month (like `Apr 26`); Actual hrs (hours); one column per method, each `median (low–high)` in hours, where the range is the 80 percent range. **Chart** (`ch-fl`): the y axis is titled "Breakdown hours in the month" (hours); the x axis is the months and has no title; one line for Actual and one per method. The seed scheme for all of it is in `fixtures/answer-key/README.md`.
