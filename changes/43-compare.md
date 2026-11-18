## 43b — Team Focus

**What changed for a user:** the Team Focus page now computes its whole frozen 11 November key: the three KPI tiles —
**Actions 31** ("31 not started, 0 in progress"), **Done 0** ("0 marked not needed") and **Progress 0%** ("of actions
done or not needed") — and the month's **31 ranked actions**, in the platform's six lanes and order. The page has no
tables and no charts. The drill names the 14 machines the actions themselves name; spare and record actions name no
machine and drill nowhere.

**The rules the key pins.** The period is the same one the bottleneck page uses (1 January of the earliest breakdown
year to the latest breakdown date), and months = period days / 30.44. The fleet is `isProduction`, hours are
`effectiveHours` (NO DT = 0) and PM is never a breakdown. The lanes are:

- **A, before next month:** the forecast's Hot or Likely machines (or a rising Watch), top 8 by expected hours;
  stake is the expected hours; key `fc|<machine>|<YYYY-MM>`, title "inspect before <month>".
- **B, fix for good:** repeat machine-and-group pairs with four or more separate occurrences (entries more than
  three days apart), top 6 by hours, then the top 3 problem groups by hours; stake is hours / months. Guide section 29
  says four or more; the platform's `tfCompute` guard still reads `>= 3`, a stale line the key does not expose
  (all six pairs have four or more occurrences), so the figure follows the Guide.
- **C, overhaul or replace:** machines rated Poor or Critical by the age-adjusted health score that lost more than
  their expected hours, ranked by the excess per month, top 5.
- **F, Why-Why due:** long breakdowns over the Why-Why threshold in the last `longDays` with no saved record, newest
  first, top 5; title ends "— Why-Why not done".
- **D, spares to keep ready:** part keys used three or more times on two or more machines, top 5 by uses; the printed
  name is the commonest raw spelling with sizes and stop words removed.
- **E, fix the record:** the two gaps this log has — 21 machine-and-problem pairs logged four or more times, and
  spare cost blank on 175 breakdowns that named a part — both with zero hours at stake.

The saved status, owner and note are not this figure's: it prints the platform's defaults (open, no owner, no note).
Their persistence is the ticket's later server packet (`focus:<period>|<action>` rows).

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-team-focus.test.ts` (3 new tests):
(1) `figure.value` is `toEqual` the whole `team-focus.json` — page, KPIs and every action with its key, lane,
machine, title, stake and default state; (2) the drill is derived from the key's own action machines, every id is a
real machine, and the engine's sorted ids match; (3) the three KPIs are pinned exactly and the page has no tables or
charts. Red first, before the computer was registered: all 3 failed with `expected 'not_computed' to be 'ready'`,
"the engine knows no figure team-focus" and a null value. Green: the named file 3/3; `pnpm exec vitest run
packages/domain/test` — 36 files, 429 tests passed; `apps/server/test/analytics-engine.test.ts` — 18/18 (the loader
now returns `spares: ['10 mm pu pipe', '12*3mm seal']` from the seed's `spare_used`). `pnpm precheck`: all checks
pass.

**Files.** `packages/domain/src/analytics/team-focus.ts` (new, 374 lines), `team-focus-health.ts` (new, 311
lines) for the age-adjusted health score behind lane C, `team-focus-spares.ts` (new, 111 lines) for lane D's part
keys and shared spare seam, the `team-focus` entry in `computers.ts`'s owner-43 map, the new test, the server
loader's spare split and this fragment. No new dependency, no table, schema, migration or settings seam.

**Deviations and notes recorded.**

1. **The health and spare rules sit in two helper files by subject.** The ticket's 400-line file budget is hard, and
   the platform keeps the health score and the spares lane as separate subjects; `team-focus.ts` is the page and
   the other five lanes. The packet is still one computation, registered once.
2. **Spares read the shared seam, and one field is split.** `ReportRow.spares` (43c's seam) carries every spare
   the row names and the answer-key fixture maps all three legacy columns; a row written before the seam falls back
   to `spareUsed`, split on the seed's `", "` join. The server loader now fills `spares` from `spare_used` the
   same way, so live data produces the same parts. The domain test reads the shared fixture with no private
   enrichment; the server loader assertion is in `apps/server/test/analytics-engine.test.ts`.
3. **Health's spares component is not scored.** The shared seam carries spare names, not costs; every workbook cost is
   zero, so the platform's own `cy > 0 && cpb > 0` guard would omit the part anyway and the remaining weights
   renormalise. The key's C top five (TMC-2 18.25, VC-28 12.71, TC-5 11.81, VC-22 8.87, TC-13 7.96) match; a later
   cost seam can restore the 5% part without changing this key.
4. **Status, owner and note are the defaults only.** The engine is pure and has no persistence; the key's own values
   happen to be the defaults. The server packet that stores them is out of this figure.

## 43c — Money Matters

- A maintenance head now gets the whole Money Matters page from the plant's own rows, exact against the 11 November key: ten money KPIs, the four opportunity levers with their overlap-free combined row, the lost-hours-by-problem table, the ch-mm chart, and a drill to the tickets behind the priced breakdowns. Every lost hour is worth the throughput per machine-hour (₹ 1,800 by default) and the levers price the hours analysis says were avoidable at the share the team can remove (Guide section 30).
- The page reads the fleet's existing analyses instead of copying them: A10's events and repeats for the problem levers, the Compare health model for the age-and-category expectation, A9's forecast for the three planning KPIs, and the Team Focus lanes' hours at stake for the last KPI.
- **File split.** The page, the health model and the Team Focus stakes are three modules (`money-matters.ts`, `money-health.ts`, `money-focus.ts`) because one file cannot hold them inside the hard 400-line budget; the split follows 42b and 42d.
- **Fixture seam.** The Team Focus spares lane counts any of a row's three spare columns and the key's last KPI depends on it, but `EngineData` carried only `spare1`. `ReportRow.spares` now carries every spare the row names (still optional, falling back to `spareUsed`), and the answer-key fixture maps all three columns. A packet that adds a figure reading spares should read `spares`, not `spareUsed`.
- **The second box.** The platform's "share of a lost hour that is really lost sales" (`mmConv`, Guide section 30) has no profile key; this key never sets it, so the figure counts the full throughput, as the key's "full throughput counted" says. `mmTurnover` is the legacy leftover the profile still carries and the money model does not read.
- **Shared work.** Team Focus's own packet will compute the same five lane stakes; the platform's money page calls `tfCompute` itself, so this packet prices them independently. A later refactor can share `money-focus.ts`'s `stakeHours` if the two figures are allowed to depend on each other.
- **Tests.** `packages/domain/test/analytics-money-matters.test.ts`: the whole value equals `fixtures/answer-key/money-matters.json`, and the drill is the production non-PM tickets, each one a real ticket. Red first: before the computer registered, the engine reported the figure as not computed.

## 43a — Compare machines

- New `compare.ts` (page assembly: 0 KPIs, six tables, two charts) and `compare-score.ts` (the age-adjusted health score and peer averages). The scoring module is split out only to keep both files under the 400-line budget.
- The page pins its pair from the data — the plant's most populous CNC category, then its two worst age-adjusted health scores — which reproduces the key's VC-28 vs VC-22 comparison, and drills both machine ids.
- Registered `compare` in `computers.ts`; new `analytics-compare.test.ts` compares the whole `fixtures/answer-key/compare.json` value and derives the drill from the page's own headers.
- Green: `pnpm exec vitest run packages/domain/test` (422 passed), `pnpm precheck`.

## 43d — the Fix Finder

**What changed for a user:** the Fix Finder figure now reproduces the platform's page for the frozen 11 November key:
**57** similar past breakdowns ("Good evidence"), **no machine chosen** ("choose a machine to see its own history"),
a typical downtime of **1.3 hrs** against an average of **2.3 hrs** (NO DT counts as 0), and the last similar case on
**06-11-2026**. The one table, "Similar breakdowns across the plant", prints the **15** best matches in the key's own
order — six at **100%** (VC-38 and VC-25 on 26-10, VTL-6 twice, DCMC-01, VC-15) and nine at **70%** (31-10 back to
01-10) — with the problem, the action taken, the hours down to two decimals and the person who did it.

**The rules the key pins.** The key's capture typed **"spindle overload"** with no machine and no category; the page
is the plant-wide result, so this figure pins that phrase (the face's search box is a later packet). The index is
every production, non-PM breakdown (NO DT included, 0 h). Words are lowercased, split on non-alphanumerics, two
characters or more, bare numbers and the platform's filler list dropped, then stemmed (a long word loses
`ing|ation|age|ed|es|ion|ly`, a short one a plural `s`). Each query stem is expanded by its synonym group, a
shared prefix of five characters or more, and a bounded edit distance (0 at five letters or fewer, 1 to seven, 2
above), weighting rarer stems higher: `idf = ln(1 + N / df)` over the union of the candidates. A case scores
`Σ idf` for problem hits, `0.6 × idf` for action-only hits, divided by the query's `Σ idf`; a case in the query's
problem group adds 0.25 (capped at 1). Hits under 30% are dropped, sorted by score then date desc, and the page
keeps the best match and everything at `max(0.35, 0.6 × best)`, capped at 80. The KPIs read that evidence set: the
count, its upper-middle median to 1 dp, its average to 1 dp, and its latest date; the table prints the first 15.
The problem group is the shared `problemGroupOf`, so a Settings fix wins exactly as A10's classifier reads it.

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-fix-finder.test.ts` (2 new tests):
(1) `expect(figure.value).toEqual(FixFinder)` — the whole four-KPI, one-table key, no tolerance; (2) the drill is
the evidence set behind the page, its length derived from the key's "Similar cases" KPI (57), every id a real ticket,
and every one of the 15 printed rows found in the workbook by its date, machine, problem and action is in it. Red
first, before the computer was registered: 2 of 2 failed with `expected 'not_computed' to be 'ready'` and
`expected [] to have a length of 57 but got +0`. Green: the named file 2/2; then
`pnpm exec vitest run packages/domain/test` — 35 files, 421 tests (419 before). `pnpm precheck`: OK — 13
checks passed, 5 files prettier-checked (only the repo's pre-existing size warnings).

**Files.** `packages/domain/src/analytics/fix-finder.ts` (new, 392 lines: the index, the similarity score, the four
KPIs, the one table and the figure), `computers.ts` (one import and the `compareComputers` owner-43 map with the
`fix-finder` entry), `packages/domain/test/analytics-fix-finder.test.ts` (new) and this fragment. No new
dependency; no table, schema, migration or settings seam.

**Deviations and notes recorded.**

1. **The owner-43 map did not exist on this base.** The slice says every packet adds one entry to it; this packet
   creates `compareComputers` with its one entry and spreads it into `COMPUTERS`, so 43a–43c can append theirs and
   the orchestrator resolves the shared file at merge.
2. **The query is the key's capture, not a plant-derived phrase.** 43d has no input form; the platform's own
   `tools/answer-key/screens.ts` sets `ffQ='spindle overload'` before freezing `fix-finder.json`, so the figure
   exports that phrase and ranks the plant-wide result. A later face packet can pass a typed query through the same
   ranking helper.
3. **The drill is the 57 similar cases, not the 15 printed rows.** The table shows the best 15 of the evidence set;
   the drill names all 57 tickets behind the KPIs and the table, matching the engine's rule that a figure names the
   rows it came from (the A9/A10 drill pattern). Every printed row is a member of it.
4. **The query is classified through the shared problem-group list.** A minimal `ReportRow` carries the phrase into
   `problemGroupOf`, so a plant's edited groups and manual fixes are honoured without a second classifier copy; the
   group bonus is the platform's 0.25 (0.6 when no word matches).
5. **Person codes print their display names.** Reports store codes; the table maps each code through `data.people`,
   as the Breakdown Log does, so the key's "Person 46, Person 41" prints rather than `person-46, person-41`.
6. **Hours print through 42a's `printed` helper.** The platform formats with `toLocaleString`; `printed` rounds the
   shortest decimal and `formatNumber` groups it, so 0.17, 0.00 and 10.35 print exactly and no cell is re-rounded
   twice.
7. **An empty evidence set prints no page.** The key has 57 cases; a plant whose log has no similar case answers
   `null` with an empty drill rather than a page the engine cannot drill.
