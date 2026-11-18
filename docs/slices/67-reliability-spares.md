# M4b-67 — reliability and critical spares (ticket 67)

Ticket 67, `docs/plan/MILESTONES.md:469-475`:

1. [Engine] Weibull two-parameter fits with censoring per machine (only above a minimum number of failures, otherwise
   per category), with Kaplan-Meier and Crow-AMSAA trend, each proven against reference values computed independently;
   results in `kpi_snapshot`. No new table.
2. [Engine] A critical-spares list per machine from failure history (spares used on breakdown reports, ranked by how
   often and how much downtime they caused), in `kpi_snapshot`.
3. [Browser] The machine page shows the reliability fit (or "not enough history") and its critical spares; both drill
   to the breakdowns behind them.

G46 decided the feature on 13 November: "build all three — lockout checklist (ticket 66), critical-spares list and
Weibull fits (ticket 67); no new table" (`docs/plan/MILESTONES.md:557`). This deliverable is a **plan only**: no
product code and no screen here. The three packets below are three PRs, one writer each, in order 1 → 2 → 3.

**Blocked by 48, whose plan is merged** (`docs/slices/48-shift-kpis.md`, commit `a77aa814`), and 48a is the packet in
flight. This plan therefore names exactly what it consumes from 48a (the box under "Frozen interfaces") rather than
re-deriving the working-hours basis, the failure set, the as-of cut or the dedupe. 67 adds **no** profile field, **no**
setting, **no** migration, **no** table, **no** job and **no** dependency.

## What is true on main today (evidence, not assumption)

- **The failure set and the working-hours basis are 48a's, and only 48a's.** 48's plan fixes the failure set
  (`docs/slices/48-shift-kpis.md:97-104`): `kind === 'stopped'` tickets, non-PM, at or before `asOf`, history and live,
  deduplicated by machine + plant date + shift + downtime; `NO DT` counts with zero hours; an open breakdown is not a
  failure. It fixes the exposure (`:120-124`, R2): the union of the active shift windows × `workDaysPerYear`, spread
  month by month from 1 January and counted per machine from its purchase date, through `periodFraction`
  (`packages/domain/src/analytics/availability.ts:33-50`) and `availableHours` (`:52-61`). Its frozen interface names
  `failureEvents(data)` in a new `standard-kpis.ts` and `workingHoursFor(machine, shifts, workDaysPerYear, window)` in a
  new `working-hours.ts` (`docs/slices/48-shift-kpis.md:360-376`). **67 re-implements none of that.**
- **The fixture is the proof's data.** `fixtures/answer-key/input.json` holds 1,343 history breakdown rows (`:201` is the
  first row and carries the three spare slots `spare1`/`spare2`/`spare3`), 64 of them `PM` and 140 `NO DT`; the 7 live
  rows (`otherBD`) are all Conventional or Utility machines, so the production fleet sees only history. The 125
  production machines are `isProduction`'s CNC-and-not-Robot/excluded set (`packages/domain/src/analytics/machine-facts.ts:4-5`),
  the same fleet A3 and 48 count. The workbook's two shifts are 08:00–18:30 and 18:29–05:00
  (`fixtures/answer-key/input.json` `settings.shiftTimes`), which is 629 + 631 = 1,260 minutes and 6,300 hours a year
  at `workDaysPerYear` 300.
- **The spares seam already exists and is the one to read.** A history row maps its three spare columns into
  `ReportRow.spares` and their costs into `spareCost` (`packages/domain/test/answer-key/fixture.ts:221-231`);
  `ReportRow.spares`/`spareUsed`/`spareCost` are declared at `packages/domain/src/analytics/types.ts:74-98`; the live
  loader splits `breakdown_report.spare_used` on commas into the same list (`apps/server/src/modules/analytics/load.ts:90-101,124`);
  and `spareNames(report)` is the shared reader with the `spareUsed` fallback (`packages/domain/src/analytics/team-focus-spares.ts:22-31`).
  The stored sum is `breakdown_report.spare_cost` (`packages/db/migrations/0014_m4a_schema.sql:122-124`). 43c's part key
  deliberately drops digits (`team-focus-spares.ts:33-42`), which is right for "keep a bearing ready" and wrong for a
  critical-spares list (6205 and 6305 are different parts): R10.
- **The machine page is a per-machine record in one figure.** `machine-page` is one registry figure
  (`packages/domain/src/analytics/registry.ts:90`) computed by `machinePage` (`machine-page.ts:228-245`), whose value is
  `{byMachine: {[id]: record}}`; the screen finds it by screen (`apps/web/src/screens/analytics/MachinePage.tsx:74-78`)
  and reads one record with a total reader (`machine-record.ts:236`). Its breakdown block already exists
  (`machine-summary.tsx:13-62`) and drills with `DrillAction` (`machine-parts.tsx:34-52`). A second figure on the same
  screen is the established pattern for a split tile (`compare` and `compare.spares-cost` are two keys on one screen).
- **`kpi_snapshot` is the one table, and it already has the shape.** `(tenant_id, profile, key, subject_kind,
subject_key, period_start, period_end, as_of, run_id, value)`, with `subject_kind` in `plant | segment | group | cell |
category | machine` and the plant shape `(subject_kind = 'plant') = (subject_key = '')`
  (`packages/db/migrations/0014_m4a_schema.sql:54-74`; D17: `docs/decisions/D17-table-budget.md:17`). The writer is one
  statement for one plant row per ready figure (`apps/server/src/modules/analytics/snapshot.ts:17-40`); its single
  `PROFILE` constant (`:8`) becomes 48's revised R15 (`docs/slices/48-shift-kpis.md:337-343`): **one exported per-row
  helper `profileOfKey(key)`** — `shift-kpis.*` and `pm-compliance` are `standard`, everything else `legacy` — and the
  store writes each row with that row's profile (50's plan states the same helper for `pm-compliance`). That helper is the one home 67 extends,
  never a second mapping (R12). The table's unique key replaces a re-run of the same day and breaks a series by
  `as_of`; `run_id` groups a batch.
- **The budgets are the design constraint.** `page-content.ts` is 397 lines against 400, `use-chart.ts` 394,
  `analytics.en.ts` 248 against the catalogue's 250-line cap (`packages/shared/test/catalogue.test.ts:130-135`), and
  `figure-content.ts` 374. So this ticket adds **no chart kind, no chart id, no `page-content.ts` entry and no
  `analytics.en.ts` key**: the machine block is plain `Section`/`StatCard`/`DataTable` (the house pieces), the new copy
  goes into `analytics-machines.en.ts` (104 lines; its `.gu` is `blank(...)`, so every key exists in the Gujarati
  catalogue the moment it exists in English), and the Guide copy goes into `analytics-guide.en.ts` (187 lines; `.gu` is
  `blank(...)` too).
- **The drill cap has one home.** `MAX_DRILL_IDS = 200` (`packages/shared/src/analytics.ts:205`) and the drill query
  refuses more (`:286`); the house fallback is `FigureDrill`'s "too many, open the Breakdown log"
  (`KeyPage.tsx:51-73`). A machine's own tickets are at most its failure count (HMC-2's 50 on the key), so the block's
  links are normal drill links; the 200 branch is still printed for a pathological machine (R13).
