# M4a-39 — registers, cell change log, footprint, age and one page per machine

Milestone M4a, ticket 39. Two packets: **39a engine** (the five owner-39 figures exact against the answer key) and
**39b screens** (registers, cell change log + export, machine page). Read first: `packages/domain/src/analytics/*`
(especially `computers.ts`, `rows.ts`, `availability.ts`, `machine-facts.ts` from tickets 38.x),
`packages/domain/test/answer-key/fixture.ts`, `fixtures/answer-key/{registers,a7-footprint,a8-age,machine-page}.json`,
`fixtures/answer-key/input.json` (machines carry `length`, `width`, `conveyor`; `cellChangeLog` carries 15 rows with
`fromCell/toCell/fromLocation/toLocation`), `packages/db/migrations/0014_m4a_schema.sql` (move locations already
exist), the platform Guide in `docs/discovery/source/cosmos_platform.html` (sections "Machine and utility lists",
"Footprint", "Age", "Cell Change Log"), and `docs/plan/m4a-figures.md` §1.6/1.7.

## Packet 39a — the five figures (engine, one PR)

1. **Fixture adapter:** map `cellChangeLog` into `EngineData.moves` (id, machineId, fromCell, toCell, effectiveFrom =
   its date; locations carried where the row type allows) and machine `metadata` with `length`, `width`, `conveyor`,
   `efficiency` from the workbook rows that carry them (conv/proc/util/DG lists; CNC rows carry them too where present).
   No production change needed: the server loader already reads machine metadata and `machine_move` including the two
   new location columns (0014).
2. **`registers`** (drill machine): per register page — CNC/Conventional/Process/Utilities/DG — the platform's own
   splits: count, connected load (KVA; utilities' stabilizer/UPS capacity and DG supply capacity are not load), average
   age, and the **controller brand split with series** for CNC (controller spellings merged as the Guide says, e.g.
   "Fanuc Oi TF" ≡ "FANUC OI-TF") and the **make split** per register. Value shape mirrors the key's pages/kpis.
3. **`a7-footprint`** (drill machine): machines mapped (with length+width), machine area = Σ L×W/1e6, floor needed =
   the smallest square that fits all machines with the 1.0 m clearance and margin (the Guide's packing rule), machine
   area share, and the per-category average footprint the key lists.
4. **`a8-age`** (drill machine): age = completed years from `purchasedOn` to as-of; a year-only machine uses this year
   − purchase year and the value says "estimated"; the age bands and average age exactly as the key.
5. **`machine-page`** (drill machine): the per-machine record the key holds (nameplate fields, breakdown summary,
   PM visits/hours, record completeness, age, floor area, connected/running load with the efficiency factor) — one
   value per machine in the shape the key's `machine-page.json` uses.
6. **`cell-change-log`** (drill move, registered): the moves list as the key's `registers`/`input` page shows (date,
   machine, from→to cell and location), drill ids = move ids.
7. Extend the pure answer-key test to every one of these with **exact** comparison (no tolerance) and drill checks, and
   keep the existing assertions. Red first.

**Write scope 39a:** `packages/domain/src/analytics/*` (new modules allowed), `packages/domain/test/answer-key/fixture.ts`,
`packages/domain/test/analytics-*.test.ts`, `apps/server/src/modules/analytics/load.ts` (only if a field is missing),
`changes/39-registers.md`.

## Packet 39b — the screens (browser, one PR)

Design reference: `docs/design/LOCK.md` § "Analytics face" (one left-menu group per screen family) and the platform
Guide's register/cell-log/machine-page sections; approved artboard `docs/design/slices/slice-9-analytics-1-dashboard-today.html`
for the face grammar. Build from the kit; every figure a drill, every held/unavailable figure honest.

1. **Registers** (Machines group): one page per register (CNC, Conventional, Process, Utilities, DG) with the splits,
   loads and age from the `registers` figure; rows drill to the machine page.
2. **Cell change log**: its own page in Machines, table of moves (date, machine, from→to cell/location) from the
   `cell-change-log` figure, with the platform's **export** (CSV/XLSX under the existing chart/export pattern — no new
   dependency; state the controlled-document number on the export as the platform does).
