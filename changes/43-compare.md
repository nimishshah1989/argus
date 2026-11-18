# 43 — compare, team focus, money and Fix Finder

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