- **The Guide is the answer key's 36 headings, and every figure is named once.** `guide-entries.test.ts:41-62` fails
  on a heading change, a missing figure or a figure named twice; the machine entry names `machine-page`
  (`guide-entries.ts:154-159`) and the MTTR/MTBF entry names `a3-mttr-mtbf` (`:106-111`). 67 adds **no heading** and
  names its one new figure in the MTTR/MTBF entry (R14).
- **Two tests move on purpose, and only two — both shared with 48 and 50.** `packages/domain/test/analytics-engine.test.ts:68-69`
  bounds an owner at 45 and `:87-88` pins the owner set. 48a adds 48, 50b adds 50 and 67 adds 67: **67 is the third
  writer on this pin**, so its packet reconciles the same two lines to the bound `38–67` and the landed set **plus 67**,
  including 50's `pm-compliance` (owner 50) whether 50b has already landed or is rebased in; 67's edit never removes
  48's or 50's entry (`docs/slices/50-pm-calendar.md:481`). `apps/server/test/analytics-engine.test.ts` asserts a stored
  run holds exactly one plant row per computed figure (`:467`); 67's per-subject rows make that assertion say "one
  plant row per computed figure **except `reliability`**, plus its subject rows" (stricter, R12), and 50b edits the same
  store and assertion for its per-row profile — 67 rebases the same lines and keeps 50's `pm-compliance` row and its
  `standard` profile. Nothing else moves.

## The definitions, exactly

### The failure events and the fit inputs

A production machine's **failure event** is one plant date on which 48's failure set has at least one report. Reports on
the same date on the same machine are **one event** (the machine is already down or being repaired; a zero-length
inter-failure time is not a Weibull observation). The event carries every report behind it, so the drill names all of
them. Events are used when `report.date >= windowStart`, where `windowStart = availabilityWindow(asOf, asOf).from`
(1 January of the as-of year, `availability.ts:75-82`); a report before the window is out of the fit and out of the
spares list. On the 11 November key: 1,279 reports, **1,185 events** after coalescing **94 same-date repeats on 46
machines**, on 117 machines; 8 machines have no failure.

For a machine with `E` events at dates `d1 < … < dE`, the fit's observations are:

- **`E - 1` complete inter-failure intervals** `x_i = H(d_i+1) - H(d_i)`, where `H(d)` is the machine's cumulative
  working hours from its exposure start to `d` (`workingHoursFor` over `{from: windowStart, to: d}`). The difference
  counts the working hours **after** `d_i`'s day through `d_i+1`'s day; this is what makes the intervals compose to
  `H(last) - H(first)` and stops a day being counted twice.
- **one right-censored trailing interval** `c = H(asOf) - H(dE)`: the machine ran that long after its last failure
  without one.
- the **leading** interval from the exposure start to `d1` is **not** used: the window start (or the purchase date of a
  machine bought before it) is not a renewal point, and using it would assume the machine was as good as new on 1
  January (R3).

`H` is 48's **month-spread** working hours, not 21 × calendar days: `6,300/(12 × days in the month)` per day, i.e.
16.935 h in a 31-day month, 17.5 in a 30-day month, 18.75 in February. That is the same quantity MTBF divides by, so
the fit's clock and the MTBF denominator agree (R4). The unit is printed as "hours", and the Guide says they are the
MTBF working hours.

### The estimator: two-parameter Weibull by maximum likelihood

The interval distribution is Weibull with shape `k > 0` and scale `λ > 0`:

`f(x) = (k/λ)(x/λ)^(k-1) exp(-(x/λ)^k)`, `S(x) = exp(-(x/λ)^k)`.

For `m = E - 1` complete intervals and one censored `c`, the likelihood is `Π f(x_i) · S(c)`, and its log is

`ℓ(k, λ) = m ln k - m k ln λ + (k - 1) Σ ln x_i - (Σ x_i^k + c^k)/λ^k`.

For a fixed `k`, `∂ℓ/∂λ = 0` gives the closed form `λ^k = (Σ x_i^k + c^k)/m`; substituting it leaves a one-dimensional
profile likelihood in `k` whose score is

`m/k - m·(Σ x_i^k ln x_i + c^k ln c)/(Σ x_i^k + c^k) + Σ ln x_i = 0`.

The implementation is **plain TypeScript, no dependency**: a 1-D golden-section search for `k` on `[1e-6, 50]` to
`1e-12`, then `λ` from the closed form, then `mean = λ·Γ(1 + 1/k)` with a ten-line Lanczos `Γ`. It is deterministic: the
same intervals always give the same `k` (R5).

### Kaplan-Meier

The same observations are the product-limit estimate: sort the `m` complete intervals and the censored tail (one per machine; a category pools one per machine); at each
distinct time with `d` events and `c` censorings, `S ← S·(1 - d/n)` on the risk set `n` before removing `d + c`, the
censored observations removed after the step. With one tail per machine the curve is the empirical survival of the
inter-failure time, and that is the point: it is the non-parametric check on the Weibull. The value carries the curve's
three **quartile steps**: the first step time with `S ≤ 0.75`, `≤ 0.5` and `≤ 0.25` (never an interpolation), printed
as "a quarter / half / three quarters of intervals are shorter than". The full set of steps is what the domain test pins;
the value (and the stored row) carries the three numbers, not a curve no screen draws (R8).

### Crow-AMSAA

The trend is the power-law (Crow-AMSAA/Duane) process fitted to the **same events**, measured from the machine's
exposure start: with `n` events at `t_i = H(d_i)` and `T = H(asOf)`, the failure-truncated MLE is

`β̂ = n / Σ ln(T/t_i)`, `λ̂ = n/T^β̂`.

`β < 1` means intervals are getting longer (improving), `β > 1` that failures are coming faster (worsening). The word is
a two-standard-error Wald test: `se = β̂/√n`, and the label is `improving`/`worsening` only when `|β̂ - 1| > 2·se`;
otherwise **`no_clear_trend`** (the page prints "no clear trend yet"; the enum name is the stored value and the page
word is pinned in the e2e). The slope is always printed beside the word, so a small sample's steep slope is not
hidden, it is labelled as not yet separable from noise (R9). A category fit pools machines: `β̂ = N / Σ_i Σ_j ln(T_i/t_ij)`
with each machine's own `T_i` and `t_ij`.

### The minimum and the fallback

A **basis** is fit-ready when it has **at least 5 failure events and at least 4 complete intervals**. A machine always
has `E - 1` complete intervals, so 5 events is the machine's threshold; a category pools machines, so both conditions are
checked. Five events is the smallest sample whose Weibull shape is not dominated by one interval, and it is the
threshold the plan's coverage is counted at (R6).

- A machine with 5 or more events gets its **own** fit.
- Otherwise, if its category's pooled basis is fit-ready, the machine shows its **category's** fit, labelled
  "Category fit: <name>", with the machine's own event count printed beside it.
