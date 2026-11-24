# 0036 — The v2 kit rulebook: colour with meaning, one period per page, Bhavin's patterns, the presentation rules

Date: 2026-11-24 · Decided by: Nimish (chat, 19:35, 19:54 and 19:56 IST); tickets and assumptions by Plan (unattended)

**This ADR is the single, complete rulebook for every remaining v2 screen.** There is one kit version: a screen adopts
these rules through the kit parts below, never through its own copy. A rule not written here is not a kit rule.

## Nimish's decisions

1. **One kit version** (19:54). No parallel kits; every rule below lands once, in `apps/web/src/ui/v2/`.
2. **Colour with meaning.** A figure with a yardstick or target gets a **status**: good, watch, bad, neutral, from
   tokens only. Red only ever means bad; a figure's kind (`tone`: loss, gain) no longer paints a tile red.
3. **English only for now** (19:56). The Gujarati toggle is hidden and no page shows Gujarati until Nimish turns it on.
   The `gu` catalogues and the no-mixed-page check stay; no Gujarati work in these tickets.
4. **Shifts** (19:56). Cosmos runs its two shift windows as configured today (they match the answer key); no seeded
   change; the plant edits windows in Settings. **Effective-dated shifts are not needed now**: no shift calendar, no
   migration 0016 (the earlier draft's `shift.valid_from` and `person.language` are dropped; nothing reads them).
5. **One period per page.** Every figure on a page counts over the same period, and the page says which.

## The rules (every v2 screen)

Each rule names its kit part and ticket. "Exists" means the kit already has it (checked 24 Nov, main `638b2b09`).

### Page

- **R1 Page budget above the fold:** a question-style title, one answer sentence (`Verdict`, exists), at most 4 tiles
  and 1 visual. Everything else sits under "Show detail", per section. Kit: `TileSet`, `ShowDetail` — **#686**.
- **R2 Action strips:** up to 3 at the page top, each count + what + link, toned by severity, worst first, none at 0.
  Bhavin: "**3 high-priority** and 5 medium nudges need attention — Open Action Center →". Kit: `ActionStrips` — **#691**.
- **R3 Severity count row:** High priority · Medium · Low · Good news, on pages that rank issues. `SeverityRow` — **#692**.
- **R4 Period:** the page's single period, as one toggle where the page has a choice (Days so far | Full year,
  Bhavin's "available hours counted"; only the divisor changes), kept in the URL (`?period=full`). Every figure on
  the page reads it. Pages without a choice state their period in one line (`insight.period.year|all`).
  `PeriodToggle` — **#693**.
- **R5 Data trust:** "n rows need review", linking to the review tray; nothing at 0. `ReviewMarker` — **#698**.
- **R6 Download Excel** on every page and table Bhavin had it on, exact values, the page's **DOC. NO.** on the first
  row (CE-MTN-F-01 registers, CE-MTN-F-04 breakdown history; `doc-ref.ts`). `DownloadExcel` — **#690**.

### Tiles and figures

- **R7 Status on every tile with a target:** `statusOf({ value, target, better, band = 0.10 })`: meets or beats →
  good; worse by ≤ 10 % of target → watch; worse by more → bad; no target or not a number → neutral. The 10 % band
  is an assumption (Plan); a figure may pass its own. Status owns the tile edge and badge; `tone` keeps its icon.
  A rank, share or average yardstick stays neutral unless its screen says which side is bad. **#685**.
- **R8 Unit + basis note under every figure:** the unit after the value, one line on how it was counted or what was
  left out (Bhavin: "average · hours to 16 Oct"; "{n} entries — NO DT code, excluded from Downtime totals"). **#685**.
- **R9 Every tile:** a 12-month sparkline and the change vs the previous period, toned by the metric's good direction
  (exists: `KpiData.trend`, `delta.good`; screens fill them in the sweep).
- **R10 All-zero tiles collapse** to one line ("All 4 are zero: …"). **#686**.
- **R11 Readable rounding:** `6.22 lakh hrs`, `₹ 1.20 cr`; the exact value in the tooltip and in Excel. `format.ts`
  (`readable`, `rupees`, `exact`) — **#684**; the tooltip prop `exact` — **#685**.
- **R12 ₹ at stake beside lost hours**, only where the money setting (value of one machine-hour) exists and only for
  heads (the roles that see Money Matters). Kit draws `moneyText` when the adapter passes it (**#694**); the adapter
  decides from the setting and role.

### Tables

- **R13 Small tables:** no search box and no pager under 10 rows (judged on all rows). **#687**.
- **R14 Totals are the table footer**, never a ranked row. `DataTable total` — **#687**; printed tables'
  "PLANT TOTAL" → footer — **#689**.
- **R15 Cell status:** a cell with a meaning wears its status (`Column.status`). **#687**.
- **R16 Bhavin's filters** (cell, category, age band 0-5/5-10/10-15/15-20/20+/Unknown, shift, …) as dropdowns with
  "Reset filters", and sort with the screen's default order (newest first for logs, worst first for measures). **#688**.
- **R17 Reason chips** in tables (grey, "Repeat ×3"), never a status colour. `ReasonChips` — **#699**.
- **R18 Insight-aware tables** (worst first, worst row marked, bars, folded tail, expand row): exists (#620).

### Charts

- **R19 Direct labels over legends.** A chart names its series at the line end or on the bar; no legend box.
- **R20 Ranked bars with a 50 % marker** instead of Pareto bar + line; the bars that make up half are bad.
  `RankedBars` (value · share · count, inline bar) — **#694**; Pareto redrawn — **#695** (after #694).
- **R21 No bubble charts:** a four-quadrant chart with named quadrants and the top offenders labelled.
  `Quadrant` — **#697**.
- **R22 Heat grids drop empty months**; a mostly-empty grid (over half its cells empty) becomes a ranked list. **#696**
  (after #694).
- **R23 Machine segment colours:** one fixed colour per segment, the same for chip, tile edge and chart series, never
  meaning good or bad: CNC `--color-v2-seg-cnc`, conventional `-conv`, process `-process`, robots `-robot`,
  utilities `-util`, DG `-dg` (tokens in this PR, 3:1 on the panel, light and dark). `segmentKey`, `EntityChip seg`
  — **#700**. Replaces the hashed `catOf` slots in the sweep.

### Entities and language

- **R24 Chips open a side drawer** with 3 figures and a link to the full page. Chip + drawer exist; capping each
  drawer at 3 figures waits for #666 (it owns the cell drawer). **Remaining, below.**
- **R25 English only:** `GUJARATI_ON = false`; no language choice shown. **#701**.

## Kit tickets, in dependency order

Parallel now (disjoint files): **#684, #685, #686, #687, #690, #691, #692, #693, #694, #697, #698, #699, #700, #701**.
Then: **#688, #689** (after #687) · **#695, #696** (after #694).
Small (Haiku): #692, #693, #698, #699, #701. Every seed is `plan/t<N>` with visible tests red and hidden tests in a
`holdout/` folder beside them. Tests cover figures and rules only (ADR 0034: critical tests); colours, CSS and markup
details are not tested.

## Remaining (the next Plan job writes and seeds these)

1. **Verdict status chip + `FigureData.status`** (`verdict.tsx`, `figure-tile.tsx`): after #642 merges (it owns both).
2. **Drawers show 3 figures + link** (R24): `domain/detail-parts.tsx` and the four detail drawers, after #666.
3. **Shift KPIs over one span** (a wrong figure, not a label): "Failures" counts every breakdown to the as-of date
   (`standardTotals` → `eventsAt`, no start) while "Working Hours" uses the year to date, so MTBF and availability
   divide 2022–2026 failures by 2026 hours. Fix in `domain/analytics/standard-kpis.ts` + `shift-split.ts`; then the
   page states its period (after #642).
4. **Adoption sweep, one ticket per screen**, after its batch-2 ticket merges (ADR 0035): status, unit, basis and
   sparkline on every tile; `TileSet`; segment colours; strips, severity row, period, review marker where the screen
   has them; Pareto/bubble/heat replaced; Excel + DOC. NO. Each screen's coverage table records it.

## Rejected

- Effective-dated shift calendar and per-person language (earlier draft of this ADR): not needed now (decision 3, 4).
- A legend under each chart: direct labels read faster (R19).
- Hashing machine types into 5 colours (`catOf`): two segments can share a colour; replaced by named segments (R23).
