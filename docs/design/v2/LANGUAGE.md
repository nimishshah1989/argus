# The v2 language and the screen recipe

How a v2 screen looks and how to build one. **`UX-RULES.md` is the source of truth** for how information behaves;
this page applies it to the kit in `apps/web/src/ui/v2/`. [`KIT.md`](KIT.md) is the catalogue of every kit part: what
it is for, when to pick it, its key props and the screens that use it.

**Mockups.** Mockup figures and interactions are illustrative and sometimes inconsistent. Screens compute every figure
from their fixture, and fixture tests enforce the totals. The mockups in `mockups/` and `dashboard-approved.dc.html`
show layout and behaviour; where they differ from this page on sizes, weights or motion, this page wins.

## Look

- **Canvas.** White page, full width. Content sits in cards: hairline border, soft shadow, 14 px radius. Glass only on what floats (header, drawer, chart tooltip).
- **Type.** Inter for text, Geist for every number (tabular), Geist Mono for machine codes. Self-hosted woff2 in `ui/v2/fonts` (OFL).
- **Sizes.** Five only: 12 labels and tags · 13 secondary · 14 body and table cells · 20 page and drawer title · 24 KPI values.
- **Weights.** 400 text · 500 numbers · 600 titles, emphasis, pills. Never 700. Emphasis with a colour is a highlight; use it sparingly.
- **Colour with meaning only.** Loss red, gain green, risk amber, planned blue, decide purple: each has a text colour, a fill and a tint (`--color-v2-*` in `ui/tokens.css`, light and dark). Machine types have fixed colours (`cat-1..5`). Nothing else is coloured.
- **Spacing.** 16 px between cards and inside a card's edge, 12 px between things in a card. Cards side by side share one grid: same top edge, equal height.
- **Accessibility floor.** Text 4.5:1 and fills 3:1 in both themes (tested). Every target 44 px; pills and tiles stay smaller to the eye and keep a 44 px hit area. Colour never alone: a word or an icon too. A focus ring on everything. Charts are `role="img"` with a sentence for screen readers.

## Behaviour

- **Answer first.** A verdict sentence with a short Why behind a pill, then 2 to 4 KPI cards. Detail lives behind a click: the short Why opens in place; the full story opens in the drawer.
- **Key pointers** are pills visible without clicking (`KeyPill`): a short word on a tint, with an icon when they name a state.
- **Drawer.** One item at a time, 420 px. The page reflows. ✕, Esc or the same item closes it, and focus goes back.
- **Tables.** Search, 2 to 4 filter chips, sort on the meaningful columns, 10 rows a page, sticky header, numbers right, a row opens the drawer.
- **Tables colour themselves** (ADR 0060). Each column declares its `look`: a meaning bars its numbers and marks the top three of the ranked column in that colour (loss red, gain green); a category's words are pills in their fixed colour; ids, dates and plain counts stay plain. A screen never colours a cell by hand.
- **On this page** (ADR 0060). Every titled part of a page is in its index without asking: a sticky rail at the right on a wide screen, a jump menu at the top on a phone, and in ⌘ K search. Give each part a real title; that is the whole job.
- **Chart labels never collide** (ADR 0060). A chart names only the points that matter and places each label clear of every other label and dot; the rest are named on hover and in "Show the numbers"
- **Motion.** Only from `ui/v2/motion.ts` and `motion.css`:
  - numbers tick up on first load and between values on update;
  - charts draw in once;
  - a changed value flashes its direction once;
  - rows re-flow after a filter or sort;
  - the drawer slides in;
  - buttons press to 0.97;
  - a down machine pulses three times.

  UI motion takes 160–240 ms and data motion 500–800 ms, on one ease-out curve. Under reduced motion it is all instant. Nothing fades in because the page loaded.

## The screen recipe

Every screen is three files and one registry line:

```
apps/web/src/screens/v2/<name>/
  model.ts    the typed contract: every figure printed by the engine, every word in the reader's language
  View.tsx    kit-only composition: receives the model and callbacks, holds only UI state (what is open)
  fixture.ts  invented data for the gallery (short constants, no real names; pii:scan checks)
apps/web/src/screens/v2/data.ts   add the key to `Screens` and its provider to `PROVIDERS`
```