- Otherwise it shows **"Not enough history"**, with its event count, its category's event count and the minimum.
- A machine with no category at all cannot fall back: its own events or "not enough history".
- A machine with **no failure at all** in a fit-ready category still shows the category's fit (labelled) and an empty
  spares list: it is honest about having no history of its own and useful as a category reference.
- On a **category** basis the block's `events`, `completeIntervals`, `censoredHours` and `trend.n` are the pooled
  numbers, and the page says "the category's fit" beside them; `ownEvents` is the one number that is the machine's own.

On the key: **83 own fits, 36 category fallbacks, 6 "not enough history"** (CAM-01, GRD-1, GRD-5, GRD-7, GRD-8, GRD-9 —
the four categories with fewer than 5 events: CAM Profile Machine, Cylindrical rotary Grinding, Centerless Grinding
Machine and CNC Internal Grinding). **10 of the 14 categories** are fit-ready.

A plant with **no active shift window** has no working-hours basis: every block is `no_basis` ("No shift windows in
Settings, so there is no working-hours basis to fit"), not "not enough history" (R6). A plant with no production machine
at all returns `{value: null, drillIds: []}` like A3 (checked before the shift basis).

### The critical spares

Read `spareNames(report)` for every failure report of the machine in the window (the 48 set, so live closes included and
`NO DT` included), one row per distinct part:

- **The part key** is the name lowercased, every character that is not a letter or digit turned into a space, split,
  the 43c stop words dropped (`no any nil na none nos pcs pc mm kg x c a the of and set new old`, plus **`yes`** because
  the fixture records "Yes" once and "No" thirty times as answers to the column, not as parts), and the tokens sorted
  and joined. Unlike 43c's key it **keeps digits**, so 6205 and 6305 stay different parts (R10).
- **A bare number or a whole sentence is one part.** The fixture's `2.04222431011039e+23` (a mangled part number) and the
  one cell that is six quantities in a sentence are each **one** part: the key is the normalised text, the label is that
  text with a trailing quantity parenthesis removed, and nothing is split on digits, spaces, commas or punctuation
  inside a cell. The top-5 limit is unchanged (one cell is one use). The first is data damage the code cannot undo; the
  second is a note a person wrote — both stay one entry rather than being invented into parts.
- **Uses** = the number of distinct failure reports that named the part (a part named twice on one report is one use).
- **Downtime hours** = the sum over those reports of `downtimeMin / 60`, and **0 for a `NO DT` report**: the plant
  attended it outside production hours, exactly as 48's MTTR counts it (R10).
- **The label** is the most common cleaned spelling (a trailing parenthetical quantity removed), ties broken by the
  earliest report's spelling.
- **The ranking** is `uses` descending, then `downtimeHours` descending, then the key ascending. It uses both things the
  ticket names, invents no weight, and is deterministic. The page prints the **top 5** (the same limit 43's spares lane
  uses, `team-focus-spares.ts:14`) and "top 5 of N parts" when there are more.
- **Cost is not read.** `spareCost` is money (heads/admin only, DOMAIN §3) and the machine page is visible to
  supervisors; the ticket ranks by frequency and downtime, not rupees (R10).

On the key: **215 of the 1,279 reports name at least one part** (236 part fields, 205 distinct raw spellings; 30 "No"
and 1 "Yes" dropped), across **78 production machines**; 47 machines have none and say so.

## The reference numbers (the proof)

Every number below is arithmetic over `fixtures/answer-key/input.json` at `asOf = 2026-11-11`, `windowStart =
2026-01-01`, `workDaysPerYear = 300`, the two shift windows above. They were computed by two throwaway implementations
that share no code: a Node script maximising the profile likelihood with a golden-section search, and an independent
Python script solving the score equation by bisection (and the KM and AMSAA from their definitions). The two agree to
better than `1e-7` on every `k`, `λ` and `β`; the packet's test pins them to `1e-6` (and the KM steps to `1e-9`), so a
recomputation by hand or by another library has room but no slack.

### The basis check

The same exposure as 48: one machine purchased before 1 January has `H(asOf) = 6,300 × periodFraction(2026-01-01,
2026-11-11) = 6,300 × (10/12 + 11/360) = 5,442.50 h`; the 125 production machines sum to **5,93,977.10 h**, 48's own
plant total (`docs/slices/48-shift-kpis.md:124`). A day's share is `6,300/(12 × 31) = 16.935483871` in a 31-day month,
`17.5` in a 30-day month, `18.75` in February.

### HMC-2 — a machine with enough failures (own fit)

HMC-2 (`fixtures/answer-key/input.json:81`, Horizontal Machining Center, bought 2006-10-01) has **50 reports → 43
events** (7 same-date repeats), 42 complete intervals and `c = 70.0` (4 November days after its last failure on
2026-11-07). Its aggregates: `m = 42`, `Σ ln x_i = 171.405070754`, and at the solution `S = Σ x_i^k + c^k =
2,555.853225` and `S1 = Σ x_i^k ln x_i + c^k ln c = 13,337.630929`.

Solving the score equation gives **`k = 0.879204344`**, `λ = 107.012214493` h, **mean = 114.085658462 h** (profile
log-likelihood −240.667796). With the censored tail dropped the same code gives `k = 0.872804221`, `λ = 104.576012925`:
the 70-hour tail moves the shape by 0.0064 and the scale by 2.44 h, which is the censoring being used, not decoration.

Kaplan-Meier (risk set 43 at the first step): `S = 0.813953488` at **16.935484 h** (8 tied intervals), `S = 0.418604651`
at **52.5 h**, `S = 0.222383721` at **135.483871 h**, and `S = 0` at **677.419355 h**. Quartiles: **18.75 h / 52.5 h /
135.483871 h**.

Crow-AMSAA: `n = 43`, `T = 5,442.50`, `Σ ln(T/t_i) = 24.785022`, **`β = 1.734918780`**, `se = 0.264572634`,
`|β - 1| = 0.734918780 > 2·se = 0.529145267` → **"failures are coming faster"**.

Critical spares (4 parts): Rectifier O/P 440V AC and I/P 190V DC — 1 use, 4.0 h, last 2026-09-16; Rectifier
440 O/P and I/P 190 VDC — 1 use, 3.0 h, last 2026-07-18; Break Rectifier 2 amp — 1 use, **0.0 h** (a `NO DT` report),
last 2026-10-03; Brake hub — 1 use, **0.0 h** (`NO DT`, same report), last 2026-10-03. The two zero-hour parts tie and
are ordered by key (`amp break rectifier` < `brake hub`) — the `NO DT` rule and the tie-break in one list.

### TC-17 — the censored case and a hand-checked Kaplan-Meier

TC-17 (`:16`, Turning Center, bought 2015-10-01) is the smallest fit the rule allows: **5 events** on 2026-08-04,
2026-08-06, 2026-08-07, 2026-09-14 and 2026-09-22 (the rows are `:995`, `:1001`, `:967`, `:1183`, `:1216`; 90, 136, 724,
105, 60 recorded minutes). Its cumulative times are 3,742.741935, 3,776.612903, 3,793.548387, 4,445.000000 and
4,585.000000 h; the intervals are **33.870968, 16.935484, 651.451613 and 140.000000 h**, and the tail is
**`c = 857.5` h** (2026-09-22 to 2026-11-11) — 15.8 % of the machine's 5,442.5 h exposure.

The MLE is **`k = 0.612598299`**, `λ = 373.227247135` h, **mean = 546.847940621 h**; with the tail dropped it is
`k = 0.749347716`, `λ = 174.393231985` h (mean 207.788497). The tail changes the scale by **114 %**: a fit that ignored
it would halve the expected interval of the plant's worst-observed small machine.

Kaplan-Meier, hand-checkable: the four times sorted are 16.935484, 33.870968, 140 and 651.451613 h, each one event, and
the risk set is 5, 4, 3, 2 (the censored 857.5 h is after every event), so `S = (4/5)(3/4)(2/3)(1/2)` step by step:
**0.8, 0.6, 0.4, 0.2** at 16.935484, 33.870968, 140 and 651.451613 h. The quartile steps are **33.870968 / 140 /
651.451613 h**.

Crow-AMSAA: `n = 5`, `Σ ln(T/t_i) = 1.474675`, **`β = 3.390578197`**, `se = 1.516312666`;
`|β - 1| = 2.390578 < 2·se = 3.032625` → **"no clear trend yet"**. The slope is 3.39 and the word is "not yet": five
failures cannot separate it from noise, and the page prints both (R9).

Spares (3 parts): 1 Amp glass fuse (1 use, 2.2667 h), Fanuc battery 6 V (1, 1.75 h), Glass tube fuse 2 Amp (1, 1.0 h).

### The category fit — Turning Center

The category pools **38 machines, 260 events, 225 complete intervals and 35 censored tails** (31 machines have two or
more events; the 7 with none or one contribute only their tail or nothing). The pooled MLE is **`k = 0.812341247`**,
`λ = 493.425375085` h, mean **553.062708887 h** (`Σ ln x = 1,195.762945`); without the tails `k = 0.817229`,
`λ = 391.654111`. Its pooled KM steps are **101.612903 / 274.354839 / 701.129032 h**; its pooled Crow-AMSAA is
`N = 260`, `Σ ln(T_i/t_ij) = 233.255550`, **`β = 1.114657295`**, `se = 0.069128111`,
`|β - 1| = 0.114657 < 2·se = 0.138256` → "no clear trend yet". The other two large categories: Vertical Machining
Center `k = 0.798139904`, `λ = 322.381876700`, mean 365.870264118, KM 54.435484 / 169.354839 / 477.580645,
`β = 1.134347186` → worsening; Horizontal Machining Center `k = 0.897943016`, `λ = 140.975753213`, mean 148.518575402,
KM 33.870968 / 70 / 203.225806, `β = 2.077150037` → worsening.

TC-24 (4 events) is a category fallback: its block is `basis: 'category'`, `category: 'Turning Center'`,
`ownEvents: 4`, and the numbers above; its drill is its own four reports. VC-57 (bought 2026-10-31, no failure) is the
same with `ownEvents: 0` and no spares.

### The spares reference

WJ-01 (`:108`, WaterJet CNC, 23 failure reports) records 15 parts; the top 5 under the rule are:

| #   | Part (label)          | Uses | Downtime h | Last used  |
| --- | --------------------- | ---- | ---------- | ---------- |
| 1   | Seal 20422243         | 2    | 13.2833    | 2026-10-13 |
| 2   | 10110393 and 20422243 | 2    | 6.0833     | 2026-07-16 |
| 3   | 80086622 Seal         | 1    | 9.0000     | 2026-10-13 |
| 4   | Seal 50056849         | 1    | 4.2833     | 2026-08-01 |
| 5   | 1" transperant pipe   | 1    | 4.2500     | 2026-05-01 |

The first two rows are the exact-uses-first rule (`2` beats `1`), and within `2` the 13.28 h beats 6.08 h; among the
one-use rows 9.0 > 4.2833 > 4.25. The 2026-11-03 "Yes" row (`:1551`) is dropped, the 30 "No" rows (`:1022` is one) with
it. Across the plant: 215 reports with a part, 78 machines with at least one, 47 with none.

## Rulings (each settled here; none left open)

**R1 — the fit's fleet is the production fleet.** Only `isProduction` machines (CNC, not Robot, not excluded — the same
set 48 and A3 count, `machine-facts.ts:4-5`) have a `reliability` entry; every other machine's page shows the block as
"Not available", exactly as its breakdown block already does (`machine-page.ts:134`). Cost if wrong: a Conventional or
Utility machine's page cannot show a fit built on the working-hours basis (its breakdown block is already absent); a
follow-up that wants those machines needs a working-hours basis for them and a second scope decision, not a number.

