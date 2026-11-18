# 48 — shift-calendar KPIs

**What changed for a user:** the plant finally gets MTBF, MTTR and availability on the hours its machines really
work — its own two shift windows (08:00–18:30 and 18:29–05:00, the disputed minute to the later shift) times its
working-days setting, so 21.0 hours a day and 6,300 a machine a year instead of the workbook's flat 20 × 300 — and those
five numbers are shown **beside** the platform's own, never instead of them: on the 11 November workbook MTBF reads
462.0 hours on working hours against 439.9 on the platform's basis, MTTR 2.39 both ways, availability 99.36 % against
99.32 %, BD % 0.51 against 0.54 and PM % 0.13 both ways, with the platform's column computed by the platform's own
rules so its cells are the answer key's cells. The same screen holds the shift split (821 breakdowns and 2,021.10 hours
on shift 1, 456 and 1,031.12 on shift 2, and two rows under a third code the Settings have no window for), the backlog
(the live breakdowns the plant still owes an answer on, aged in working hours and bucketed), and four Paretos with
their heat grids — by machine, cell, code and shift — where 13 machines caused half the lost hours, 3 of the 23 codes
caused half, and shift 1 carried 66.2 % of them. Everything drills to its tickets; a figure with more than 200 tickets
opens the Breakdown log with the count named. The plan is `docs/slices/48-shift-kpis.md`: packet 48a is the
working-hours seam and the comparison, 48b is the shift split and the backlog, 48c is the Pareto and the heat grids.
No migration, no new table (the four rows live in `kpi_snapshot` under `profile = 'standard'`), no new dependency, and
no legacy figure changed — the platform's pages stay byte-for-byte what the answer key holds.
