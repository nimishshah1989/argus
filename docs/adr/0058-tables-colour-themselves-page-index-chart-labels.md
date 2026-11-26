# 0058 — Tables colour themselves, every page has an index, chart labels never collide

Date: 26 Nov 2026 · Decided by: Nimish, looking at Problem Analysis on staging:

> "bubble legends aren't proper"
>
> "why is there no color coding … or some kind of conditional formatting that shows the biggest issues … all the
> tables on problem analysis are extremely bland … no conditional formatting in any of them."
>
> "each of these pages feel very long … it will be so hard for someone to even remember where is what. How do we
> solve for that as navigation?"

He asked for each to be solved once, in the kit, so every page gets it.

## Context

- The "Often, or long?" quadrant printed each offender's full name beside its dot. Offenders cluster in one corner,
  so "Axis motor / drive / encoder / serv…" sat on top of "Turret clamp / indexing" on top of "Spindle motor…".
- The kit already had a measure column (ticket 620), heat rules and `KeyPill`, but a table coloured anything only
  when a screen opted in, and almost none did. The Breakdown log printed the platform's raw float
  (`0.6666666666666666`) in "Downtime (hrs)".
- Pages run to six or more cards and tables with no way to see or jump to the parts.

## Decision

1. **Chart labels.** `Quadrant` labels only what matters: the often-and-long offenders, then those of the three
   biggest by x × y (hours lost) not already named, at most six. `placeLabels` (`bubble-math.ts`) places them greedily,
   most important first, on the dot's outer side, then the other side, then up to three lines up or down with a
   leader line; a label with no free spot is dropped. No label touches another label, a dot or the plot edge
   (`quadrant-labels.test.ts`). Names over 20 characters are cut with "…" and keep the whole name as `<title>`. Every
   point keeps its own `<title>` and its row in "Show the numbers", which is the keyboard's way to every point.
2. **Tables colour themselves.** Each column has a `look` (`table-look.ts`): a meaning (`loss`, `gain`, `risk`,
   `plan`, `neutral`), `category` or `plain`.
   - A number column with a meaning draws a bar scaled to its column; a table with more than four such columns tints
     the cells instead.
   - The column the table is ranked by (the reader's sort, else the measure, else the first coloured column) marks
     its top three rows in the meaning's colour and weight: loss red, gain green. Colour is never alone: the weight
     changes too, and the number is the word.
   - A `category` column's words are neutral pills with a dot of the fixed category colour (`--color-v2-cat-1..5`),
     chosen by a stable hash of the word, so a family is the same colour on every table.
   - Ids, dates and plain counts are `plain`.
   - Engine tables read their look from the engine's own English header (and, for month grids, the table's title),
     as `kindOf` already reads headers. Screens that build columns with translated labels declare `look`.
   - `screens/v2/table-look.test.ts` builds every screen's table models from their fixtures and fails on a number
     column without a look. Its two exception lists (columns the kit cannot read, screens with no fixture builder yet)
     only shrink, like `tools/old-ui-left.test.ts`.
   - No raw float reaches a cell: `tidyCell` prints a bare number with three or more decimals through `exact`
     (at most 2 decimals, Indian grouping).
   - `PagedTable` bars by the page it holds and marks no top rows, since a page is not the whole list.
3. **On this page.** The `Shell` reads every `h2` inside the page (a `SectionHead`, a `Panel`, a table's or chart
   card's title; not one in a live message) into `OnThisPage`: a sticky rail at the right from 1280 px, a jump menu at
   the top of the page below that or while the drawer is open. Scroll-spy marks the part being read; a click scrolls,
   focuses the heading and writes `#part` into the address, and a pasted `#part` scrolls there on load. Pages with
   fewer than three parts show nothing. The same titles join the ⌘ K search. No screen changes.

No new dependency: each piece is a few dozen lines on what the kit already had; a label-placement or scroll-spy
library would bring more than it saves.

## Consequences

- A screen that builds `Column`s or a `TableModel` header with translated labels gives each number column a `look`.
- A new chart that prints labels uses `placeLabels`.
- A page part needs a real title: that title is its entry in the index and in search.
- Not done here: Breakdown log's hours print with 2 decimals ("0.67"), not as a duration ("40 min").