**R2 — the failure set is 48's, consumed and not re-implemented.** 67 calls `failureEvents(data)` and filters it by
machine and `date >= windowStart`; it does not re-read `kind`, `status`, PM, `NO DT`, the as-of cut or the dedupe. On the
key the set is 1,279 reports; the 7 live rows are non-CNC and outside the fleet, and a live close on a CNC machine would
enter exactly as it enters 48's MTBF. Cost if wrong: if 48a's `failureEvents` returns a narrower shape (reports without
their tickets) the drill loses the ticket ids and 67 must either ask 48a for the sourced pair or duplicate 48's
predicate — hence the frozen signature below; the numbers themselves do not move.

**R3 — an event is a failure date, and the fit uses the intervals between events plus one censored tail.** `E - 1`
complete intervals and the trailing `c`; same-date reports are one event (94 reports on 46 machines on the key); the
leading interval from the window start to the first failure is not used. Cost if wrong: two breakdowns on one day are
one Weibull observation but both are still drilled and both still count in MTBF (48); a machine bought **inside** the
window loses a genuinely complete first-failure time (no such machine has a failure on the key) — a later ruling can add
it with one branch when the purchase date is after the window start.

**R4 — the fit's clock is 48's month-spread working hours.** `H(d) = workingHoursFor(machine, shifts, workDaysPerYear,
{from: windowStart, to: d})`, so a day is 16.935 h in a 31-day month, 17.5 in a 30-day month, 18.75 in February, and
the intervals compose. The unit is the MTBF denominator's, not 21 × calendar days. Cost if wrong: intervals in long
months are compressed relative to actual shift time; the shape and scale are in "standard working hours" and every
number moves if the definition moves, but MTBF and the fit stay comparable, which is the point. A second "actual shift
hours" clock would be a second family, not a fix.

**R5 — Weibull by maximum likelihood, solved in plain TypeScript.** The profile-likelihood golden-section on `k` with
`λ` in closed form, the ten-line Lanczos `Γ`, the KM product-limit and the Crow-AMSAA MLE; no statistics dependency, no
new package, no ADR. Cost if wrong: the MLE is sensitive on 4–5 intervals (a small sample can give a shape far from 1);
the event count is printed and the category fallback is the alternative. A closed-form/regression estimator would be a
different, biased answer under censoring.

