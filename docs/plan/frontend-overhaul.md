# Frontend overhaul — a later workstream (Nimish, 17 Nov 2026)

Nimish, verbatim in substance: after the current frontend scope is finished there will be "a major overhaul on the
frontend… a much richer frontend language. Right now, everything is very plain: plain text, no icons, no indicators,
no red/amber/green. Most things look like a long list. Screens are not analytical, not coherent. There's barely any
chart, graph."

**Status:** noted, not started, not in the current plan's tickets. Finish the core build (M4a → M4b → M6) first; the
history-registers workstream runs beside it; this comes after.

**What it is about (for whoever scopes it):**

- a **visual language**, not decoration: status/severity/risk shown by icon + colour + word (red/amber/green with the
  locked tokens and the 44 px tap floor), one mapping table (the kit's `ui/meaning.ts` is the seed);
- **insight-first screens**: lists become overview + filters + sort + sparkline/trend, not one long column; every
  screen answers a question and offers the next action;
- **charts as a default**, not a per-ticket addition: the chart kit (`useChart`, ECharts under D27) used consistently,
  with a rule for when a number is a tile, a bar, a trend or a heatmap;
- **coherent analytical sessions**: a head can go from a KPI to its rows to the ticket to the fix without losing
  context; Today/Dashboard/machine pages share one grammar;
- performance and density on a 360 px phone first, desktop second (the current lock's desktop rules).

**How it should be scoped when taken up:** `grill-with-docs` + `impeccable` on the approved design lock, a short
design-language document (tokens, type scale, status/severity grammar, chart rules, list/insight patterns), then
gallery-first implementation with snapshots, then a screen-by-screen migration with side-by-sides. Every screen it
touches keeps its existing browser journeys green.
