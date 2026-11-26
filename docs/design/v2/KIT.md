# The v2 kit: every part, what it is for, who uses it

The v2 kit is the set of building blocks every Argus screen is made from: `apps/web/src/ui/v2/` (general parts) and `apps/web/src/ui/v2/domain/` (maintenance-specific parts).
Screens under `apps/web/src/screens/v2/` compose only these parts; they never draw their own cards, tables or colours, and `pnpm ui:check` fails the build if one does.
The rules (colour only with meaning, words from the model, numbers as the engine printed them) and the short "Which kit part to reach for" table live in `docs/design/v2/LANGUAGE.md`.
The dev gallery's index page at `/gallery` shows the same pieces live; this file is the written catalogue of them.

How to read an entry: **For** is what the part does. **Pick it when** says when to choose it over its neighbours. **Key props** are the few inputs that matter (read from the code; the full type is in the file). **Used by** lists the folders under `screens/v2/` that import it; "kit-internal" means only other kit files use it, and they are named. "Gallery only" means no live screen uses it yet. Paths are relative to `apps/web/src/ui/v2/` unless they say otherwise.

---

## 1. Foundations

### Design tokens — `../tokens.css` (`apps/web/src/ui/tokens.css`)

- **For:** every colour, size, font, gap, shadow and timing the kit may use, as CSS variables. The v2 set is the `--*-v2-*` family: colours (`--color-v2-ink`, `-ink-2`, `-ink-3`, `-page`, `-panel`, `-line`, the meaning colours `-loss`, `-gain`, `-risk`, `-plan`, `-decide` each with `-fill` and `-tint`, the status colours `-good`, `-watch`, `-bad`, `-neutral`, machine type colours `-cat-1`…`-cat-5`, segment colours `-seg-*`, plus `-accent`, `-focus`, `-scrim`, `-track`), type (`--font-v2-text` Inter, `--font-v2-num` Geist, `--font-v2-mono` Geist Mono; five sizes `--text-v2-label` 12, `-secondary` 13, `-body` 14, `-title` 20, `-kpi` 24), spacing (`--space-v2-gap` 16 between cards, `-pad` 16 inside a card, `-inner` 12 within a card), shadows (`--shadow-v2-rest`, `-raised`, `-overlay`), sizes (`--size-v2-drawer`, `-rail`, `-rail-open`) and motion (`--motion-v2-fast` 160 ms, `-ui` 220 ms, `-data` 700 ms). A dark block redefines the same names.
- **Pick it when:** always. A raw hex, rgb or pixel value in a screen is rejected by CI; use a token.
- **Used by:** everything; loaded once for the whole app by `apps/web/src/style.css`.

### Base styles — `v2.css`

- **For:** the kit's base sheet: the `.v2-app` page (background, ink, body font and size), the focus ring, and shared text classes such as `.v2-sub` (a quiet line), `.v2-h2`/`.v2-h3`, `.v2-lede`. It pulls in the fonts.
- **Pick it when:** you never import it yourself; `sheets.ts` loads it first.
- **Used by:** the whole kit, via `sheets.ts` (loaded from `main.tsx`).

### Fonts — `fonts/` (`fonts.css` and the `.woff2` files)

- **For:** the three self-hosted type families (open font licence in `OFL.txt`): Inter for text, Geist for every number, Geist Mono for machine codes. Latin and Latin Extended (for the rupee sign); Gujarati falls back to the system font.
- **Pick it when:** never directly; reach the families through `--font-v2-text`, `--font-v2-num`, `--font-v2-mono`.
- **Used by:** `v2.css`.

### Motion — `motion.ts` and `motion.css`

- **For:** the one place animation is defined. `motion.css` holds the keyframes (bars grow, lines draw in, cards lift, rows re-flow); `motion.ts` names them in `MOTION` (`growY`, `growX`, `draw`, `lift`, `reflow`), offers `reducedMotion()` and the `useTick(text)` hook that ticks a printed figure up to its value and flashes its direction once when it changes. Motion carries information only; nothing fades in because a page loaded, and under reduced motion everything is instant.
- **Pick it when:** a screen never animates anything itself; it uses kit parts that already do.
- **Used by:** kit-internal: `kpi-card.tsx`, `figure-tile.tsx`, `sparkline.tsx`, `bullet-bar.tsx`, `pareto.tsx`, `event-strip.tsx`, `data-table.tsx`, `drawer.tsx`, `domain/detail-parts.tsx`.

### Page search — `palette.tsx` (`Palette`) and `palette.css`

- **For:** despite the name, not colours: the search dialog over the app's own pages (Ctrl or Cmd K). A filter box, arrow keys to move, Enter to go, Esc or a click outside to close; "Nothing matches" is announced.
- **Pick it when:** never directly; the `Shell` opens it from its header search.
- **Key props:** `entries` (the pages it can open), `onPick(to)`, `onClose`.
- **Used by:** kit-internal: `shell.tsx`.

### Number formatting — `format.ts`

- **For:** turning raw numbers into readable ones (ADR 0036 R11). `readable(value, unit?)` rounds for reading with Indian grouping and lakh / crore ("45,000", "6.22 lakh hrs", "1.20 cr"); `rupees(value)` adds "₹ "; `exact(value, unit?)` gives the full value for tooltips and Excel. Non-numbers print "—".
- **Pick it when:** a screen's model has to print a number the engine did not print itself. Figures the engine already printed are shown as sent.
- **Used by:** bd-pm, compare, dashboard, energy, manpower, problem-analysis, shift-kpis.

### Table looks — `table-look.ts`

- **For:** how a table column colours itself (ADR 0060). `ColumnLook` is a meaning (`loss`, `gain`, `risk`, `plan`, `neutral`), `category` or `plain`. `lookOfHeader(label, numeric, title)` reads it from an engine header (the builders in `printed-page/table.ts` and `figures/table.ts` call it); `catOf(word)` gives a word its fixed category colour (1 to 5); `tidyCell(node)` makes sure no raw float ("0.6666666666666666") reaches a cell, printing it through `exact`.
- **Pick it when:** a screen builds `Column`s or a `TableModel` header with translated labels: give each number column a `look` (the kit cannot read a translated header). `table-look.test.ts` fails on a number column without one.
- **Used by:** kit: `table-parts.tsx`, `data-table.tsx`, `paged-table.tsx`, `domain/engine-table.tsx`, `domain/printed-table.tsx`; dashboard, breakdown-log.

### Icons — `icons.tsx` (`Icon`)

- **For:** the v2 icon set: one stroke weight, sized to the text beside it, drawn in the text's colour. Each entity (machine, cell, person, decision) has its own icon. Icons are decoration: a word or the control's name always says what they mean.
- **Pick it when:** any icon in a v2 screen; never another icon set.
- **Key props:** `name` (one of the set: `today`, `machines`, `problems`, `reliability`, `people`, `reports`, `guide`, `search`, `bell`, `menu`, `close`, `chevronDown`, `chevronRight`, `check`, `up`, `down`, `sort`, `more`, `wrench`, `pause`, `alert`, `stop`, `clock`, `rupee`, `gauge`, `list`, `inbox`, `cell`, `person`, `decision`, and a few more), `size` (default 16).
- **Used by:** action-center, board, desk, settings, ticket; and most kit parts.

