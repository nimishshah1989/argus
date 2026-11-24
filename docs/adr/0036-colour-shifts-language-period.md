# 0036 — Colour with meaning, an effective-dated shift calendar, a per-person language, one period per page

Date: 2026-11-24 · Decided by: Nimish (chat, 19:35 IST), tickets and assumptions by Plan (unattended)

## Nimish's decisions

1. **Colour with meaning (kit rule, every screen).** Every figure that has a yardstick or target gets a **status**:
   good (green), watch (amber), bad (red), neutral (grey), from design tokens only.
   - Tiles show the status as an accent (top edge) and a tinted badge with the delta against the yardstick and an
     up/down arrow. Table cells with a meaning get the same status. The headline verdict sentence gets a status chip.
   - Pareto bars are neutral, except the bars that together make up half the hours: those are bad.
   - **Red only for bad.** A figure's kind (a loss, a risk) no longer paints a tile red; only the status `bad` does.
   - Kit-wide: no search box or pager on a table under 10 rows; a set of tiles that are all zero collapses into one
     line; no "PLANT TOTAL" row inside a ranked table: the total is the table's footer.
2. **Shifts.** Cosmos runs **2 shifts, 16 working hours a day, now**. A third shift may start around January. The shift
   calendar is **effective-dated**: a set of shifts valid from a date. Each figure uses the calendar valid on each day.
3. **Language.** A visible English / Gujarati toggle in the top bar of every page, remembered **per person**. Nobody's
   language is assumed: English until the person picks. **A page never mixes languages**: if any Gujarati string the
   page needs is missing, the whole page shows English with a small note that Gujarati is incomplete. A check fails
   when a `gu` catalogue misses keys a v2 screen uses.
4. **Time span.** Every figure on one page uses the same period, and the page says which period (history and live, or
   this year).

## What already exists (checked 24 Nov, main `ebbd2dd8`)

- Status tokens: `--color-good|watch|bad|neutral-{fill,ink,tint}` exist for v1, light and dark, contrast-checked. The
  v2 kit has `--color-v2-gain|risk|loss` and `track`/`ink-2` but no status names and no contrast check. Added here:
  `--color-v2-good|watch|bad|neutral` (`-fill`, `-tint`) as aliases of those values, light and dark, and their four
  ink-on-tint pairs in `tokens.test.ts` (all ≥ 4.5:1).
- Shifts: the `shift` table has no dates. Cosmos's seed (`apps/server/src/seed/cosmos-shifts.json`) is shift 1
  08:00–18:30 and shift 2 18:29–05:00, which is **21 h a day**, not 16. `docs/DATA-MAP.md:116` and ADR 0031 give the
  same 21 h, and the frozen answer key prints "Working Hours / Day 21.0". ADR 0026 says 16 h with no windows.
- Language: stored per tenant only (`tenant.language`); the account sheet keeps a pick per phone in `localStorage`, and
  floor phones are shared, so "per phone" is not "per person". No toggle in any top bar.
- Time span: on Shift KPIs, "Failures" counts every breakdown to the as-of date (`standardTotals` → `eventsAt`, no
  start), while "Working Hours" and the breakdown map use the year to date (`workingHoursPlant`, `spanOf`). On a plant
  with no `dataFrom` cut, MTBF and availability divide 2022–2026 failures by 2026 hours: **that's a wrong figure, not
  only a wrong label.**

## Decisions made here (Plan, unattended; each can be overturned)

1. **Status rule (`statusOf`).** It needs a value, a target and which direction is better:
   - meets or beats the target → good;
   - worse by up to 10 % of the target → watch;
   - worse by more than 10 % → bad;
   - no target, or a value that isn't a number → neutral.

   The 10 % watch band is an assumption. Nimish may set a different band per figure later; the rule takes it as a
   parameter. A figure with a yardstick that isn't a target (a rank, a share, an average) stays neutral unless its
   screen says which side is bad.

2. **Status, not tone.** The kit already has `tone` (what kind of figure it is: loss, gain, risk, plan, which colours
   words). The new field is `status` (how the figure is doing). On a tile, `status` owns the colour of the edge and
   the badge, and `tone` keeps only its icon.
3. **Pareto half-hours:**
   - The bad bars are the fewest leading bars whose running sum first reaches half the total hours. Zero total
     means no bad bars.
   - The split line stays at the screen's `top`.
   - A trailing "Rest" bar is never bad.
4. **Effective-dated calendar.** `shift.valid_from date NOT NULL DEFAULT '2000-01-01'`, unique on
   `(tenant_id, code, valid_from)`. The **calendar valid on day D** is the active shifts whose `valid_from` is the
   latest one ≤ D. A shift that crosses midnight belongs to the calendar of the day it started (GLOSSARY: production
   date). Existing rows keep `2000-01-01`, so every figure is unchanged until a new calendar is added. This is
   migration 0016, on main with this ADR so the shift tickets build in parallel.