**R6 — five events and four intervals, then the category, then "not enough history"; no shifts is its own state.** The
stopping rule is a numbered decision, not a default. Cost if wrong: at 5, 83 machines have their own fit, 36 borrow
their category and 6 have neither; at 3 those become 98 / 24 / 3 with shapes dominated by one interval; at 8, 61 / 56 / 8. The
category is a reference, not a machine prediction; the block labels it. A plant with no active window gets `no_basis`,
never a fabricated denominator.

**R7 — no confidence interval in this ticket.** The page prints the shape, the scale and the mean, and the event count;
it does not print a band. Cost if wrong: a reader cannot tell `k = 0.95` from `k = 1.00` with 5 events; a later ticket
adds a seeded bootstrap (one column in the value, no schema change). A confidence interval on this sample would be a
number the plan cannot prove against an independent reference, which is the ticket's bar.

**R8 — Kaplan-Meier is the product-limit over the same observations; the value carries its three quartile steps, not
the curve.** The full steps are pinned by the domain test and recomputed by the figure; the stored row carries the
quartiles (18.75 / 52.5 / 135.483871 for HMC-2). Cost if wrong: a chart of the curve needs a recomputation from the
rows (one function call) and the snapshot has the summary only; drawing it here would need `use-chart.ts` (394/400),
which this ticket does not touch.

**R9 — Crow-AMSAA is the power-law MLE on the same events, pooled across machines for a category; the word is a
two-standard-error Wald test and the slope is always printed.** Cost if wrong: TC-17's `β = 3.39` with 5 events reads
`no_clear_trend` (the page's "no clear trend yet"), which is statistically honest but may read as a contradiction; the slope is beside it and the
Guide says why. A fixed ±0.10 band would label noise as a trend; a likelihood-ratio test would be more code for the
same answer at this sample size.

**R10 — the critical spares are per machine, read through `spareNames`, keyed with digits kept, ranked by uses then
downtime, top 5, no cost.** Cost if wrong: 43c's digit-dropping key merges 6205 and 6305, which is wrong here; a plant
that wants rupee ranking needs a money-gated column (heads only) and a second order, and a part named twice on one
report is one use rather than two (the fixture has no such report, so the rule is pinned by a purpose-built test).
"yes"/"no" are answers, not parts; a bare number or a sentence stays exactly one entry (no invented split), and the
spares test pins that beside 6205/6305.

**R11 — one new figure key, `reliability`, on the existing `machine-page` screen.** `{key: 'reliability', screen:
'machine-page', owner: 67, drill: 'machine'}` in `registry.ts`; the machine page finds it by key (not by screen) and the
group page already filters `machine-page` out of the Machines tabs (`MachinesPage.tsx:22`), so the new key never becomes
a tile. Cost if wrong: two figures on one screen is the money-tile pattern, not a new screen; a reviewer who wants a
separate screen gets a nav entry and a group change, not a new figure.

**R12 — storage is per-subject rows in `kpi_snapshot`, written by the existing run; no plant row for `reliability`, no
job; the profile is 48 R15's one helper, not a second rule.** Key `reliability`, `profile = profileOfKey('reliability')`
= `standard`, `subject_kind` `machine` (one row per production machine, 125 on the key) or `category` (one per fit-ready
category, 10 on the key), `subject_key` = machine id or the trimmed category label, `period_start = windowStart`,
`period_end = as_of = asOf`, one `run_id` per batch, value = the machine block or the category fit. The writer is
`snapshotStore.save`, so `POST /analytics/run` writes it in the same transaction as the plant rows; `GET` never writes;
a re-run of the same day replaces the rows through the unique key. **The profile is 48 R15's exported
`profileOfKey(key)` — the one home, already covering `pm-compliance` for 50 — and 67's one-line change adds
`|| key === 'reliability'` to it.** 67 never restates a mapping that could classify 50's rows as `legacy`: if 67 lands
first, `profileOfKey` still returns `standard` for `pm-compliance`, and 67's store test asserts it (packet 2). The
store's plant insert is 48/50's per-row `{profile, key, value}` insert; 67 adds the subject insert beside it. No
`engine.run` job, no daily series (52 R14 leaves `kpi_snapshot` out; 37d's series/purge stays the follow-up). Cost if
wrong: the series exists only when a head runs the engine (the page is live and never stale); a category renamed on the
settings screen starts a new subject series (the label is the key, there is no category id in the engine); a category
label longer than the schema's 80 characters writes no category row (the machines' own rows still carry the fit); one
`snapshotStore` branch knows one figure's value shape.

**R13 — the drills are the machine's own rows.** The fit's link names the tickets of the machine's failure events (all
reports behind them, same-date repeats included); the spares' link names the reports behind the listed parts. A category
fallback does not link the category's hundreds of tickets: the drill stays the machine's own evidence. Above
`MAX_DRILL_IDS = 200` the link opens the Breakdown log with the count, the house rule (`KeyPage.tsx:51-73`). The figure's
own drill is `machine` over the 125 production machines. Cost if wrong: a reader cannot open the other machines behind a
category fit from this page; a follow-up adds a category link, not a new figure.

**R14 — the face is two plain sections on the machine page, no chart, no new heading, no `analytics.en.ts` key.** The
reliability section has `StatCard`s for shape, scale and mean, a basis line, a sample line, the KM quartiles and the
trend; the critical-spares section is a `DataTable` (Part / Uses / Downtime h / Last used) with the empty and "top 5 of
N" states. Copy goes to `analytics-machines.en.ts` (gu is `blank(...)`); the Guide names the figure in its existing
"MTTR and MTBF" entry and gains one `body3` there, with the 36 headings untouched (`guide-entries.test.ts:41-62`). Cost
if wrong: a reader wanting a KM curve or a chart sees three numbers and can open the fit's breakdowns; the Guide entry
is long by one paragraph, and a reader looking under "Machine lists" finds the block named under MTTR/MTBF instead.

**R15 — no parity row flips and no new row is added.** The v3 platform has no Weibull, Kaplan-Meier, Crow-AMSAA or
critical-spares screen; this is a G46 addition with no v3 ancestor. Each PR's description carries
`No parity: the reliability fits and the critical-spares list are not in the v3 platform (G46); A3's MTBF row is already done.`
`m4a.machine-pages` (ticket 39) stays as it is — a stale ledger row is a gate cleanup, not an attribution 67 can make.
Cost if wrong: the ledger does not count the block; the M4b gate can add one row to `PARITY.md` and regenerate, which is
the gate's call, not a builder's.

## Frozen interfaces

### What 67 consumes from 48a (the exact names)

