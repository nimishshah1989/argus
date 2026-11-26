# 0058 — Every card goes somewhere: one destinations map, read by the kit

Date: 26 Nov 2026 · Decided by: Nimish ("we had aligned that each and every card will be clickable — most parts of the dashboard self-navigable between themselves — and that has not happened at all. None of the cards are clickable or expandable, or go to the page they're supposed to. We need a common system embedded across all pages, not page by page.")

## Context

LANGUAGE.md already said "every figure opens the rows behind it", but it was opt-in: a screen's model had to pass `drill` or `link` to each card. On 26 Nov only 24 of the 171 KPI cards, figure tiles and chart cards the v2 screens draw from their fixtures did (16 Dashboard cards and its timeline chart, one tile each on Fix Finder, Footprint, Problem Analysis and Shift KPIs, and three on the machine page). Every other card was a dead end, and nothing failed when a new one was added.

## Decision

1. **One map.** `apps/web/src/screens/v2/destinations.ts` holds `FIGURE_HOME` (every engine figure key, `FIGURE_KEYS`, and the screen that explains it) and `CARDS` (per screen, as `LiveFrame` names it, and per card id: `rows`, an engine figure key whose rows open in the drawer, or `home`, a screen to link to; `*` is the screen's default, the rows of the figure the whole page counts). A card id that is itself an engine figure key (the Dashboard's) needs no line: the model already wired its rows when the engine named any, so it goes home.
2. **The kit reads it.** `KpiCard`, `FigureTile` and `ChartCard` call `useDestination` (`ui/v2/drill.ts`): the model's own `drill` or `link` wins, else `DestinationContext`, which `LiveFrame` (and the Action Center's page) provide through `DestinationScope`. No screen model was edited. A default `rows` control names whose rows they are ("Avg Age: show the rows behind Registers and splits"), so a card that counts a part of a figure never claims the rows are exactly its own.
3. **The whole card is the control** for KPI cards and figure tiles (the existing stretched-button pattern, now with the card-wide focus ring and the hover lift of UX rule 2, which no longer applies to cards that go nowhere). A chart card keeps its control in its header ("Show the rows", named in full aloud, or "Open <page>"): a whole-card overlay would take the chart's tooltip and crosshair away (UX rule 33).
4. **Rows first, page second.** Rows open in the drawer; the drawer's footer links to the figure's home page (the drawer's existing "full page" slot, UX rule 18), unless that page is the one underneath. A card links to a page only when it has no rows.
5. **Tables.** A kit `DataTable` with no `onOpen` opens the machine, cell, person or decision its row names (`ui/v2/row-entity.ts`, `entityOfRow`).
6. **Guard.** `screens/v2/destinations.test.ts` builds every card-drawing screen's model from the frozen engine reply or its fixture (`card-models.ts`) and fails on any card with no destination unless it is in `NO_DESTINATION` with a reason (empty today; it may only shrink). It also fails a `rows` key the engine does not register, whose drill type `GET /analytics/drill` does not answer, or that counts no rows in the frozen plant (mixed figures excepted, as `registry.ts` allows), and a screen that draws cards without being listed.

## Consequences

- A new screen's cards are clickable the day it is framed in `LiveFrame`; a new card id that is not covered fails CI.
- `rows` is checked against the frozen plant, not the live one: a live figure that counted nothing opens a drawer that says so.
- Out of scope: tables not built on the kit `DataTable` (the annual report, desk team, board browser, ticket and translations tables, the heat matrix) and the settings lists, whose rows are records, not machines.
