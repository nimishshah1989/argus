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

## Packet 67a — the reliability maths and the critical spares

**What changed.** `packages/domain/src/analytics/reliability.ts` reads 48's `failureEvents` as one event a failure
date, clocks it in 48's month-spread `workingHoursFor` hours, and builds the machine block (own fit, category
fallback, "not enough history", `no_basis`) plus one pooled fit per fit-ready category;
`packages/domain/src/analytics/reliability-maths.ts` holds the estimators (Lanczos Γ, the profile-likelihood
golden-section, the product-limit, the Crow-AMSAA MLE); `critical-spares.ts` reads `spareNames`, keys part names
with their digits kept, and ranks uses then downtime, top five, no cost. The registry gains one figure,
`reliability`, on the machine-page screen (owner 67, drill `machine`), the machine page is not yet redrawn (packet
3), and both catalogues gain its label. No new table, column, migration, setting, route or dependency; no runtime
export joins the domain root; no chart and no `analytics.en.ts` key.

**What it proves.** Every reference number in the plan, recomputed from the fixture through 48's own two functions:
HMC-2 `k 0.879204344`, `λ 107.012214493`, mean `114.085658462` on 43 events / 42 intervals / 70 censored hours,
its KM quartiles `18.75 / 51.370968 / 135.483871` and its `β 1.734918780` "worsening"; the same 42 intervals with
the tail dropped `k 0.872804221`, `λ 104.576012925`; TC-17 `k 0.612598299`, `λ 373.227247135` with the 857.5-hour
tail, its hand-checked KM steps `0.8 / 0.6 / 0.4 / 0.2`, and `β 3.390578197` "no clear trend"; the Turning Center
pool `k 0.812341247`, `λ 493.425375085`, `260 / 225 / 35`, KM `101.612903 / 274.354839 / 701.129032` and
`β 1.114657295`; Vertical and Horizontal Machining Center beside it; the coverage `83` own fits / `36` category
fallbacks / `6` "not enough history" over 125 machines and 10 fit-ready categories; the 1,185 events from 1,279
reports (94 same-date repeats on 46 machines); WJ-01's five-row spares list (`total 15`), HMC-2's four parts with
the two `NO DT` zeros in key order, and TC-17's three.

**Evidence.**

- **Red.** `pnpm exec vitest run packages/domain/test/reliability.test.ts packages/domain/test/critical-spares.test.ts
packages/domain/test/analytics-engine.test.ts` → `Cannot find module '../src/analytics/reliability.js'` and
  `.../critical-spares.js`, `2 failed | 1 passed`, 80 tests. With the figure registered and the owner pin untouched,
  `analytics-engine.test.ts` → `2 failed | 81 passed`: `expected 67 to be less than or equal to 48` and the owner set
  missing 67.
- **Green.** The same three files: `Test Files 3 passed (3)`, `Tests 120 passed (120)`. Then
  `pnpm exec vitest run packages/domain/test packages/shared/test` → `53 passed`, `596 passed`;
  `apps/web/src/screens/analytics` → `13 passed`, `125 passed`; `apps/server/test` → `140 passed`, `1621 passed`;
  `pnpm boundaries` → `228 files scanned, 0 problem(s)`; `pnpm typecheck` → clean; `pnpm precheck` → `OK — 14
file(s) checked by prettier, 13 checks passed`.
- **Lines.** `reliability.ts` 295 (296 by `pnpm size`, under the hard 400 and over the soft 250 like the rest of
  the analytics folder), `reliability-maths.ts` 176, `critical-spares.ts` 156; `reliability.test.ts`,
  `critical-spares.test.ts` and `reliability-expected.ts` hold the pinned arithmetic and its comments.

**Deviations from the plan, each with its evidence.**

1. **HMC-2's median is 51.370968, not 52.5.** The plan's own step line has `S = 0.418604651 at 52.5 h`, and the
   survival is already below a half at 51.370968 (`0.511627907` at 50.806452, then `0.488372093`). Under the rule
   the plan states — "the first step time with S ≤ 0.5" — the median is 51.370968, and the test pins those three
   steps so the arithmetic is visible. TC-17's and the category's quartiles match the plan exactly.
2. **The MLE tolerance is 1e-6 on the shape and 2e-8 relative on the scale and mean.** The plan's two independent
   solvers spread by 5.8e-6 on the 322-hour Vertical Machining Center scale (its printed `λ 322.381876700` is the
   score-equation root; the golden-section fit gives `322.381870904`), so a 1e-6 absolute pin cannot hold on the
   scale. The shape stays at 1e-6 and every printed number is inside the relative pin.
3. **The maths lives in `reliability-maths.ts` (176 lines).** One file with the value types would have been 458
   lines against the 400-line cap; `reliability.ts` re-exports `weibullOf`, `kmOf` and `amsaaOf`, so the plan's
   deep-import seam is unchanged.
4. **The spares test is `critical-spares.test.ts`**, the packet's own name for it, not the plan's
   `reliability-spares.test.ts`.
5. **The owner pin is the landed set plus 67.** 50 has not landed (`pm-compliance` is not on main), so the bound is
   67 and the set is `[38, 39, 40, 41, 42, 43, 44, 45, 48, 67]`; nothing else moved.