- `useScreenModel(key, params)` returns `{ state: 'loading' | 'ready' | 'error' | 'empty', model, retry }`. Today every provider returns its fixture; the API adapter replaces one provider and no View changes.
- Wrap the result in `ScreenStates` inside the shell. The kit draws the skeleton, the error with "Try again" and the empty state.
- **A View uses `EntityShell`, never `Shell`** (`screens/v2/entity/EntityShell.tsx`, same props). It puts the drawer in the URL and fetches any machine, cell, person or decision a chip opens through the `entity` key of `useScreenModel`. A screen that holds an entity live (the Dashboard's decisions, with their Decide button) passes `local`; everything else needs no drawer code. Rows, tables and squares open their item with `useContext(EntityOpenContext)`.
- **Every figure opens the rows behind it.** A KPI card, a Pareto bar and a bullet bar take an optional `drill: { figure, label }` (`ui/v2/drill.ts`): `figure` is the engine's figure key, `label` is what the control is called aloud ("Show the rows behind Total downtime"). With it the value, the bar or a button beside the bar becomes a control that calls `DrillOpenContext`; the shell opens the rows in the drawer, at `?drawer=figure:<key>`, so Back closes it. The rows are the drill reply the v1 screens already use (`GET /analytics/drill`), built into a `RowsBehindModel` by `rowsBehindModel` (the adapter formats, never recomputes). Ten rows a page, search, sort on each column that means something, a chip or the page of what each row is.
- **Every card goes somewhere, enforced (Nimish, 26 Nov 2026; ADR 0058).** "Each and every card will be clickable" is one system, not page by page: `apps/web/src/screens/v2/destinations.ts` is one table that says, for each screen (the `LiveFrame` entry) and each card id, whether the card opens `rows` (an engine figure key; its rows in the drawer) or goes `home` (the screen that explains it), with a `*` default per screen (the rows of the figure the whole page counts, named as that figure in the control). `FIGURE_HOME` gives every engine figure key its page; the rows drawer links to it in its footer ("Open Breakdown log") unless it is the page underneath. `KpiCard`, `FigureTile` and `ChartCard` read the map themselves through `DestinationContext` whenever their model passed no `drill` or `link`, so a new screen is covered the day it is framed. `destinations.test.ts` builds every card-drawing screen's model from its fixture and fails on a card with no destination unless it is on its `NO_DESTINATION` list, which may only shrink.
- **Entities in text are segments.** A sentence names a machine, cell, person or decision with a `Seg` that carries `entity`, so it prints as a chip. In a fixture write `{{machine:TC-12|TC-12}}`, `{{person:neel-s|Neel S}}`; a field that holds the thing itself (a decision's `codes`) holds `EntityChipProps`. Never type a code into a sentence: `ui:check` fails it (add `// ui-allow: entity-code <reason>` for the rare real exception).
- The gallery shows a screen at `/gallery?view=v2-<name>`; `&state=loading|error|empty` previews those states.

**A file under `screens/v2/` must not contain colours, font sizes, font weights or animation.** `pnpm ui:check` fails it. If a screen needs a look the kit lacks, add it to the kit.

## Which kit part to reach for

| Need                                                  | Part                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| App frame: rail, glass header, search, alerts, drawer | `Shell` (`shell.tsx`), `Drawer`                                                                         |
| Where each part of a long page is                     | `OnThisPage`, drawn by the `Shell` from the page's titles: nothing to add                               |
| The answer sentence and its Why                       | `Verdict`, `WhyToggle` / `WhyButton` + `WhyPanel`, `Points` (typed rich text)                           |
| A key figure with delta, meaning, trend               | `KpiCard`, `Sparkline`                                                                                  |
| A titled card; cards side by side                     | `Panel`, `Row` (`cols` 2, 3, 4, or `wide`)                                                              |
| A pointer or a status tag                             | `KeyPill` (with `icon` for a state)                                                                     |
| One action; the quiet ones                            | `Button` (`primary` for the one that matters)                                                           |
| A list of rows with search, chips, sort, pages        | `DataTable` (columns, filters, words)                                                                   |
| A trend over time with crosshair tooltip              | `TrendChart` (through the chart door)                                                                   |
| Against target and last month                         | `BulletBar`, `BulletLegend`                                                                             |
| 90 days of events                                     | `EventStrip`                                                                                            |
| Where the hours go                                    | `Pareto`                                                                                                |
| A choice among a few                                  | `Segmented`                                                                                             |
| Loading, error, empty                                 | `ScreenStates` (`Skeleton`, `ErrorState`, `EmptyState`)                                                 |
| A machine, cell, person or decision, named anywhere   | `EntityChip`; its drawers are the `domain/` `…Detail` parts                                             |
| The rows behind a figure, in the drawer               | `domain/RowsBehind` (`rowsBehindModel` builds it from the drill reply); a figure opens it with `drill`  |
| Maintenance parts                                     | `domain/`: `DecisionList`, `DecisionRow`, `DecisionDetail`, `PlantMap`, `MachineTable`, `MachineDetail` |
| Icons                                                 | `Icon` from `icons.tsx` (one stroke weight); never another icon set in v2                               |

Words never live in a `.tsx` file: they come from the model, or from `t()` for the kit's own chrome (Close, Search, Next).
Numbers are printed as the engine wrote them; a number beside them only places a mark or sorts a column.
