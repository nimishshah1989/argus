# UX rules: how information is shown (Argus v2)

The source of truth for how a v2 screen behaves, adapted for Argus from the rulebook Nimish approved (20-Nov-2026).
`LANGUAGE.md` says how it looks and which kit part to use; this file says how information behaves. Rules marked
**[check]** are enforced by a test or lint; the rest by review.

## 1. Surfaces

1. White canvas (`--color-v2-page`). No page-wide gradients, washes or tinted backgrounds.
2. Content lives in cards: white, 1 px hairline, soft resting shadow. A card lifts on hover only when it is clickable.
3. Glass (translucent + blur) only on what floats: the sticky header, the drawer, the chart tooltip, popovers, toasts. Never on a card that holds data.
4. **[check]** One shadow scale, three steps: `rest`, `raised` (hover, popover), `overlay` (drawer). No ad-hoc `box-shadow`.

## 2. Action first

5. Every screen opens with the answer: a verdict sentence and 2 to 4 KPI cards saying what changed and whether it is good.
6. Every KPI card: value · change against a stated period (signed, coloured, with an arrow) · one line on what it means · a sparkline when there is a trend · one more line on hover.
7. Every card that shows a problem ends in the next action ("Assign a root-cause fix", "Schedule an inspection", "Add to Team Focus"). A number no one can act on is a candidate for a next action or an explanation, never for deletion (see section 11).
8. Lead with exceptions: machines down, repeat offenders, PMs overdue, a decision waiting. Normal can be one line.

## 3. Detail hidden, always reachable

9. Summary on screen, detail on demand. Three levels at most: card → drawer or expanded row → full page.
10. Detail opens in the right drawer by default (keeps context). A full page only when the detail is its own workflow (the machine page).
11. Every aggregate opens to what it is made of: a cell's hours → its machines → the machine.
12. A tooltip on every chart point and every abbreviation (MTTR, MTBF, PM). No glossary hunting.
13. Never hide what someone needs to act safely (a machine down, stale figures, a missed PM) behind a click.

## 4. Tables