```ts
// 48a, packages/domain/src/analytics/standard-kpis.ts — the failure set, already kind/PM/as-of/deduped (48 R4)
export function failureEvents(data: EngineData): readonly SourcedReport[];

// 48a, packages/domain/src/analytics/working-hours.ts — one machine's hours in a window, from its purchase date
export function workingHoursFor(
  machine: MachineRow,
  shifts: readonly ShiftRow[],
  workDaysPerYear: number,
  window: DateWindow,
): number;
export function workingMinutesPerDay(shifts: readonly ShiftRow[]): { total: number };
// 48a, packages/domain/src/analytics/types.ts
export interface ShiftRow {
  code: string;
  name: string;
  startMinute: number;
  endMinute: number;
  crossesMidnight: boolean;
  active: boolean;
}
// EngineData.shifts?: readonly ShiftRow[]
```

67 calls `failureEvents(data)` once and filters it by `isProduction` and `report.date >= windowStart`; it reads
`data.shifts ?? []` and `profile.workDaysPerYear` from the engine's `ComputeInput`. It needs `SourcedReport` (the
`report` and the `ticket`), because the drill names the ticket id; 48a's own predicate reads `ticket.kind`, so the
sourced pair is the shape it has. If 48a lands `failureEvents` returning bare `ReportRow[]`, the drill falls back to
`report.ticketId` (the loader links every failure) and the numbers do not move — but this plan asks for the sourced pair.

### The figure's value (frozen)

```ts
export type TrendLabel = 'improving' | 'worsening' | 'no_clear_trend';
export interface Quartiles {
  q25: number;
  median: number;
  q75: number;
}
export interface Trend {
  beta: number;
  n: number;
  label: TrendLabel;
}
export type FitBlock =
  | {
      status: 'fitted';
      basis: 'machine' | 'category';
      category: string | null;
      ownEvents: number;
      shape: number; // Weibull k
      scale: number; // Weibull lambda, standard working hours
      meanHours: number; // lambda * Gamma(1 + 1/k)
      events: number; // the basis's failure events
      completeIntervals: number;
      censoredHours: number; // the tail at asOf (a category's is the sum of its machines' tails)
      quartiles: Quartiles; // KM first step at or below .75/.5/.25
      trend: Trend;
    }
  | {
      status: 'insufficient';
      ownEvents: number;
      category: string | null;
      categoryEvents: number;
      minimum: number; // 5
    }
  | { status: 'no_basis' };
export interface SpareRow {
  name: string;
  uses: number;
  downtimeHours: number;
  lastOn: string | null;
}
export interface MachineReliability {
  fit: FitBlock;
  spares: { rows: SpareRow[]; total: number };
  drill: { fit: string[]; spares: string[] }; // ticket ids
}
export interface CategoryFit {
  shape: number;
  scale: number;
  meanHours: number;
  events: number;
  completeIntervals: number;
  /** The category's machines with at least one event (their tails are in the likelihood). */
  machines: number;
  censoredHours: number;
  quartiles: Quartiles;
  trend: Trend;
}
export interface ReliabilityValue {
  asOf: string;
  windowStart: string;
  minimumEvents: number; // 5
  machines: Record<string, MachineReliability>;
  categories: Record<string, CategoryFit>;
}
```

`reliability.ts` exports `reliabilityFigure: Computer` and the module-private `kmOf`, `weibullOf`, `amsaaOf` that the
domain test deep-imports (the house rule, `docs/slices/48-shift-kpis.md:551-555`). **No runtime name joins
`packages/domain/src/index.ts`**, so the D2 pin (`registry.test.ts`) does not move; the types above are exported
type-only from `analytics/index.ts` for the server's store and the face's readers (erased at runtime).

### The stored rows (frozen for 53/54)

| column         | machine row                  | category row               |
| -------------- | ---------------------------- | -------------------------- |
| `profile`      | `standard`                   | `standard`                 |
| `key`          | `reliability`                | `reliability`              |
| `subject_kind` | `machine`                    | `category`                 |
| `subject_key`  | the machine id (uuid)        | the trimmed category label |
| `period_start` | `windowStart` (`2026-01-01`) | `windowStart`              |
| `period_end`   | `as_of`                      | `as_of`                    |
| `as_of`        | the run's date               | the run's date             |
| `value`        | one `MachineReliability`     | one `CategoryFit`          |

A `no_basis` or `insufficient` machine still has a row (its state is a result). The store writes the machine rows and
the category rows in one statement; there is **no** plant row for `reliability` (the plant row would duplicate 125
blocks). A re-run of the same day replaces the rows via the table's unique key; a later `as_of` starts a series.

## Packet 1 — the maths (engine + its figure, one PR)

**Files (12).** `packages/domain/src/analytics/reliability.ts` (new: the events and cumulative hours, the Weibull MLE and
`Γ`, the KM, the Crow-AMSAA, the category pool, the block builder, `reliabilityFigure`), `packages/domain/src/analytics/critical-spares.ts`
(new: the part key, the ranking, the top 5, the drills), `packages/domain/src/analytics/computers.ts` (one map entry
`reliability`), `packages/domain/src/analytics/registry.ts` (one figure), `packages/domain/src/analytics/index.ts` (the
type-only exports), `packages/domain/test/reliability.test.ts` (new), `packages/domain/test/reliability-expected.ts`
(new: the pinned numbers with the arithmetic in comments), `packages/domain/test/reliability-spares.test.ts` (new),
`packages/domain/test/analytics-engine.test.ts` (the owner bound and set), `apps/web/src/screens/analytics/groups.ts` +
`packages/shared/src/i18n/analytics-machines.en.ts` + `apps/web/src/screens/analytics/guide-entries.ts` (the figure's
label in `FIGURE_LABELS` and both catalogues, and the figure named once in the MTTR/MTBF entry — without them
`groups.test.ts` and `guide-entries.test.ts` fail on the main branch, so they belong to the packet that registers the
figure).

**Red:** `pnpm exec vitest run packages/domain/test/reliability.test.ts packages/domain/test/reliability-spares.test.ts
packages/domain/test/analytics-engine.test.ts` — the new modules are absent and the owner set has no 67. **The owner pin
is shared with 48a and 50b** (this is the third writer): after the rebase the bound is `38–67` and the literal is the
landed set plus 67, containing 48's and 50's entries; the red is the same two lines, never a copy that could drop
them. **Green:** the same, then `pnpm exec vitest run packages/domain/test packages/shared/test` (the frozen keys, the
registry and the catalogue), `pnpm exec vitest run apps/web/src/screens/analytics` (the label, the Guide naming),
`pnpm boundaries`, `pnpm size`.

**Acceptance — Given/When/Then.**

- **G** the answer-key engine data (`ENGINE_DATA`, the two shifts, `DEFAULT_PROFILE`, `asOf` 2026-11-11), **W**
  `reliabilityFigure`, **T** `value.machines` has 125 entries: 83 `fit.status: 'fitted'` with `basis: 'machine'`, 36
  `fitted` with `basis: 'category'`, 6 `insufficient`; `value.categories` has the 10 fit-ready categories; the same
  125 machines' `workingHoursFor(…, asOf)` sum to `5,93,977.10` (the basis check, through 48's function, not a field).
