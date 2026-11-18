# 42 — the forecast slice

## 42a — the A9 risk and capacity core

**What changed for a user:** the A9 Bottleneck Analysis page now computes its first four KPIs and its three risk and
capacity tables, whole against the frozen 11 November key: **Critical 6** and **High 16** machines, **4** machines
that are the only one of their kind, plant availability **99.45%** ("machine hours up, 01 Jan 2026 to 07 Nov 2026"),
the 20 highest-risk machines (WJ-01 first at score 87, Critical), capacity by machine category (14 categories) and
capacity by cell (9 cells, Cell 1 through Cell 8). The drill names every production machine (125 on this key).

**The rules the key pins.** The fleet is `isProduction`; hours are `effectiveHours` (a NO DT row is a breakdown with
0 h); PM is never a breakdown. The period is 1 January of the earliest breakdown year to the latest breakdown date,
and each machine is observed from the later of that start and its purchase date, days inclusive. `unav = min(1,
h/avail)`, `a = 1 − unav`, `fleetUnav = Σh/Σavail`, `L = min(1, (unav/fleetUnav)/4)`, `C = 1/√peers`,
`score = round(100·(0.5L + 0.5C))`; Critical when (peers = 1 and unav > fleetUnav) or (score ≥ 55 and peers ≤ 10),
else High ≥ 40, Watch ≥ 30, Low. Table 0 sorts score desc then hours desc, top 20. Table 3 sorts machine count asc
then average availability asc; table 4 sorts average availability asc; a blank cell prints "No cell assigned".

**Tests that prove it.** `pnpm exec vitest run packages/domain/test/analytics-bottleneck.test.ts` (3 new tests):
(1) `kpis.slice(0,4)`, `tables[0]`, `tables[3]` and `tables[4]` are `toEqual` the key's own subtrees, whole
objects and no tolerance; (2) the drill is derived from `ENGINE_DATA`'s production fleet — 125 ids, every one a real
machine, the engine's order; (3) a fresh 500-hour breakdown moved onto an excluded machine leaves the whole page and
the drill byte-identical (the production filter bites). Red first, before the computer was registered: 2 of 3 failed
with `expected 'not_computed' to be 'ready'` and `expected [] to deeply equal [ 'CAM-01', …(123) ]` (the exclusion
test was vacuous against a null value and now asserts `ready` first). Green: the named file 3/3; then
`pnpm exec vitest run packages/domain/test` — 30 files, 400 tests (396 before; the 3 new tests plus the one purity
case the new source file adds to `analytics-engine.test.ts`). `pnpm precheck`: all checks pass (6 pre-existing lint
warnings).

**Files.** `packages/domain/src/analytics/a9-bottleneck.ts` (new, 398 lines), its `computers.ts` entry in a new
owner-42 map, `packages/domain/test/analytics-bottleneck.test.ts` (new) and this fragment. No new dependency; no
table, schema, migration or settings seam.

**Deviations and notes recorded.**

1. **The printed hours are rounded the platform's way.** The key's TC-13 prints **117.4** for the double sum
   117.44999999999999, which `formatInr` alone prints 117.5; the key's TC-7 prints **134.9** for 134.84999999999999,
   which a `toFixed` guard (A1's and the footprint's) prints 134.8. The platform prints through `toLocaleString`,
   which rounds the shortest decimal that names the double; a 12-line local `printed` helper does that, then
   `formatInr` groups it. No shared formatter changed.
2. **Raw breakdown entries, never merged episodes (the plan review's correction).** "Breakdowns" in table 0 is
   the production non-PM row count: WJ-01 prints 23 entries, while a same-or-next-day merge would give 19, and the
   key's elsewhere MTTR (83.69 / 23 = 3.6 hrs) pins the same count. The episode merge applies only to the
   forecast/trend/repeat computations of 42b and 42c. The exported `a9RiskCore` carries `mttr = h/n` and
   `perYear = h/days × 365` from those raw facts, so those packets read the same numbers.
3. **The page's slots are fixed for the packets that follow.** The value carries 14 KPI slots, 9 table slots and 2
   chart slots; 42a fills 0–3 and tables 0, 3, 4 and leaves the rest `null`, so 42b and 42c fill their own index
   without renumbering another's. A null slot prints nothing in the face's mapper.
4. **The period reads the production non-PM rows.** On this workbook every filter gives the same 01 Jan → 07 Nov
   window; the stricter pool is the one the page's own hours come from.
5. **The test reads `a9-bottleneck-forecast.json` directly** rather than adding an `A9` export to the answer-key
   `keys.ts`: 42a to 42d share that file, and the typed export belongs with the packet that completes the page.
6. **Labels are normalised.** Category and cell labels pass through `normalizeLabel`, so the key's "Cnc Sliding
   Head Automatic Lathe" prints with one space (the raw field carries two) and a cell groups under the text it
   prints. KPI 3's sub prints the period as `01 Jan 2026 to 07 Nov 2026` from the en-GB short months.