5. **Cosmos's 16 h calendar is not invented.** Changing it needs two answers from Nimish, so its ticket waits:
   - the two windows;
   - the date the 16 h started.

   **Bad news:** if 16 h is dated back over 2026, every 2026 availability and MTBF figure moves away from Bhavin's
   answer key (21.0 h), a v1 "done" number. Dating it from a recent day keeps the answer key and makes the change
   honest.

6. **Language per person.** `person.language text NULL CHECK (language IN ('en','gu'))`, in migration 0016.
   - NULL means the person hasn't picked, so the page shows English.
   - The company's `tenant.language` no longer chooses anyone's language. It stays as a column; Settings may still
     show it, but nothing reads it for a page.
   - The `localStorage` pick is dropped as a source.
7. **Page language at run time.** A page renders in Gujarati only when every key it renders has a non-empty Gujarati
   string. The test is an i18next post-processor that reads the `gu` resource for each key it translates; one miss
   re-renders the page and its shell in English, with the note `insight.language.guIncomplete`. The note is in
   English, because the page is.
8. **The Gujarati check is a ratchet.** Most `insight.*` and v2 keys are blank in `gu` today (D7), so a check that
   failed on every blank would turn every PR red. `tools/check-gu.ts` collects the `t('…')` keys under
   `apps/web/src/screens/v2/` and `apps/web/src/ui/v2/`, and fails on any key that is missing or blank in `gu` and
   not in the baseline `tools/gu-gaps.json`. The baseline can only shrink. Translating the baseline needs a Gujarati
   reader at Cosmos: an open question for Nimish.
9. **Period per page.**
   - Shift KPIs is a **this-year page**. Its failures, PM hours and shift split count from the start of the same
     span as their working hours (`spanOf`); this is a figure fix in the engine.
   - Every v2 page then states its period in one line (`insight.period.year` or `insight.period.all`).
   - Pages other than Shift KPIs get that line in the sweep after screens batch 2.
10. **Adoption on screens comes after batch 2.** The kit tickets here add the rules (`status` on tiles, cells and the
    verdict, `TileSet`, small tables, the total footer). Setting a status on each screen's figures touches every
    screen's adapter, and each of those adapters belongs to an open batch-2 ticket (ADR 0035). So adoption is one
    sweep ticket per screen after batch 2 merges, written by Plan then.
11. **Tests (ADR 0034).**
    - The status rule and the half-hours rule are tested as figure correctness: a wrong status is a wrong claim
      about a number. So are the zero collapse, the small-table threshold, the total footer, calendar per day,
      language per person (tenancy and auth), page language and one span per page.
    - Colours, CSS and markup are not tested.
    - Kit words for status, period, zero tiles and the Gujarati note are added here (`insight.*`, `gu` blank per D7).

## Tickets (planned; issues not yet created, the next Plan session creates and seeds them)

Kit (seed now, disjoint files):

- **S1** tile status: `statusOf` in `ui/v2/status.ts`, `KpiData.status` in `kpi-card.tsx`, `kpi-tone.css`.
- **S2** Pareto half-hours: `halfBars` in `pareto.tsx`, `domain.css`.
- **S3** zero tiles: `ui/v2/tile-set.tsx` (new: `allZero`, `TileSet`), `cards.css`.

Kit, blocked by #620 (PR #650):

- **S4** small tables and cell status: `ui/v2/table-rules.ts` (new), `data-table.tsx`, `paged-table.tsx`.
- **S5** plant total as footer: `screens/v2/printed-page/table.ts`, `ui/v2/domain/printed-table.tsx`.

Kit, blocked by #642 (PR #649), seed after it merges:

- **S6** verdict status chip and `FigureData.status`: `verdict.tsx`, `figure-tile.tsx`.

Shifts:

- **H1** engine working hours per day by calendar: `domain/analytics/working-hours.ts`, `types.ts`,
  `server/.../analytics/load.ts`, `plant/repo/analytics.ts`.
- **H2** live reads use today's calendar: `plant/repo/reads.ts`, `plant/repo/config.ts`.
- **H3** shift split books each breakdown by its day's calendar: `shift-split.ts`. Blocked by P1.
- **H4** Settings adds a calendar from a date: `shared/plant-settings.ts`, `plant/settings-resources.ts`,
  `plant/repo/plant-settings.ts`. Blocked by H1 and H2: a second calendar must not exist before readers handle it.
- **H5** Cosmos to 2 shifts, 16 h. Blocked by Nimish (the windows and the from-date) and by H4. No seed.

Language:

- **L1** `person.language` read and set (`PUT /api/v1/me/language`, in `/config`): people module.
- **L2** top-bar toggle and `pickLanguage(person)`, defaulting to English: `i18n/index.ts`,
  `ui/language-toggle.tsx`, `ui/v2/shell.tsx`, `ui/top-bar.tsx`. Blocked by L1.
- **L3** a page never mixes languages: `i18n/page-language.ts`, `ui/v2/shell.tsx`. Blocked by L2.
- **L4** `tools/check-gu.ts` ratchet, with `tools/gu-gaps.json` and a `package.json` script.

Period:

- **P1** Shift KPIs figures over one span: `domain/analytics/standard-kpis.ts`, `shift-split.ts`.
- **P2** Shift KPIs states its period. Blocked by #642 and P1.