3. **Machine page**: one route per machine (`/analytics/machines/:id`) showing nameplate, age, floor area, load,
   breakdown summary, PM visits/hours, record completeness and its cell moves, each figure drillable to its rows.
4. Data honesty: when a machine has no length/width or no purchase date, the page says so (the checklist figure already
   lists these) — never a fabricated number.

**Write scope 39b:** `apps/web/src/screens/analytics/*` (new pages), `apps/web/src/App.tsx` (route), the analytics
groups/menu files, `apps/web/src/api.ts` (machine-page fetch), i18n `analytics.en/gu.ts`, `apps/web/e2e/analytics.spec.ts`
or a new `apps/web/e2e/analytics-machines.spec.ts`, `changes/39-machines-ui.md`.

## Rails

Red test first; never delete/skip/weaken a test; one writer per packet, disjoint files; file ≤ 400 lines, function ≤ 60,
screen files ≤ 300; no new dependency without an ADR; every string a catalogue key in both languages; money only for
head/plant_head/admin; no real names or phones. Commit locally; do not push; report red, green and deviations.

## Revision — the frozen figure value shapes (agreed between 39a and 39b, binding)

The engine (39a) emits exactly these; the screens (39b) consume them and never guess:

1. **`registers`**: `{ pages: [{ page: 'machines'|'conv'|'proc'|'util'|'dg'|'robots', title, kpis: [{label, value, sub?}], tables: [{title?, header, rows}] }] }` — key-shaped: each register page carries the key's **By Category** table and then its machine list, in the key's order. The key's _Cell / Location Change Log_ table is delivered by the separately registered `cell-change-log` figure (its own drill type) and is not duplicated inside `registers`.
2. **`cell-change-log`**: `{ moves: [{ id, machineId, date, fromCell, toCell, fromLocation, toLocation }] }` — `id` is the move id, `machineId` the machine UUID, `date` ISO (the UI formats it).
3. **`a7-footprint` / `a8-age`**: key-shaped `{ pages: [{ page, title, kpis, tables }] }` — `a7-footprint` carries **all five** of the key's tables (by category, by cell, by location, growth by purchase year, the ten largest), `a8-age` all of its cards.
4. **`machine-page`**: `{ byMachine: { [machineUuid]: MachineRecord } }` where `MachineRecord` is
   `{ machine: { id, code, segment?, category?, make?, model?, serial?, controller?, controllerModel?, controllerSerial?, year?, purchasedOn? (ISO), powerKva?, capacityKva?, location?, cell?, assetCode?, lengthMm?, widthMm?, conveyor? }, ageYears?: number|null, ageEstimated?: boolean, floorAreaM2?: number|null, efficiencyPct?: number|null, connectedKva?: number|null, runningKva?: number|null, breakdowns?: { count, hours?, mttr?, mtbf?, lastOn?, topProblem?: { problem: string; count: number } | null }|null, pm?: { visits, hours }|null, completeness?: { recorded, of, missing: string[] }, moves?: [...], drill?: { breakdowns?: uuid[], pm?: uuid[], moves?: uuid[] } }`.
   **A missing length/width or purchase date is `null`/absent — never 0 or a guess**; the UI says "Not available".
5. The machine page rides the existing figures reply (no new endpoint, no `api.ts` change).

**Revision 2 (night review, 17 Nov).** (a) `topProblem` is an object `{ problem, count } | null`; a screen that prints it reads `.problem` (39b read it as a string and showed "Not available" on machines that have breakdowns — fixed in 39b). (b) Empty plant: a figure with no rows behind it returns `{ value: null, drillIds: [] }` (the engine's invariant forbids a ready value naming no rows); this applies to `a7-footprint`, `a8-age` and `registers` on an empty or dimension-less plant. (c) The whole figure is compared to its key file, not a slice of it: `a7-footprint`'s five tables and each register's By Category table are asserted by full equality.
**Revision 3 (night, 17 Nov).** Packets 39a/39b merged (#304, #305). Goal 1's third clause, "an admin correcting a
cell move's date is audited", is not in that code: it is packets **39c (API) and 39d (screen)**, planned in
`docs/slices/39-move-audit.md` (branch `39-move-audit`) — one fragment per packet, the date bounded by the plant's
history and today, and the audit entity `machine` with the machine's id.