---

## 2. Layout

### `Shell` — `shell.tsx`

- **For:** the app frame around every desk screen: the left rail of sections, the glass header with the page title, the plant name, the page search, the alerts bell, and the right drawer.
- **Pick it when:** never directly in a screen; screens use `EntityShell` (below), which wraps `Shell` and wires the drawer to the URL. `Shell` is the plain frame for a preview or test.
- **Key props:** `nav` (rail items: `id`, `label`, `icon`, `href`, `current`, `end` for the foot of the rail), `title`, `plant`, `search` (pages for the search; none means no search box), `at` (current address, closes menus on change), `alerts` and `onAlerts`, `drawer` (a `DrawerSpec` or null).
- **Used by:** entity (through `EntityShell`). Also exports `NavigateContext`, which routes rail and search links without a page reload.
- **On this page (ADR 0060):** the Shell reads every titled part of the page (each `h2` inside it: a `SectionHead`, a `Panel`, a table's or a chart card's title) into `OnThisPage`, and adds them to the ⌘ K search ("Repeat offenders" jumps there). Nothing to pass.

### `OnThisPage` — `on-this-page.tsx`

- **For:** the page's own index (Nimish, 26 Nov: "it will be so hard for someone to even remember where is what"). From 1280 px a sticky rail at the right lists the sections, the one being read marked; below that, or while the drawer is open, a compact jump menu sits at the top of the page. A click scrolls there, focuses the heading and puts `#section` in the address, so a link to a section works. Under 3 sections it shows nothing.
- **Pick it when:** never directly; the `Shell` draws it. `sectionsIn`, `useSections`, `useCurrent` and `jumpTo` are its parts.
- **Key props:** `sections` (`PageSection`: `id`, `title`), `current`, `place` (`rail` or `jump`).
- **Used by:** kit-internal: `shell.tsx`.

### `EntityShell` and its drawer — `../../screens/v2/entity/EntityShell.tsx`

