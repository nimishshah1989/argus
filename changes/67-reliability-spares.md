# 67 — reliability and critical spares

**This fragment is written by the planning pass; each packet appends its own evidence (red/green command tails, the
covering suite, deviations) as it lands.** The plan is `docs/slices/67-reliability-spares.md` (`plan/67`). It was revised after the fresh review: 48's shared
per-row profile helper and 50's owner pin are now consumed, not restated.

**What changes for a user (the whole ticket, in one paragraph).** A machine page gains two blocks. The first fits a
two-parameter Weibull curve to the working hours between that machine's failures — the shape, the scale and the mean
hours between failures — with the time since the last failure counted as a censored interval, a Kaplan-Meier summary
(a quarter / half / three quarters of intervals shorter than) and a Crow-AMSAA trend word ("intervals are getting
longer", "failures are coming faster", or "no clear trend yet") beside the slope. A machine with fewer than five
failures shows its category's fit, labelled, or says "Not enough history" and why. The second block lists the machine's
critical spares: the parts recorded on its breakdown reports, most used first and then by the downtime they caused, the
top five, with the last date each was used. Both blocks open the breakdowns behind them, and the machine page says "Not
available" where the plant has no working-hours basis or the machine is not in production data. The results are kept in
`kpi_snapshot` per machine and per category; there is no new table, no dependency, no job and no new screen.

**The rulings frozen by the plan** (each with its cost-if-wrong in the plan): the fit's fleet is the 125 production
machines, the same set 48 and A3 count (R1); the failure set is 48's `failureEvents` consumed as data, never
re-implemented (R2); a failure event is a failure **date**, so same-date reports are one event, the fit uses the
intervals between events plus one right-censored tail, and the leading interval is left-truncated (R3); the clock is
48's month-spread working hours, so a 31-day month's day is 16.935 h, not 21 (R4); the estimator is maximum likelihood
with the profile-likelihood search in plain TypeScript, no statistics package (R5); a machine needs 5 events and 4
intervals, otherwise its category's pooled fit, otherwise "not enough history", and no active shift window is its own
state (R6); no confidence interval this ticket (R7); Kaplan-Meier is the product-limit over the same observations and
the value carries its three quartile steps, not the curve (R8); Crow-AMSAA is the power-law MLE on the same events with
a two-standard-error word (`no_clear_trend`, printed "no clear trend yet") beside the always-printed slope (R9); critical
spares read the 43c `spareNames` seam, key part names with digits kept (6205 ≠ 6305), keep a bare number or a sentence
as one entry, rank uses then downtime (a `NO DT` report is 0 h), print the top 5 and never read cost (R10); the figure
is one new registry key on the existing `machine-page` screen (R11); the results are per-subject `kpi_snapshot` rows
under `profileOfKey('reliability') = 'standard'`, written by the existing run's store, no plant row and no job; the
profile is 48 R15's one exported `profileOfKey(key)` (already covering 50's `pm-compliance`) with one `reliability`
line added, never a second mapping (R12);
the drills name the machine's own tickets, with the 200-id house fallback (R13); the face is two plain sections with no
chart and the Guide's existing MTTR/MTBF entry gains the figure and one paragraph (R14); no parity row flips (R15).

**What the packets will prove (the plan's acceptance, not yet run).** Packet 1 pins the reference values computed two
ways (a Node profile-likelihood search and a Python score-equation bisection, agreeing to `1e-7`): HMC-2's `k
0.879204344`, `λ 107.012214493`, mean 114.085658462 on 43 events / 42 intervals / 70 censored hours, its KM quartiles
18.75 / 52.5 / 135.483871 h and its `β 1.734918780` "worsening"; TC-17's `k 0.612598299`, `λ 373.227247135` with the
857.5-hour tail and `k 0.749347716` without it, its hand-checked KM steps 0.8 / 0.6 / 0.4 / 0.2 and its `β 3.390578197`
reading "no clear trend"; the Turning Center category's `k 0.812341247`, `λ 493.425375085` from 260 events / 225
intervals / 35 tails, its KM 101.612903 / 274.354839 / 701.129032 h and `β 1.114657295`; the coverage 83 own fits / 36
category fallbacks / 6 "not enough history"; and WJ-01's five-row spares list. Packet 2 proves three subject rows for
two machines and one category (no plant row, one run id, the same-day replace and the next-day series) **and that
`profileOfKey` still returns `standard` for `pm-compliance` and `shift-kpis.compare`, so 67 cannot reclassify 50's
row**. Packet 3 proves the two blocks, the "not enough history" and "no spare" states, the two drills and the operator
refusal.

**No parity:** the Weibull, Kaplan-Meier, Crow-AMSAA and critical-spares blocks are not in the v3 platform; this is the
G46 addition with no v3 ancestor, and each PR states
`No parity: the reliability fits and the critical-spares list are not in the v3 platform (G46); A3's MTBF row is already done.`
`m4a.machine-pages` (ticket 39) stays as it is — a stale ledger row is a milestone-gate cleanup, not an attribution 67
can make.

**Docs and seams this plan amends.** `docs/DATA-MAP.md:105` (the `kpi_snapshot` row gains the `reliability` key and its
machine/category subjects) and 48 R15's `profileOfKey` helper (one line added for `reliability`; `pm-compliance` stays
in it). No architecture, schema, route or reply change. The two existing test files that move are named in the plan
(`packages/domain/test/analytics-engine.test.ts:68-69,87-88` and `apps/server/test/analytics-engine.test.ts:467`), both
stricter and both shared with 48 and 50: 67 is the third writer on the owner pin (48a adds 48, 50b adds 50, 67 adds 67;
the bound reconciles to 38–67) and a rebase keeps 50's `pm-compliance` row and its `standard` profile.

**Follow-ups recorded, not done here.** (1) A confidence band on the shape and the trend (a seeded bootstrap; one value
column, no schema change) when the gate wants uncertainty (R7). (2) The KM curve as a chart, recomputed from the rows
rather than stored (R8). (3) The daily `kpi_snapshot` series and its 90-day purge remain 37d's (R12; the run route is
the only writer today, as for 48's figures). (4) A category id instead of the category label as the stored subject key
(R12). (5) A first-failure interval for a machine purchased inside the window (R3).