- **G** the same, **W** HMC-2's block, **T** `shape 0.879204344`, `scale 107.012214493`, `meanHours 114.085658462`,
  `events 43`, `completeIntervals 42`, `censoredHours 70`, `quartiles {18.75, 52.5, 135.483871}`, `trend {beta
1.734918780, n 43, label 'worsening'}`, four spares (4.0, 3.0, 0.0, 0.0 h), `drill.fit` the 50 report tickets and
  `drill.spares` the reports behind the four parts; with the tail dropped the same intervals give `k 0.872804221`,
  `λ 104.576012925` (the test asserts the censored term is used).
- **G** TC-17's five events, **W** its block, **T** `k 0.612598299`, `λ 373.227247135`, `censoredHours 857.5`,
  `quartiles {33.870968, 140, 651.451613}`, `trend {3.390578197, 5, 'no_clear_trend'}`; **W** `kmOf` directly, **T** the four
  steps `(16.935484, 0.8), (33.870968, 0.6), (140, 0.4), (651.451613, 0.2)` — the hand check of the product-limit.
- **G** the same, **W** the Turning Center category, **T** `k 0.812341247`, `λ 493.425375085`, `events 260`,
  `completeIntervals 225`, `machines 35`, `quartiles {101.612903, 274.354839, 701.129032}`, `trend {1.114657295, 260,
'no_clear_trend'}`; **W** TC-24, **T** it reads that block with `basis: 'category'`, `ownEvents 4`, and its own four tickets in
  `drill.fit`; **W** VC-57, **T** the same with `ownEvents 0`, an empty spares list and an empty spares drill.
- **G** the six machines of the four small categories, **W** their blocks, **T** `status: 'insufficient'` with
  `ownEvents` 0/2/0/2/3/1, the category's event count and `minimum 5`; **G** a plant with no shift rows, **W** the
  figure, **T** every block `status: 'no_basis'` and the value not null.
- **G** WJ-01's 23 reports, **W** its spares, **T** the five rows of the table above in order, `total 15`; **G** HMC-2,
  **T** the two `NO DT` parts at 0.0 h and the key tie-break; **G** a report that names the same part in `spare1` and
  `spare2`, **T** one use and one downtime contribution; **G** the 30 "No" and the one "Yes", **T** none is a part;
  **G** "Bearing 6205" and "Bearing 6305" on two reports, **T** two parts, not one; **G** a spare cell
  `2.04222431011039e+23` and a spare cell that is a sentence, **W** the list, **T** one part each, the sentence's label
  kept whole, no invented split and the top-5 cap unchanged.
- **G** a 2025 report on a production machine added to the data and a live close on one, **W** the figure, **T** the
  2025 report moves neither the fit nor the spares, and the live close enters as an event (48's set, read not
  re-implemented).
- **G** the data with no production machine, **W** the figure, **T** `{value: null, drillIds: []}`.
- **G** the owner pin at the packet's head, **W** `packages/domain/test/analytics-engine.test.ts`, **T** the bound is
  `38–67` and the set is the landed owners **plus 48, 50 and 67** (`[38,39,40,41,42,43,44,45,48,50,67]` once all three
  land), so 50's `pm-compliance` is in it and 67's edit has not dropped it.

**Covering suite:** the three test files, `pnpm exec vitest run packages/domain/test packages/shared/test`, and
`pnpm exec vitest run apps/web/src/screens/analytics` (the registry/label/Guide coupling).

## Packet 2 — the storage (one PR)

**Files (5).** `apps/server/src/modules/analytics/snapshot.ts` (one line in 48 R15's `profileOfKey` for `reliability`;
one `run_id` generated in the writer and passed to both inserts; the plant insert excludes `reliability`; the
per-subject insert expands `value.machines` and `value.categories`), `apps/server/test/analytics-reliability-store.test.ts` (new), `apps/server/test/analytics-engine.test.ts`
(the moved plant-keys assertion, `:467`), `docs/DATA-MAP.md` (the `kpi_snapshot` row gains the reliability keys and
subjects, `:105`), the fragment.

**The write.** `save` reads `result.figures.find(f => f.key === 'reliability' && f.status === 'ready')`; the plant
insert runs for every other ready figure with its own `profileOfKey(key)` (48 R15's per-row `{profile, key, value}`
store, the form 50b also uses); one `jsonb_to_recordset` insert writes the machine rows and the category rows under key
`reliability`, `profile 'standard'`, `period_start = value.windowStart`, `period_end/as_of = result.asOf`, `run_id` =
the batch's. **The profile change is one line in 48 R15's one exported helper** —
`profileOfKey(key)` gains `|| key === 'reliability'` beside its existing `shift-kpis.*` and `pm-compliance` — so 67
cannot restate a rule that drops `pm-compliance`, and 50's rows stay `standard` whichever of 50b/67 lands first.

**Red:** `pnpm exec vitest run apps/server/test/analytics-reliability-store.test.ts` — the new assertions fail because the
store writes a plant row and no subject rows. **Green:** the same, then
`pnpm exec vitest run apps/server/test/analytics-engine.test.ts` (the moved assertion),
`pnpm exec vitest run apps/server/test packages/db/test` and `pnpm boundaries`. **The store and its assertion are shared
with 48a (the per-row profile) and 50b (`pm-compliance`):** after a rebase the same lines carry 50's row under `standard`
and 67's subject rows; the test proves `profileOfKey('pm-compliance')` and `profileOfKey('shift-kpis.compare')` are still
`standard` beside `profileOfKey('reliability')`, so 67 landing first cannot turn 50's row `legacy`.

**Acceptance — Given/When/Then.**

- **G** an `EngineResult` with one plant figure and a `reliability` value holding two machines and one category, **W**
  `snapshotStore.save`, **T** one plant row for the plant figure and three subject rows (`subject_kind` machine ×2,
  category ×1), `key 'reliability'`, `profile 'standard'`, `period_start '2026-01-01'`, `period_end = as_of
'2026-11-11'`, one `run_id` across all four rows, and **no** plant row for `reliability`.
- **G** the same day again with a changed block, **W** `save`, **T** the same three rows replaced (count unchanged,
  `run_id` moved), not six; **G** the next day, **T** a second series of three rows.
- **G** the HTTP run for tenant A, **W** `POST /analytics/run`, **T** every plant row is a computed figure except
  `reliability`, and the `reliability` rows equal the figure's `machines` + `categories` keys, each with the matching
  subject; **W** the same through `GET`, **T** no row is written.
- **G** a raw `kpi_snapshot` read for tenant B, **W** tenant A's run, **T** B's rows are untouched (the writer stays
  inside `withTenant` and names `tenant_id`).
- **G** the seeded tenant A (M_USED, one report), **W** the run, **T** M_USED has one `reliability` machine row whose
  value is `insufficient` (1 event) and no category row.
- **G** the helper and a mixed run, **W** `profileOfKey('shift-kpis.compare')`, `profileOfKey('pm-compliance')`,
  `profileOfKey('reliability')` and `profileOfKey('dashboard.total-machines')`, **T** `standard`, `standard`,
  `standard`, `legacy`; **W** a run on a tenant whose registry has `pm-compliance` (50b landed), **T** its row is stored
  under `standard`, not `legacy`, beside the reliability rows — 67 does not reclassify 50's figure.