- **For:** the shell every v2 screen actually uses. It is the kit's `Shell` plus a drawer whose state lives in the address bar, so Back, Forward and pasted links all work.
- **How the drawer works:**
  - `?drawer=machine:TC-12` (also `cell:`, `person:`, `decision:`) opens that thing. Any `EntityChip`, table row or plant-map square inside the page opens its thing through `EntityOpenContext`; pressing the one already open closes it.
  - `?drawer=figure:<key>` opens the rows behind a figure (`RowsBehind`). A figure's control (KPI value, Pareto bar, `DrillButton`, `DrillAction`) opens it through `DrillOpenContext`.
  - Opening from closed adds one history entry; opening another thing while one is open replaces it, so one Back closes the drawer however many things were visited. Closing goes Back when the drawer opened in this visit, otherwise (a pasted link) it just removes the parameter. Every other query parameter is kept.
  - What fills the drawer, in order: the rows behind a figure if the URL names one; else the entity, taken from the screen's own `local` version if it gives one (for example a decision with its live Decide button), else loaded from the entity port and shown with `EntityDetail` inside `ScreenStates` ("loading" until the right one arrives); else the screen's own `drawer` (the desk's ticket beside its list). An entity drawer also offers a "full page" link.
- **Key props:** everything `Shell` takes except `drawer`/`search`/`plant`/`at` (it fills those itself from the router and the signed-in role), plus `local(ref)`, `rows` (where the rows behind a figure come from; defaults to the app's), `drawer` (the screen's own fallback drawer).
- **Also exports:** `ChromeContext` (what a route puts above every screen in it, such as section tabs) and `WhoContext` (role and company, which decide what the search lists).
- **Used by:** almost every screen: action-center, age, annual-report, board, breakdown-log, cell-change-log, compare, dashboard, data-checklist, desk, desk-settings, energy, fix-finder, footprint, guide, machine, machines-register, money-matters, monthly-report, oem, pm-calendar, printed-page, problem-analysis, settings, shift-kpis, team-focus, ticket, why-why, and the shared `live.tsx` / `live-frame.tsx`.

### `Drawer` — `drawer.tsx`

- **For:** the right-hand panel that shows one selected thing beside the page. ✕ or Esc closes it and focus returns to where it was; on a phone it covers the page and the page behind goes inert. A new `id` slides a new item in; a changed label does not.
- **Pick it when:** inside the Shell, for any detail of one thing. Off the Shell (the floor, sign-in) use `BottomSheet`. A screen does not render `Drawer` itself: it hands a `DrawerSpec` to `EntityShell`.
- **Key props:** `drawer` (a `DrawerSpec`: `label`, `content`, `onClose`, optional `fullPage {href, label}`, optional `id`), or null for closed. Also exports `useDrawerFrame`.
- **Used by:** kit-internal: `shell.tsx`, `form-sheet.tsx` (and the `DrawerSpec` type in `EntityShell`).

### `Panel` — `panel.tsx`

- **For:** a titled card: white, hairline edge, soft shadow, title row inside.
- **Pick it when:** a block of content needs a card with a title. For a titled part that is not a card use `Section` (in `drill-action.tsx`); for a heading over a group of cards use `SectionHead`.
- **Key props:** `title`, `sub` (one quiet line), `aside` (right of the title: a count, a filter), `flush` (rows run to the edges).
- **Used by:** cell-change-log, compare, dashboard, data-checklist, machine, manpower, pm-calendar, problem-analysis, shift-kpis, team-focus, ticket; kit: `domain/correct-date.tsx`, `domain/decision-list.tsx`, `domain/plant-map.tsx`.

### `Row` — `row.tsx`

- **For:** cards side by side on one grid, same top edge, equal heights, 16 px apart; stacked on a phone.
- **Pick it when:** two to four cards belong next to each other. For a set of KPI cards that should fold past four, use `TileSet`.
- **Key props:** `cols` (2, 3 or 4), `wide` (first card gets the bigger share, e.g. a chart beside a list), `hero` (first card is the lead figure, double size).
- **Used by:** bd-pm, bottleneck, category-cell, compare, energy, fix-finder, forecast-lab, machine, manpower, money-matters, mttr-mtbf, pm-calendar, printed-page, problem-analysis, shift-kpis, team-focus, ticket.

### `SectionHead` — `section-head.tsx`

- **For:** a heading over a group of cards, with one quiet line saying what the group covers.
- **Pick it when:** several cards form a group. One card's own title belongs in its `Panel`.
- **Key props:** `title`, `sub`.
- **Used by:** annual-report, dashboard, money-matters, monthly-report, password, sign-in, who.

### `BottomSheet` — `bottom-sheet.tsx`

- **For:** the modal for pages without the Shell: a sheet from the bottom on a phone, a right panel from 1024 px. Focus is trapped, Esc closes, the title names the dialog.
- **Pick it when:** the floor or any page outside the Shell needs a panel. Inside the Shell use the `Drawer` (through `EntityShell`).
- **Key props:** `open`, `onOpenChange`, `title`, `children`.
- **Used by:** floor; kit: `account-sheet.tsx`.

### Style loader — `sheets.ts`

- **For:** loads the kit's CSS: `v2.css` first, then every other `ui/v2/*.css` file. A new sheet dropped in the folder is picked up with no list to edit.
- **Pick it when:** never; it is imported once by `main.tsx`.
- **Used by:** `main.tsx`.

---

## 3. Data display

### `KpiCard` — `kpi-card.tsx`

- **For:** a key figure: the value (ticks in), its change against a stated period, what it means, an optional trend line, and one more line on hover. Every card goes somewhere (ADR 0058): the whole card is one control, the rows behind its figure in the drawer or a link to the page that explains it, with a focus ring round the card and the hover lift UX rule 2 keeps for clickable cards. Its own `drill` or `link` wins; with neither, the card looks its `id` up in the destinations map (`screens/v2/destinations.ts`, through `DestinationContext`).
- **Pick it when:** a headline number with a comparison. A figure with no change to compare is a `FigureTile`; a set of these that may run past four is a `TileSet`.
- **Key props:** `kpi` (`KpiData`): `label`, `icon`, `value`, `delta {text, up, good, flat}`, `period`, `meaning`, `more`, `trend`, `drill`, `tone`, `hero` + `meter`, `yardstick`, `link`, `status`, `unit`, `basis`, `exact`.
- **Used by:** machine; kit: `tile-set.tsx` (so every TileSet screen).

### `FigureTile` — `figure-tile.tsx`

- **For:** a figure the engine printed with its own line under it and no change to compare. It goes somewhere exactly as a `KpiCard` does (ADR 0058): its own `drill` or `link`, else its `id` in the destinations map; the whole tile is the control.
- **Pick it when:** the number has no "vs last period". If it has one, use `KpiCard`.
- **Key props:** `figure` (`FigureData`): `label`, `value`, `sub`, `yardstick`, `drill`, `link`, `status`.
- **Used by:** bd-pm, bottleneck, category-cell, energy, fix-finder, forecast-lab, manpower, money-matters, mttr-mtbf, pm-calendar, printed-page, problem-analysis, shift-kpis.

### `TileSet` — `tile-set.tsx`

- **For:** a row of `KpiCard`s that shows the first few and folds the rest behind "Show detail"; if every figure is zero it prints one line saying so instead of a wall of zeros.
- **Pick it when:** a page has a variable number of KPI cards. A fixed two to four cards can sit in a plain `Row`.
- **Key props:** `items` (`{ kpi, n }`, where `n` is the figure as a number), `max` (default 4).
- **Used by:** action-center, age, cell-change-log, compare, dashboard, data-checklist, footprint, machines-register, oem, team-focus.

### `Sparkline` — `sparkline.tsx`

- **For:** a small trend line, drawn in once on first view. Decoration only: the figure beside it carries the meaning.
- **Pick it when:** inside a card or table row next to a number. A full chart with axes is a `TrendChart`.
- **Key props:** `values`, `tone` (`gain`, `loss`, `neutral`), `width`, `height`, `draw`.
- **Used by:** kit-internal: `kpi-card.tsx`, `domain/machine-table.tsx`, `domain/machine-detail.tsx`.

### `TrendChart` — `trend-chart.tsx`

- **For:** a line chart over time with a hover crosshair, drawn through the chart door from the engine's numbers.
- **Pick it when:** a trend over time needs its own card. For any other chart the engine sends as a spec, use `ChartCard`.
- **Key props:** `data` (`TrendData`): `title`, `sub`, `aria`, `categoryLabel`, `valueLabel`, `categories`, `series` (`name`, `values`, `tone`).
- **Used by:** compare, footprint; gallery.

### `ChartCard` — `chart-card.tsx`

- **For:** a chart the engine sent (bars, lines, bubbles) in a card with its title, one quiet line and a sentence for screen readers. Nothing is recomputed. With no `drill` it takes its screen's default from the destinations map (ADR 0058): "Show the rows" (named in full aloud: "BD hours by cell: show the rows behind …") or "Open <page>" beside the title. The control stays in the header, not the whole card, so the chart's own hover (tooltip, crosshair) keeps working.
- **Pick it when:** the engine gives a chart spec. Add `drill` to put a rows-behind button by the title and `numbers` to add "Show the numbers" under it.
- **Key props:** `spec`, `sub`, `aria`, `drill`, `numbers`.
- **Used by:** dashboard, energy, money-matters, monthly-report, printed-page, shift-kpis.

### `ChartNumbers`, `NumbersTable` — `chart-numbers.tsx`

- **For:** the numbers a chart plots as a table (categories down, series across). `ChartNumbers` wraps it in a closed "Show the numbers" disclosure and builds the table only when opened; `NumbersTable` is the bare table.
- **Pick it when:** a chart must not rely on colour and shape alone. Inside a `ChartCard`, pass `numbers` instead.
- **Key props:** `spec`.
- **Used by:** annual-report, monthly-report, problem-analysis; kit: `chart-card.tsx`.

### `Pareto` — `pareto.tsx`

- **For:** "where the hours go": bars biggest first with a running total to 100 %, a line after the few that matter, and the conclusion with its Why.
- **Pick it when:** a few causes take most of the total. A plain ranked list without the cumulative line is `RankedBars`.
- **Key props:** `data` (`ParetoData`: `bars` with `label`, `hours`, `shown`, `drill`; `top`; `total`; `aria`; `conclusion`; `why`), `whyLabel`, `actions`.
- **Used by:** gallery only.

### `BulletBar`, `BulletLegend` — `bullet-bar.tsx`

- **For:** one figure against its target and last month on a single bar, with a met / not-met verdict and its Why. `BulletLegend` explains the marks once for a group of bars.
- **Pick it when:** "are we on target, and better than last month?". A figure without a target is a `KpiCard`.
- **Key props:** `b` (`BulletData`: `label`, `shown`, `unit`, `value`, `target`, `lastMonth`, `scale`, `higherIsBetter`, `met`, `verdict`, `aria`, `why`, `drill`); legend: `words`.
- **Used by:** gallery only.

### `RankedBars` — `ranked-bars.tsx`

- **For:** a ranked list with a bar per row, each row's share, an optional count and money, a line after the rows that make up half the total, and an "everything else" row last.
- **Pick it when:** "which few items carry most of it" in a compact list. For a table with search and sort use `DataTable`; for a cumulative-line chart use `Pareto`.
- **Key props:** `rows` (`key`, `label`, `value`, `valueText`, `countText`, `moneyText`, `rest`), `label`.
- **Used by:** dashboard, monthly-report, problem-analysis, shift-kpis; kit: `domain/heat-matrix.tsx`.

### `BubblePlot` — `bubble-plot.tsx`

- **For:** a bubble chart the reader can explore: hover for a tooltip, press to open, zoom and pan. Bubbles are not tab stops; the table under it is the keyboard's way in.
- **Pick it when:** only where it already lives (the dashboard's machine map). ADR 0036 R21 replaces new bubble charts with `Quadrant`.
- **Key props:** `dots` (`BubbleDot`), `words`, `onOpen(dot)`, `resetKey` (changes reset the zoom).
- **Used by:** dashboard.

### `Quadrant` — `quadrant.tsx`

- **For:** a four-quadrant chart: points placed on two axes, two split lines, each quadrant named, and the points that matter labelled: the often-and-long ones, then the three biggest by x × y, at most six. `placeLabels` (in `bubble-math.ts`) keeps every label clear of every other label and every dot, with a leader line when one moves off its dot's line; a long name is cut with "…" and keeps the whole name on hover. Every point is in the card's "Show the numbers" for the keyboard.
- **Pick it when:** sorting things by two measures at once (frequent and long, rare and short). Replaces bubble charts for new work.
- **Key props:** `points` (`key`, `label`, `x`, `y`), `split {x, y}`, `names` (one per quadrant), `axis {x, y}`, `aria`.
- **Used by:** problem-analysis.

### `EventStrip` — `event-strip.tsx`

- **For:** ninety days as 30 small bars of three days each; a bar is taller for each event in it.
- **Pick it when:** showing how often something happened lately, inline in a row.
- **Key props:** `days` (event day numbers, 0 oldest, 89 today), `label`, `caption`.
- **Used by:** kit-internal: `domain/decision-row.tsx`, `domain/decision-detail.tsx`.

### `DataTable` — `data-table.tsx`

- **For:** the kit's table when all rows are in the browser: search, filter chips, optional dropdown filters, sort, ten rows a page, sticky header, numbers right-aligned. A row opens the drawer: its screen's `onOpen`, or, left out, the machine, cell, person or decision the row names (`row-entity.ts`, `entityOfRow`: the row's `entity`, `machine`, `chip` or `decision`, its first `chips`, or the first chip in its `cells`; UX rule 18, ADR 0058). Rows re-flow when filters change. Under 10 rows it drops search and pager. It can open with a takeaway line, expand a row in place, and carry a total footer.
- **Colours itself (ADR 0060):** each `Column`'s `look` decides its cells. A number column with a meaning gets a bar scaled to the column (a tint in a table with more than eight of them, a month grid); the column the table is ranked by (the chosen sort, else the measure, else the coloured column the rows already run down) marks its top three rows in the meaning's colour and weight (loss red, gain green). A `category` column's words are pills in their fixed colour. `plain` (and no look) stays as it is. No raw float prints.
- **Pick it when:** any list of rows the page already holds. If the server pages the rows, use `PagedTable`; if the engine printed the table, use `domain/EngineTable` or `domain/PrintedDataTable`, which wrap this one.
- **Key props:** `rows`, `rowKey`, `rowLabel`, `columns` (`Column`), `filters` (`FilterChip`), `text` (what search matches), `words`, `initialSort`, `selected`, `headed`, `aside`, `onOpen`, `takeaway`, `expand`, `total`, `selects`, `more`.
- **Used by:** action-center, data-checklist, fix-finder, pm-calendar, settings-audit, settings-lists, team-focus, why-why; kit: `crud-page.tsx`, `domain/engine-table.tsx`, `domain/machine-table.tsx`, `domain/printed-table.tsx`, `domain/rows-behind.tsx`.

### `PagedTable` — `paged-table.tsx`

- **For:** the same table look when the rows live on the server: search, chips, selects and sort ask the server; the table never holds more than the page it shows.
- **Pick it when:** the list is too long to load whole (a log with thousands of rows). Otherwise `DataTable`.
- **Key props:** `rows`, `rowKey`, `columns`, `filters`, `chip` + `onChip`, `query` + `onQuery`, `sort` + `onSort`, `selects`, `page`, `total` or `hasNext`, `onPage`, `loading`, `words`, `onOpen`, `extra`, `foot`, `takeaway`, `expand`.
- **Used by:** action-center, breakdown-log.

### Table parts — `table-parts.tsx` (`TableHead`, `TablePager`, `TableBar`, `MeasureCell`, `ExpandButton`, `FoldRow`)

- **For:** the pieces both tables are built from: the sortable sticky header, the "1–10 of 125" pager, the title / search / chips bar, a number cell with a share bar, a row's expand button, and the folded "show the rest" line.
- **Pick it when:** never in a screen; use `DataTable` or `PagedTable`.
- **Key props:** e.g. `TableBar`: `title`, `sub`, `aside`, `search`, `query`/`onQuery`, `chips`/`chip`/`onChip`, `hideSearch`; `TablePager`: `showing`, `page`, `pages`, `onPage`.
- **Used by:** kit-internal: `data-table.tsx`, `paged-table.tsx`.

### `Verdict` — `verdict.tsx`

- **For:** the page's answer at the top: a context line, the headline sentence, a status chip (good / watch / bad), and its Why.
- **Pick it when:** every analysis page opens with one. A one-line insight over a single table or chart is a `Takeaway`.
- **Key props:** `verdict` (`context`, `headline`, `why`, `status`), `whyLabel`.
- **Used by:** action-center, age, annual-report, breakdown-log, cell-change-log, compare, dashboard, data-checklist, energy, fix-finder, footprint, machine, machines-register, money-matters, monthly-report, oem, pm-calendar, printed-page, problem-analysis, shift-kpis, team-focus, why-why.

### `Points`, `Segs` — `points.tsx`

- **For:** typed rich text: a sentence split into pieces, each with a meaning tone (`loss`, `gain`, `risk`, `plan`, `decide`, or `strong` for bold) or an entity chip. `Points` prints a list of them; `Segs` prints one.
- **Pick it when:** any sentence from the model that colours words or names a machine. Plain text needs no wrapper.
- **Key props:** `points` (list of `Point`), `well` (sits in a tinted well); `Segs`: `point`.
- **Used by:** action-center, compare, dashboard, data-checklist, pm-calendar, team-focus; kit: `verdict.tsx`, `pareto.tsx`, `why-toggle.tsx`, `domain/check-row.tsx`, `domain/decision-row.tsx`, `domain/decision-detail.tsx`, `domain/machine-detail.tsx`.

### `Takeaway`, `ExpandRow` — `takeaway.tsx`

- **For:** `Takeaway` is the one-line insight at the top of a table, chart or section: a tone pill (icon and word) then the sentence; it can name the outlier row to mark. `ExpandRow` is a row that opens in place to show its breakdown.
- **Pick it when:** every table and chart should say what to notice (UX rule 60); tables take it as their `takeaway` prop. The page-level answer is a `Verdict`.
- **Key props:** `data` (`text`, `tone` of `loss`/`risk`/`gain`/`neutral`, `tag`, `outlier`); `ExpandRow`: `head`, `label`, `defaultOpen`.
- **Used by:** most screens (28 folders, from action-center to ticket); kit: `data-table.tsx`, `paged-table.tsx`.

### `KeyPill` — `key-pill.tsx`

- **For:** a small coloured pill with a word and optional icon. Always means something; the word says it, not just the colour.
- **Pick it when:** a tag or status on a row or card. For a status from the shared status list use `StatusPill`; for a thing that opens use `EntityChip`.
- **Key props:** `text`, `tone` (`loss`, `gain`, `risk`, `plan`, `decide`, `neutral`), `icon`, `cat` (1 to 5: a category's fixed colour as a dot before the word, from `catOf`).
- **Used by:** action-center, annual-report, board, breakdown-log, compare, desk-settings, guide, machine, pm-calendar, settings, settings-audit, settings-lists, settings-people, settings-plant, team-focus, ticket, why-why; and many kit parts.

### `StatusPill` — `status-pill.tsx`

- **For:** a ticket or machine status (any group in the shared status list) as a v2 pill: its icon and its word, red only for a loss, amber to watch, blue for planned work.
- **Pick it when:** showing a stored status such as a ticket's state. A free-form tag is a `KeyPill`.
- **Key props:** `group`, `id`.
- **Used by:** desk, floor; kit: `floor-kit.tsx`.

### `EntityChip` — `entity-chip.tsx`

- **For:** the name of a machine, cell, person or decision anywhere on a page, as a chip with its icon (and a machine's type or segment colour). Pressing it opens that thing in the drawer.
- **Pick it when:** every time a screen names one of those four things.
- **Key props:** `kind` (`machine`, `cell`, `person`, `decision`), `id`, `label`, `cat` (type colour 1–5), `seg` (segment; wins over `cat`).
- **Used by:** action-center, board, breakdown-log, dashboard, data-checklist, desk-settings, entity, fix-finder, machine, pm-calendar, settings-people, team-focus, why-why; most domain parts and `points.tsx`.

### `ReasonChips` — `reason-chip.tsx`

- **For:** small reason tags in a table cell ("Repeat", "Long ×3").
- **Pick it when:** a row needs to say why it is listed. A meaning-coloured tag is a `KeyPill`.
- **Key props:** `reasons` (`text`, `n`).
- **Used by:** action-center.

### `SeverityRow` — `severity-row.tsx`

- **For:** how many issues sit at each severity: high, medium, low, good. Zero is shown as a real count.
- **Pick it when:** a page ranks issues and wants the totals up top (ADR 0036 R3).
- **Key props:** `counts {high, medium, low, good}`.
- **Used by:** desk-settings.

### `ReviewMarker` — `review-marker.tsx`

- **For:** the data-trust marker (ADR 0036 R5): "N rows held for review", linking to the review tray, when a page's figures skip held rows. Draws nothing at zero.
- **Pick it when:** a page's figures leave out rows that are waiting for review.
- **Key props:** `count`, `href`.
- **Used by:** none yet (built, not placed on a screen).

---

## 4. Inputs and forms

### `Button`, `LinkButton` — `button.tsx`

- **For:** the kit's button, 44 px tall, presses down slightly. `primary` is the one accent action of its card; the rest are quiet. `LinkButton` is the same look for a link.
- **Pick it when:** any action. Something that ends or removes on the floor is `DangerButton` (floor-kit).
- **Key props:** `primary`, `disabled`, `onClick`; `LinkButton`: `href`.
- **Used by:** action-center, cell-change-log, compare, dashboard, desk, floor, machine, password, pm-calendar, settings, sign-in, team-focus, ticket, who; many kit parts.

### `Segmented` — `segmented.tsx`

- **For:** a row of mutually exclusive choices; the chosen one is pressed.
- **Pick it when:** two to about four options. More than a row holds is a `SelectField`.
- **Key props:** `label`, `options` (`key`, `label`), `value`, `onChange`.
- **Used by:** action-center, board, compare, desk, machines-register, manpower, and the shared `live-frame.tsx` and `section-tabs.tsx`; kit: `account-sheet.tsx`, `form-sheet.tsx`, `period-toggle.tsx`, `domain/plant-map.tsx`.

### `PeriodToggle` — `period-toggle.tsx`

- **For:** the page's one period (ADR 0036 R4): "so far this year" or "full year", as a `Segmented`. `periodFrom(search)` reads it from the URL.
- **Pick it when:** a page lets the reader switch the year basis.
- **Key props:** `value` (`sofar` or `full`), `onChange`.
- **Used by:** none yet (built, not placed on a screen).

### `SelectField` — `select-field.tsx`

- **For:** a labelled dropdown with "All" first, then the options.
- **Pick it when:** a filter with more options than a row of chips holds. Few options: `Segmented`.
- **Key props:** `label`, `all`, `value`, `options`, `onChange`.
- **Used by:** action-center, dashboard, settings-audit, who; kit: `data-table.tsx`, `form-sheet.tsx`.

### `DateField` — `date-field.tsx`

- **For:** a labelled day field using the browser's own date control, so phones, keyboards and screen readers work natively. Enter submits the form around it.
- **Pick it when:** choosing a day.
- **Key props:** `label`, `value`, `onChange`, `inputRef`, `children` (confirm / cancel beside it).
- **Used by:** pm-calendar, settings-audit; kit: `form-sheet.tsx`.

### `FormSheet`, `Field` — `form-sheet.tsx`

- **For:** a form in the right drawer: title, labelled fields (text, multi-line, time, date, or a choice shown as a bar for up to four options and a menu for more), submit, and the server's refusal line. Submit waits while sending, offline, or with a required field empty.
- **Pick it when:** add / edit a record from a desk page. A multi-step flow on the floor is a `Wizard`.
- **Key props:** `open`, `onOpenChange`, `title`, `submitLabel`, `fields` (`FormField`), `offlineAllowed`, `pending`, `error`, `onSubmit`, `initial`, `description`, `actingAs`, `backLabel`, `note`, `blocked`, `footnote`.
- **Used by:** ticket; kit: `crud-page.tsx`.

### `Wizard` — `wizard.tsx`

- **For:** a short step-by-step flow: one primary action per step, a back button in the header, "Step n of total", an offline block, a send error, then a result screen.
- **Pick it when:** a floor task that is best done one question at a time (raise a ticket). A single-screen form is a `FormSheet`.
- **Key props:** `title`, `steps` (`title`, `lead`, `body`, `action`, `ready`, `back`, `onBack`), `offlineAllowed`, `onFinish`, `result`, `aside`, `quietOnline`, `start`.
- **Used by:** floor.

### `CrudPage` — `crud-page.tsx`

- **For:** a whole settings list page generated from one spec: heading, add button, the list (as a `DataTable` with chips and status), edit and switch on/off sheets, and optional bulk actions. Never deletes.
- **Pick it when:** a settings register (people, lists, plant, upkeep). Describe the page in a `CrudSpec`; do not hand-build the list.
- **Key props:** `spec` (`CrudSpec`), `lead` (the takeaway under the heading).
- **Used by:** settings-lists, settings-people, settings-plant, settings-upkeep.

### `BulkBar` and the CRUD hooks — `crud-actions.tsx` (with `crud-model.ts`)

- **For:** the working parts behind `CrudPage`: `useSave` (the add / edit sheet with one idempotency key per opening and the server's refusal), `useSwitch` (switch off asks for a reason, switch on may ask for a value), `useBulk` (ticked rows and one bulk action, where one row's refusal does not stop the others), and `BulkBar` (one button per bulk action). `crud-model.ts` holds the pure rules: `FormField`, `FormSheetProps`, which fields a sheet shows, `missingRequired`, and `submitHeld` (why a submit waits: offline, pending, missing or blocked).
- **Pick it when:** never in a screen; use `CrudPage`.
- **Key props:** `BulkBar`: `spec`, `count`, `onPick`.
- **Used by:** kit-internal: `crud-page.tsx`.

### `MoreToggle` — `more-toggle.tsx`

- **For:** "and 18 more": a button that opens the rest of a list in place, so a short list never hides how long it is.
- **Pick it when:** a list shows its first few items. A whole section kept below the fold is `ShowDetail`.
- **Key props:** `label`, `children`.
- **Used by:** dashboard.

### `WhyToggle`, `WhyButton`, `WhyPanel`, `useWhy` — `why-toggle.tsx`

- **For:** the "Why?" pill and the explanation it opens. `WhyToggle` puts both together; `WhyButton` and `WhyPanel` (sharing `useWhy()`) let the button sit in one place and the text in another.
- **Pick it when:** a claim needs its reasoning on demand. `Verdict`, `Pareto` and `BulletBar` already include one.
- **Key props:** `label`, `points`; split form: `why`, `well`.
- **Used by:** dashboard, energy; kit: `verdict.tsx`, `pareto.tsx`, `bullet-bar.tsx`, `more-toggle.tsx`, `domain/check-row.tsx`, `domain/decision-row.tsx`.

### `ShowDetail` — `show-detail.tsx`

- **For:** what a section keeps below the fold (ADR 0036 R1): a closed "Show detail" disclosure.
- **Pick it when:** secondary detail that should not crowd the first view. A list tail is `MoreToggle`; one row's breakdown is `ExpandRow`.
- **Key props:** `label` (default "Show detail"), `children`.
- **Used by:** annual-report, bd-pm, bottleneck, category-cell, dashboard, energy, fix-finder, forecast-lab, manpower, monthly-report, mttr-mtbf, pm-calendar, problem-analysis, shift-kpis; kit: `tile-set.tsx`.

### `DrillButton` — `drill-button.tsx` (with `drill.ts`)

- **For:** the small control by a table or chart that opens the rows behind its figure in the drawer. `drill.ts` defines a `Drill` (`figure` key and spoken `label`) and `DrillOpenContext`, which `EntityShell` fills; and the destinations seam (ADR 0058): `Destination` (`drill` or `link`), `DestinationContext` (filled by `LiveFrame`'s `DestinationScope` from `screens/v2/destinations.ts`), `useDestination` (a card's own drill or link wins, else the map) and `stretchOf`.
- **Pick it when:** a chart or table's figure can show its rows. On a KPI, figure tile, Pareto bar or bullet bar, pass `drill` to that part instead.
- **Key props:** `drill`.
- **Used by:** dashboard; kit: `chart-card.tsx`.

### `DrillAction`, `Section` — `drill-action.tsx`

- **For:** `DrillAction` is a page-level "rows behind" control, for pages whose cards each count something narrower than the rows the engine named. `Section` is a titled part of a screen that is not itself a card: title, quiet line, an action on the right, then content.
- **Pick it when:** `DrillAction` when the rows belong to the page, not one card. `Section` for a titled stretch of page; a card is a `Panel`.
- **Key props:** `DrillAction`: `drill`; `Section`: `title`, `sub`, `action`, `children`.
- **Used by:** age, annual-report, data-checklist, energy, machines-register, money-matters, monthly-report, pm-calendar, printed-page, shift-kpis, team-focus, why-why.

### `DownloadExcel` — `download-excel.tsx`

- **For:** "Download Excel" (ADR 0036 R6): builds the .xlsx in the browser from exact values (the page rounds, the file never does), with the page's document number on the first row of every sheet.
- **Pick it when:** a table or report the plant will want in Excel.
- **Key props:** `file` (name without extension), `sheets`, `docRef`.
- **Used by:** action-center, bottleneck, breakdown-log, forecast-lab, machines-register, pm-calendar, problem-analysis, team-focus.

### `TickRow` — `tick-row.tsx`

- **For:** one step to tick: a 52 px row around a real checkbox; locked and still ticked while the work is being sent.
- **Pick it when:** a checklist of steps on a ticket. On the floor's own pages use floor-kit's `CheckRow`.
- **Key props:** `label`, `checked`, `disabled`, `onChange`.
- **Used by:** ticket.

### Close screen parts — `close-kit.tsx` (`FinishTime`, `ScreenFooter`, `Field`, `ChoiceField`, `CodePicker`, `FactRows`, `MinuteTiles`)

- **For:** the pieces of the ticket's close screens: "When did you finish?" with earlier / now / later steps, a footer pinned to the bottom with a hint over the one button, a labelled control, a labelled choice with an empty first option, a searchable code list with this login's last 5 codes first (`CodePicker`; `pickerGroups` is its pure filter), label-and-value fact rows, and three small figure tiles.
- **Pick it when:** building a ticket close step. A general form is a `FormSheet`.
- **Key props:** `FinishTime`: `time`, `status`, `earlier`/`now`/`later`, `canEarlier`/`canNow`/`canLater`, `isNow`, `onEarlier`/`onNow`/`onLater`; `ChoiceField`: `id`, `label`, `value`, `options`, `onChange`, `empty`; `CodePicker`: the same plus `recent` (codes used last, newest first) and the search box's words.
- **Used by:** ticket.

### `AccountSheet`, `AccountButton`, `SignOutPrompt` — `account-sheet.tsx`

- **For:** the account panel for faces without the Shell (the floor, the desk, the person picker): who is signed in or acting, change person on a shared phone, switch Desk / Floor, language, alerts, change password, and sign out behind one question. `AccountButton` is the "Account" button that opens it and keeps the phone's alerts on the acting person.
- **Pick it when:** a page outside the Shell needs the account controls.
- **Key props:** `AccountSheet`: `open`, `onOpenChange`; `AccountButton`: `onClick`; `SignOutPrompt`: `onCancel`, `onConfirm`.
- **Used by:** desk, floor, who.

### `DraftsList` — `drafts-list.tsx`

- **For:** "Needs attention": actions saved offline that the server later refused, each with why and a Dismiss. Never silently dropped; checked again on a timer.
- **Pick it when:** on any page that sends offline-queued work (the floor, the desk).
- **Key props:** none.
- **Used by:** desk, floor.

---

## 5. Feedback and states

### `ScreenStates`, `Skeleton`, `ErrorState`, `OfflineState`, `RefusedState`, `NotComputedState`, `SavedCopyNotice`, `EmptyState` — `screen-states.tsx`

- **For:** what a screen shows while its data is not plainly ready: grey loading blocks, a failure with Try again, offline with Try again, "not allowed", "not computed yet", a notice that a saved copy is shown, and an empty line. `ScreenStates` picks the right one from a load state and renders the screen only when the model is ready.
- **Pick it when:** every screen wraps its body in `ScreenStates`. On the floor use `FloorStates` (floor-kit).
- **Key props:** `loaded` (`state`, `model`, `retry`), `emptyText`, `children(model)`; `Skeleton`: `blocks`; `ErrorState`/`OfflineState`: `onRetry`.
- **Used by:** action-center, board, breakdown-log, cell-change-log, compare, desk, entity, floor, machine, pm-calendar, settings, settings-audit, settings-lists, shift-kpis, ticket, who, and the shared `live.tsx` / `live-frame.tsx`; kit: `crud-page.tsx`, `floor-kit.tsx`, `domain/rows-behind.tsx`.

### `Banner` — `banner.tsx`

- **For:** a strong line at the top of a page that leads somewhere: tone icon and tag, title, a sentence, and a link with its own words.
- **Pick it when:** something needs attention and has a page to go to. With no link, use `Notice`.
- **Key props:** `tone` (`loss`, `risk`, `plan`, `neutral`), `icon`, `tag`, `title`, `href`, `action`, `children`.
- **Used by:** dashboard.

### `Notice`, `ErrorNotice` — `notice.tsx`

- **For:** a banner's look for a line that goes nowhere: icon, title, sentence, optional button. A `loss` is announced at once, the rest politely. `ErrorNotice` shows the server's refusal of the last attempt, and nothing when there is none.
- **Pick it when:** a message with no destination (sign-in failed, update available). With a link, use `Banner`; on the floor, `FloorNote`.
- **Key props:** `tone`, `icon`, `title`, `action`, `children`; `ErrorNotice`: `error`.
- **Used by:** desk, password, sign-in, ticket, who; kit: `update-banner.tsx`.

### `UpdateBanner` — `update-banner.tsx`

- **For:** "a new version is ready": waits for a tap on Update, and stays quiet during the shift changeover so it never interrupts a handover. A wall TV (`auto`) updates itself once the changeover is over.
- **Pick it when:** never in a screen; the app frame shows it.
- **Key props:** `auto`.
- **Used by:** the app frame (`apps/web/src/App.tsx`), not a screen folder.

### `SyncStatus` — `sync-status.tsx`

- **For:** a pill saying whether this device is online, sending what it queued, or holding a draft; changes are announced.
- **Pick it when:** a desk page that sends work which can queue offline. On the floor use floor-kit's `SyncLine`, which hides itself while online.
- **Key props:** none.
- **Used by:** board, desk.

### `AlertsCard`, `usePushBinding` — `alerts-card.tsx`

- **For:** the phone alerts control: Off, On, Blocked by the browser, or Not available, with a headline and line for each, and a way to turn them on, off or test. `usePushBinding` keeps alerts on whoever is acting now, even with the sheet shut.
- **Pick it when:** never directly; it lives inside `AccountSheet`.
- **Key props:** `personId`.
- **Used by:** kit-internal: `account-sheet.tsx`.

### `ActionStrips` — `action-strip.tsx`

- **For:** up to three slim strips at the top of a page, each "N things need attention" with a link, ordered high, medium, low; strips at zero are dropped (ADR 0036 R2).
- **Pick it when:** a page wants to point at queues elsewhere. One strong message is a `Banner`.
- **Key props:** `strips` (`key`, `count`, `what`, `href`, `link`, `severity`).
- **Used by:** dashboard.

---

## 6. Domain pieces

### `FloorPanel`, `FloorStates`, `FloorTabs`, `SyncLine`, `MachineRow`, `MachineCard`, `GroupSection`, `GroupTile`, `ChoiceCard`, `QuickChip`, `FloorNote`, `Line`, `FieldLabel`, `TextInput`, `TextArea`, `SelectBox`, `CheckRow`, `DangerButton`, `Actions` — `floor-kit.tsx`

- **For:** the technician's phone pages (the floor) on the kit: a page with optional back button and step count, its not-ready states, the bottom tab bar, the sync line, machine rows, cards and group tiles, big one-tap choice cards, round quick chips, a note with no link, plain / quiet / failure text lines, bare form controls, a full-width tick row, a red-word button for ending or removing, and stacked full-width buttons.
- **Pick it when:** building any floor (phone) page. These replace `Panel`, `ScreenStates`, `Notice` and `SyncStatus` there, because the floor has no Shell.
- **Key props:** `FloorPanel`: `title`, `back`, `aside`, `quietOnline`; `FloorStates`: `state`, `empty`, `onRetry`; `FloorTabs`: `label`, `tabs`, `current`; `ChoiceCard`: `icon`, `tone`, `title`, `detail`, `onClick`; `MachineCard`: `code`, `label`, `detail`, `status`; `FloorNote`: `tone`, `title`, `action`; `Actions`: `pair`.
- **Used by:** floor; kit: `wizard.tsx`, `account-sheet.tsx`.

### `EngineTable` — `domain/engine-table.tsx`

- **For:** a table the engine sent, in the kit's `DataTable`: search over every cell, a chip per common value of one column, sort everywhere, ten a page. A cell naming a machine or cell is a chip, and its row opens that thing.
- **Pick it when:** showing an engine table on an analysis screen. A printed report table is `PrintedDataTable`.
- **Key props:** `table` (`TableModel`), `onAction`, `aside`.
- **Used by:** age, cell-change-log, dashboard, footprint, machine, machines-register, oem.

### `PrintedDataTable` — `domain/printed-table.tsx`

- **For:** any table the engine printed for a report, as the kit's table: every column, sortable in the order its numbers and dates carry, searchable, ten a page, machines and people as chips. A row opens the first machine (or person) it names.
- **Pick it when:** report-style pages. An interactive analysis table is `EngineTable`.
- **Key props:** `table` (`PrintedTable`), `words`, `selected`.
- **Used by:** annual-report, compare, money-matters, monthly-report, printed-page, problem-analysis, shift-kpis.

### `RowsBehind` — `domain/rows-behind.tsx`

- **For:** the drawer view of a figure: the figure and its exact value, the rows it counted, and where they came from. Loading, error and "counts nothing" use the kit's states.
- **Pick it when:** never directly; `EntityShell` shows it for `?drawer=figure:<key>`.
- **Key props:** `loaded`, `words`.
- **Used by:** entity (`EntityShell`).

### `MachineDetail` — `domain/machine-detail.tsx`

- **For:** a machine in the drawer: its state and why, its hours, its breakdowns, its 12-week trend; empty parts are left out.
- **Pick it when:** the drawer for a machine (the entity drawer picks it).
- **Key props:** `m`, `words`, `source`.
- **Used by:** entity.

### `CellDetail` — `domain/cell-detail.tsx`

- **For:** a cell in the drawer: its machine count, how many are in each state (worst first), this month's breakdown hours, and the worst machines as chips.
- **Pick it when:** the drawer for a cell.
- **Key props:** `c` (`name`, `machineCount`, `mix`, `hours`, `worst`), `words`, `source`.
- **Used by:** entity.

### `PersonDetail` — `domain/person-detail.tsx`

- **For:** a person in the drawer: what they are on now as chips, and this month's jobs and hours.
- **Pick it when:** the drawer for a person.
- **Key props:** `p` (`name`, `role`, `now`, `jobs`, `hours`), `words`, `source`.
- **Used by:** entity.

### `DecisionDetail` — `domain/decision-detail.tsx`

- **For:** a decision in full in the drawer: what it is, what it is worth, its 90 days, the whole story, and the action button.
- **Pick it when:** the drawer for a decision.
- **Key props:** `d` (`DecisionData`), `words`, `source`, optional decide / undo callbacks.
- **Used by:** entity, team-focus.

### `DecisionRow`, `DecisionAction` — `domain/decision-row.tsx`

- **For:** one decision in a list: kind pill, machines as chips, title, key pills, a Why, hours and money, a 90-day `EventStrip`, the owner, and the action. `DecisionAction` is the action button alone (with its done state).
- **Pick it when:** inside `DecisionList`; use `DecisionAction` where only the button is needed.
- **Key props:** `d` (`id`, `kind`, `kindLabel`, `codes`, `title`, `keys`, `why`, `hours`, `money`, `days`, `action`, `owner`, `detail`, `decided`), `words`, `selected`, `onOpen`.
- **Used by:** team-focus; kit: `domain/decision-list.tsx`, `domain/decision-detail.tsx`.

### `DecisionList` — `domain/decision-list.tsx`

- **For:** the decisions waiting for an owner, biggest first, under a count that is announced when it changes.
- **Pick it when:** listing decisions on a page.
- **Key props:** `decisions`, `words`, `selected`, `onOpen`, decide / undo callbacks.
- **Used by:** team-focus; gallery.

### `CheckRow` — `domain/check-row.tsx`

- **For:** one data-quality check: a status pill (a gap that changes a figure now, or a check worth a look), what is wrong, which figure it changes, how many records to fix, the owner chip, a Why, and one fix button with undo.
- **Pick it when:** the data checklist. (Not the floor's tick row, which is floor-kit's `CheckRow`.)
- **Key props:** `c` (`CheckData`), `words`, `onFix`, `onUndo`.
- **Used by:** data-checklist.

### `CompareBox` — `domain/compare-box.tsx`

- **For:** one side of a comparison: the thing as a chip, a quiet line, and its figures. Two boxes in a `Row` line up figure for figure; the "ahead" mark uses words and an icon, not colour alone.
- **Pick it when:** comparing two machines or cells side by side.
- **Key props:** `box` (`chip`, `sub`, `figures`).
- **Used by:** compare.

### `FactList` — `domain/fact-list.tsx`

- **For:** a thing's facts, each a label over its value, as many to a row as fit; a note under what it explains.
- **Pick it when:** a machine's plain facts.
- **Key props:** `facts` (`id`, `label`, `value`, `note`).
- **Used by:** machine.

### `DetailSection`, `DetailFigure`, `SourceLine` — `domain/detail-parts.tsx`

- **For:** the shared parts of detail views: a labelled section, a single figure with its label and note, and the "where this came from" line.
- **Pick it when:** composing a drawer or detail block, or putting a source line under a page.
- **Key props:** `DetailSection`: `label`; `DetailFigure`: `label`, `value`, `note`; `SourceLine`: `text`.
- **Used by:** action-center, age, annual-report, breakdown-log, cell-change-log, compare, dashboard, data-checklist, energy, fix-finder, footprint, machine, machines-register, money-matters, monthly-report, oem, pm-calendar, printed-page, problem-analysis, shift-kpis, team-focus, why-why; kit: the four `…Detail` parts and `rows-behind.tsx`.

### `HeatMatrix` — `domain/heat-matrix.tsx`

- **For:** the engine's matrix (rows by months) with each cell tinted by weight; every cell prints its figure, an empty month is a dash, a legend says which way the tint runs, and rows naming a machine or cell are chips.
- **Pick it when:** a grid where the pattern across months matters. A grid of single tiles is `HeatTiles`.
- **Key props:** `matrix` (`id`, `title`, `header`, `rows`), `words {low, high}`.
- **Used by:** annual-report, energy, monthly-report, shift-kpis.

### `HeatTiles` — `domain/heat-tiles.tsx`

- **For:** a load map: one tile per item with its figure, an optional running load, lines under it and a tint step; a tile can open its rows.
- **Pick it when:** comparing many items at a glance by weight.
- **Key props:** `title`, `tiles` (`name`, `value`, `unit`, `running`, `lines`, `level`, `summary`, `drill`), `words`, `scale`.
- **Used by:** energy.

### `MachineTable` — `domain/machine-table.tsx`

- **For:** every machine worst first: identity, state, this month's breakdown hours, 90-day breakdowns and a 12-week trend.
- **Pick it when:** a full machine register with trends. A general engine table is `EngineTable`.
- **Key props:** `machines`, `words`, `selected`, `onOpen`.
- **Used by:** gallery only.

### `PlantMap` — `domain/plant-map.tsx`

- **For:** every machine as a square in its cell's row; one tab stop with arrow keys inside, a filter that dims the rest, a glyph on every non-running state so colour is never alone. A tap opens the machine in the drawer.
- **Pick it when:** a whole-plant view of machine states.
- **Key props:** `cells`, `words`, `selected`, `onOpen`.
- **Used by:** gallery only.

### `MonthCalendar` (default export) — `domain/month-calendar.tsx`

- **For:** the one door to the calendar library: a month grid of jobs styled with v2 tokens, drag to move a job (a refused move snaps back). Loaded lazily so the library only downloads when a calendar is on screen.
- **Pick it when:** the PM calendar. Load it with `React.lazy`; keyboard users get the screen's own job list.
- **Key props:** `events`, `editable`, `initialDate` (the plant's today from the server), `words`, `onMove`, `onRange`, `onOpen`.
- **Used by:** pm-calendar.

### `AckForm` — `domain/ack-form.tsx`

- **For:** acknowledging one nudge: owner (from the plant's people, or nobody), due day and a note. Sends nothing itself.
- **Pick it when:** taking ownership of an Action Center item.
- **Key props:** `words`, `people`, `saving`, `onSave(body)`, `onCancel`.
- **Used by:** action-center.

### `CorrectDate` — `domain/correct-date.tsx`

- **For:** correcting one date: a labelled date field, Save and Cancel, and the server's refusal in words. Changes nothing itself.
- **Pick it when:** fixing a wrong date on a record (cell change log).
- **Key props:** `words`, `sub`, `initial`, `pending`, `error`, `onSave(day)`, `onCancel`.
- **Used by:** cell-change-log.

### `WhyForm` — `domain/why-form.tsx`

- **For:** the five-whys form for a breakdown: five answers and a conclusion, with save, PDF and cancel.
- **Pick it when:** recording a why-why analysis.
- **Key props:** `words`, `heading`, `author`, `initial`, `completed`, `saving`, `saved`, `onSave`, `onPdf`, `onCancel`.
- **Used by:** why-why.