14. **[check]** No table shows more than 10 rows by default. Beyond that: pagination ("1–10 of 126"), "show more" or grouping. 1,000+ rows are paged by the server, never painted at once.
15. Every table has search, sort on each meaningful column (the order shown), and filter chips for the 2 to 4 most useful dimensions (state, cell, type). Column choice and CSV export go in an overflow menu when a screen needs them.
16. Sticky header. Numbers right-aligned in Geist with tabular figures; text left-aligned.
17. Each row tells its story at a glance: identity (code in its type's colour + name + cell), one or two status tags, the key number, a trend (sparkline or delta). Secondary columns go into the drawer.
18. Rows are clickable → drawer. Row actions show on hover, and are always reachable from the keyboard.
    **A code is always a chip.** A machine, cell, person or decision named anywhere (a row, a table cell, a sentence, the drawer itself) is an `EntityChip`: its icon and its name, a machine in its type's colour. Pressing it opens that thing in the drawer. A chip inside a clickable row opens its own thing, never the row's. **The drawer lives in the URL** (`?drawer=machine:TC-12`): Back closes it, Forward reopens it, a pasted link opens it. Opening from closed is one history step; swapping to another item replaces it, so one Back closes however many were visited; ✕, Esc or the same chip closes it without leaving a dead Back entry. Every drawer ends in "Open full page" where the thing has a page. **[check]** `pnpm ui:check` fails a hand-drawn code, a code printed as text, a code inside a fixture sentence, and a screen View that uses `Shell` instead of `EntityShell`.
19. Empty, loading (skeleton), error and "no results for this filter" states are designed, never blank.

## 5. Colour, tags and icons

20. Colour carries meaning, never decoration: loss, gain, risk, planned, and decide (an owner's call), each with a text colour, a fill and a soft tint.
21. A status is a tag: soft background + strong text + icon. Never colour alone (pair it with a word, a sign, an arrow or an icon).
22. Machine types get a fixed colour from the categorical palette (`--color-v2-cat-1..5`), the same everywhere.
23. Icons come from one set only (`ui/v2/icons.tsx`), one stroke weight, sized to the text. Each entity has its icon and wears it wherever it appears.
24. Per screen: one accent action colour, and colour on at most about 20 % of a table's cells.

## 6. Numbers and data

25. Indian format (₹ 1,23,45,678; lakh and crore), ₹ prefix. Changes are always signed. Dates DD-MMM-YYYY, IST.
26. Every figure can say where it came from: source, as-of time, freshness. A quiet line under the card or in the drawer; stale figures get a warning tag.
27. Never show raw data: JSON, ids, unformatted timestamps, unlabelled numbers, enum values like `IN_PROGRESS`. Translate to the reader's words.
28. Large numbers are compact in cards (₹ 10.4 lakh) and exact in tooltips, tables and the drawer.
29. The UI never recomputes a figure: it prints what the engine sent.

## 7. Charts

30. Trend charts go through the chart door (`ui/chart`, ECharts, our tokens). Small charts (sparkline, bullet, 90-day strip, Pareto, plant map) are the kit's own SVG. One idea per chart; direct labels over legends where possible.
31. Every chart: axis labels, a hover tooltip with exact values, a source line, an empty and a loading state.
32. Prefer small multiples to one crowded chart. No 3D, no gradient fills on data, no pie with more than 5 slices.

32a. A chart series says what it means (`meaning` on the series): a loss (hours, counts or money lost: red), planned work (PM: blue, drawn striped or dashed with triangles) or a gain (time kept running: green); no meaning keeps the neutral palette. A line is never told apart by hue alone: loss solid with round marks, planned and gain dashed with triangles. Every category name is drawn, never skipped, wherever the chart's box can grow or scroll (a v2 chart card): names tilt to 45 degrees, wrap beside a horizontal bar, or the chart scrolls sideways inside its own card, never the page; a box with a size of its own (the v1 chart) keeps ECharts' own spacing. A "by category" chart is a ranking, not five colours: rule 22's machine-type colours are not used there because there are more categories than type colours. It is horizontal, the name on each row, the worst first (the largest for hours and counts lost, the smallest for MTBF), and the three worst bars that have a value take the series' meaning colour (the accent only when the series has no meaning) while the rest stay neutral. The value-axis title is always drawn and sits clear of the tick numbers; a percent chart prints its unit on the axis, the bar labels and the tooltip.

## 8. Motion carries information

Motion is a second channel for information, not decoration. It lets a page hold more without looking denser.

33. **Reveal on hover, not on load.** Charts show a crosshair and a tooltip; KPI cards show one more line; rows show their actions. The resting page stays quiet.
34. **Numbers arrive.** Values tick up to their figure on first load and tick from old to new on update (`useTick` in `ui/v2/motion.ts`). Tabular figures, so digits do not jitter.
35. **Charts draw in once** (lines left to right, bars grow, areas fade) on first view only; never on a re-render or a filter.
36. **Changes look like changes:** a filter or sort re-flows rows with a short stagger; a changed value flashes its direction's colour once; a new row slides in.
37. **Spatial continuity:** the drawer slides from the right while the page reflows; an expanding card grows from where it sits; a popover grows from its trigger.
38. **[check]** Durations: UI 160–240 ms, data 500–800 ms, ease `cubic-bezier(.22,1,.36,1)`; never ease-in for anything entering. Under `prefers-reduced-motion` everything still works, instantly.
39. Never animate: section fade-ins on page load, keyboard actions, spinners (use skeletons), anything that delays reaching the data.
40. Every interactive element has hover, focus-visible, pressed and disabled states. Buttons press to `scale(.97)`. Every action answers within 100 ms (optimistic UI, or our own toast when one is needed).

## 9. Layout

41. **[check]** Full width. No fixed max-width container on app screens; the grid stretches.
42. A left icon rail (60 px) that opens on hover to about 212 px with the section names (the product's own sections). The header holds only the page title, search (Ctrl K / ⌘ K) and alerts.
43. The drawer exists only while something is selected: 420 px, the page reflows to the rest (charts measure again), and ✕, Esc or the same item closes it.
44. Density through layering, not shrinking: when a screen feels full, move detail into hover, expansion or the drawer; never shrink type or padding below the scale.

## 10. Type

45. **[check]** Three families only: Inter (text), Geist (every number), Geist Mono (machine codes). Self-hosted; no font service.
46. **[check]** Five sizes only: 12 (labels, tags), 13 (secondary), 14 (body, table cells), 20 (page and drawer title), 24 (KPI values).
47. **[check]** Weight does the hierarchy: 400 text, 500 numbers, 600 titles and emphasis. No 700.

## 11. Build discipline

48. **[check]** A screen composes the kit: no colour, font size, font weight or animation in `screens/v2/` (`pnpm ui:check`). No hand-rolled dropdowns, dialogs, toasts or tables.
49. **[check]** Tokens only: no raw colours or arbitrary sizes in the kit's CSS.
50. Before review: worst-case data (`break-ui`) and a design critique on every new screen. When Nimish corrects a choice, it becomes a rule here or a check, so it is never corrected twice.

## 11. Scope never shrinks (Nimish, 20 Nov 2026)

57. A redesign changes how information is shown, not how much. Every figure, column, filter, sort, drill, export, explanation, state and link the plant had in v1 and in `SPEC.md` stays, in the same meaning, however it is laid out (a column may move into the drawer; it may not disappear).
58. Each screen also earns its place with intelligence v1 lacked, built from data we already hold: rank, compare with peers or the fleet, show the trend break, name the repeat cause, forecast, warn early, put a rupee figure on it, say how sure we are. A new insight is computed by the engine and printed by the screen (rule 29), never worked out in the View.
59. **[check]** A screen PR carries its coverage table (`COVERAGE.md`) in its body and in `docs/design/v2/scope/<screen>.md` (`pnpm quality:pr`, Q16). A row marked MISSING or DROPPED without "Nimish said yes: <date>" fails review and the milestone gate. The orchestrator checks the table against the v1 file and its e2e spec, not against the builder's own word.
60. Simplifying means moving detail behind a click or into the drawer (rule 9), never removing it.