## Packet 3 — the machine page (one PR)

**Files (10).** `apps/web/src/screens/analytics/reliability-values.ts` (new, the total reader), `reliability-values.test.ts`
(new), `reliability-parts.tsx` (new, the two sections and the capped drill link), `MachinePage.tsx` (find the figure by
key and pass it), `machine-summary.tsx` (`RecordBody` renders the block), `apps/web/e2e/analytics-reliability.spec.ts`
(new), `packages/shared/src/i18n/analytics-machines.en.ts` (the block's copy), `packages/shared/src/i18n/analytics-guide.en.ts`
(`analytics.guide.mttr-mtbf.body3`), `apps/web/src/screens/analytics/guide-entries.ts` (the body key), the fragment.

**Red:** `pnpm exec playwright test apps/web/e2e/analytics-reliability.spec.ts` — the block is not on the page.
**Green:** the same, then `pnpm exec playwright test apps/web/e2e/analytics-machines.spec.ts` (the existing journey stays
green), `pnpm exec vitest run apps/web/src/screens/analytics`, `pnpm ui:check`.

**Acceptance — Given/When/Then.**

- **G** the e2e stub's `reliability` figure with a fitted FULL machine (HMC-2's numbers) and an insufficient PARTIAL,
  **W** each machine page, **T** FULL prints "Shape 0.88", "Scale 107.0", "Mean 114.1", the basis "This machine's own
  failures", the sample line (43 failures, 42 intervals, 70.0 censored hours), the KM line (a quarter under 18.8 h,
  half under 52.5 h, three quarters under 135.5 h), the trend line ("failures are coming faster") and the four-row
  spares table with 4.0/3.0/0.0/0.0 h; PARTIAL prints "Not enough history" with its counts and its own breakdowns link.
- **G** a machine with no spare, **W** its page, **T** the spares section says no spare was recorded and shows no link;
  **G** a machine with no entry (Conventional), **T** both sections say "Not available"; **G** a not-computed figure,
  **T** "Not computed yet".
- **G** either "See the rows" link, **W** the click, **T** the machine page opens the drill table with those ticket
  refs; **G** a block with 201 ids (a unit test of the capped link), **T** the link goes to the Breakdown log with the
  count and no `drill=` query.
- **G** an operator, **W** `/analytics/machines/:id`, **T** the analytics refusal as today (no new role, no new route).
- **G** the Guide's "MTTR and MTBF" entry, **W** read, **T** it names the `reliability` figure and its `body3` explains
  the fit, the category fallback, the censored tail, the KM and the slope's word; the 36 headings are unchanged.

**Covering suite:** the e2e spec and the existing machines spec, `pnpm exec vitest run apps/web/src/screens/analytics`,
`pnpm exec vitest run packages/shared/test`, `pnpm ui:check`, `pnpm precheck`.

## Rails

Red first in every packet; never delete, skip or weaken a test. Exactly two existing test files move, both stricter,
both named above and **both shared with 48 and 50**: the owner bound and set
(`packages/domain/test/analytics-engine.test.ts:68-69,87-88`, where 67 is the third writer after 48a and 50b) and the
stored plant-row list (`apps/server/test/analytics-engine.test.ts:467`, shared with 50b's per-row profile). A rebase
reconciles the same lines and never drops 48's or 50's entries. One writer per packet, packets 1 → 2 → 3, one PR each, one
`changes/67-reliability-spares.md` section per packet in packet order. No new table, column, migration, setting, profile
field, screen, route or dependency (D17; plain TypeScript for the maths; no chart in `use-chart.ts`, no key in
`analytics.en.ts`, no entry in `page-content.ts`). No runtime export joins the domain root (D2 untouched). Every new
query names `tenant_id` and runs in the tenant transaction; the writer is the existing `snapshotStore`, so tenancy and
RLS are the ones already proven. File ≤ 400 lines and function ≤ 60 (`reliability.ts` split into `inputsOf`, `weibullOf`,
`kmOf`, `amsaaOf`, `fitBlock`, `categoryFit`; `critical-spares.ts` into `partKey`, `partsOf`, `sparesBlock`;
`reliability-parts.tsx` is a component under the screen's 300-line cap). `pnpm format:check` on the plan and the
fragment, `pnpm precheck` before every push. The PR body carries a `Large PR: …` line only if a packet passes the
counter's 400-line warning.

## Where a reviewer should push

1. **R4, the month-spread clock.** The one number that will look wrong: a "day" is 16.94 working hours in a 31-day
   month, not the 21 the shift windows cover. It is 48's exposure and the MTBF denominator, so the fit and MTBF agree;
   attack whether a Weibull on this clock answers the plant's question, and whether a second "actual shift hours" clock
   would be a second family rather than a fix.
2. **R3, the same-date merge.** 94 reports disappear into 46 machines' events and change the counts (83 own fits, not
   84). Attack whether two breakdowns in one day are one renewal, and confirm the drill still names both tickets and
   MTBF (48) still counts both.
3. **R6, the threshold.** Five events is a judgement. Recompute the coverage at 3 and at 8 and ask which the plant
   would trust; check that a 4-event machine's category fit is labelled, not silently passed off as its own.
4. **R4/R5 together, the small-sample shape.** TC-17's `k = 0.61` on four intervals and `β = 3.39` on five events both
   show how little a small sample says; the plan prints the event count and refuses a confidence interval (R7). Attack
   whether a band is owed at the gate.
5. **R8/R9, what the page does not draw.** No KM curve and no CI; the quartiles and the slope's word are the whole face.
   Attack whether three numbers are a Kaplan-Meier result or a footnote.
6. **R10, the spares text.** The fixture's part names are free text ("Yes", "No", "2.04…e+23", a paragraph in one cell).
   Attack the key (digits kept, stop words, "yes" dropped) against two spellings a plant really writes, and confirm the
   ranking's two keys are both visible in the table.
7. **R12, the storage branch.** One `snapshotStore` knowing one figure's value shape, 135 rows per run and no job.
   Attack the run-only series and the category label as a subject key (a rename starts a new series).
8. **The two shared moved tests.** Confirm the owner set is the landed set plus 48, 50 and 67 (the bound 38–67) and the
   plant-keys assertion is stricter; 67 is the third writer on the owner pin (after 48a and 50b) and the store assertion
   is shared with 50b's per-row profile, so a rebase must keep both, and no other assertion changed.

## Not in this ticket

No confidence interval or bootstrap (R7); no remaining-life/PM-optimisation model; no intervention judgement or
technician ranking (54); no monthly scorecard (53); no PM/forecast work (49, 52); no chart on the machine page (R8);
no new screen, page, nav entry or route — the only web additions are the block's reader, its parts and its test; no spares inventory, stock
level, reorder point or rupee ranking (R10); no category management screen and no category id; no spare-name aliases or
re-coding of the log (43/47 own the text); no change to 48's figures, MTBF, MTTR or availability; no history backfill.