6. **Plant-wide spares.** 215 reports carry a spare field (236 fields, 205 spellings, 30 "No" and 1 "Yes"); the rule
   leaves a listed part on 181 reports across 67 machines, and 58 production machines list none. The plan's 78 and
   47 count every raw field, the 31 No/Yes included; the test pins both readings.

## Packet 67b — the reliability rows in kpi_snapshot

**What changed.** `apps/server/src/modules/analytics/snapshot.ts` now writes ticket 67's per-subject rows in the
existing run. 48 R15's one exported helper gains one clause — `key === 'reliability'` — so `reliability` is
`standard` beside `shift-kpis.*` and 50's `pm-compliance`, and no second mapping exists. `save` generates one run id
in the writer (`randomUUID()`) and passes it to two statements: the plant rows (every ready figure **except**
`reliability`, each with its own `profileOfKey`) and one `jsonb_to_recordset` insert of the figure's machine and
category rows (`key 'reliability'`, profile from the same helper, `subject_kind` `machine`/`category`, `subject_key`
the machine id or the trimmed category label, `period_start` the value's `windowStart`, `period_end = as_of =
result.asOf`, value = that subject's own block or fit). There is **no** plant row for `reliability`; a same-day
re-run replaces the rows through the table's unique key and a next day starts a series. A category label the schema
cannot hold (over 80 characters) writes no category row while the machines' rows still land (R12). The seeded
`analytics-engine` assertion is now stricter: one plant row per computed figure except `reliability`, every plant row
a plant subject, the reliability rows machine/category only, and all of a batch's rows one `run_id`.
`docs/DATA-MAP.md`'s `kpi_snapshot` row says the same. No new table, column, migration, dependency, job or route; the
tenant transaction and RLS are the existing ones.

**What it proves.** The new store test writes 125 machine rows and 10 category rows beside one plant row (135
reliability rows, 136 in the day), with no `reliability` plant row, one run id, `profile 'standard'` on every subject
row, `period_start '2026-01-01'` and `period_end = as_of '2026-11-11'`, and each value equal to that subject's own
block or fit. A changed block on the same day replaces the same 5 rows (count unchanged, run id moved), the next day
adds its five; an 81-character category label writes no category row. Through `POST /analytics/run` on the seeded
plant, every computed figure except `reliability` keeps one plant row, the reliability rows are exactly the figure's
machine/category subjects (M_USED one `insufficient` block with `ownEvents: 1` and no category row), every row of the
batch shares one run id, a `GET` writes nothing, and tenant B's rows are untouched. The helper returns `standard` for
`shift-kpis.compare`, `pm-compliance` and `reliability`, and `legacy` for `dashboard.total-machines`, so 67 cannot
reclassify 50's row.

**Evidence.**

- **Red.** `pnpm exec vitest run apps/server/test/analytics-reliability-store.test.ts` → `Test Files 1 failed (1)`,
  `Tests 4 failed (4)`: the store wrote `reliability` as a plant row (one row, not 135) and
  `profileOfKey('reliability')` was `legacy`. `apps/server/test/analytics-engine.test.ts` → `1 failed | 18 passed
(19)`: the plant-row list had `reliability` twice (the plant row plus a machine row), so the old assertion could no
  longer hold.
- **Green.** The same store test: `4 passed (4)`. The moved assertion: `19 passed (19)`.
  `pnpm exec vitest run packages/domain/test apps/server/test` → `Test Files 194 passed (194)`,
  `Tests 2237 passed (2237)`. `pnpm boundaries` → `234 files scanned, 0 problem(s)`. `pnpm precheck` →
  `OK — 5 file(s) checked by prettier, 13 checks passed`.
- **Lines.** `snapshot.ts` 119 (was 41), `analytics-reliability-store.test.ts` 287 (new),
  `analytics-engine.test.ts` 633; all under the 400-line file cap, `save` well under 60 lines.

**Deviations from the plan, each with its evidence.**

1. **The owner pin was already moved by the merged 67a.** `packages/domain/test/analytics-engine.test.ts` on this
   branch already has the bound `67` and the set `[38, 39, 40, 41, 42, 43, 44, 45, 48, 67]`; 50b has not merged
   (`pm-compliance` is not in `FIGURES` here), so 67b keeps the landed set untouched rather than inventing 50's
   entry, as the packet allows.
2. **The batch's `run_id` is generated in the writer.** The plant statement used to generate it inline
   (`gen_random_uuid()`); two statements cannot share an inline id, so `save` generates it once with `randomUUID()`
   and passes it to both inserts — the plan's "one `run_id` generated in the writer and passed to both inserts".
3. **The 125 + 10 store test uses an `EngineResult` of that size**, because the server fixture DB has no
   answer-key fleet to run the engine over; the real 125 machines / 10 fit-ready categories over the key are 67a's
   domain proof. The scaled value exercises exactly the store's expansion, counts and values.
4. **The 80-character guard is in the store, not the schema.** `kpi_snapshot.subject_key` already caps at 80; the
   writer drops an over-long category label before the insert (R12) so one renamed category cannot fail the whole
   run's transaction. The test pins the drop and the surviving machine rows.
