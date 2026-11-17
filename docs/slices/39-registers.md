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
