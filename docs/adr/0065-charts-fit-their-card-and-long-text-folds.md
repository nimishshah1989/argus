# 0065 — Charts fit their card, rows never collapse, long table text folds

Date: 26 Nov 2026 · Decided by: Nimish, from staging screenshots ("fix this graph on left", "make this as a full horizontal space; why waste that - no need of scroll on chart", "lets not have so much text in a column - it should be expandable", "this empty space is looking weird").

Supersedes ADR 0063 point 4 for charts of several series, the sideways-scrolling chart box, and the rule that every category name is printed.

## Decision

1. **Named rows get height from their count.** A scatter with named rows (the risk map) is 28 px a row, with margins set by the kit, names cut to 35% of the width (whole on hover) and room at the right for point names. ECharts 6 no longer honours `grid.containLabel` without its legacy module, and its automatic fit shrank that plot to no height.
2. **No chart scrolls sideways.** When even tilted names do not fit, every nth is printed; the tooltip and "Show the numbers" name them all.
3. **Year over year is for one series.** Two or more series stay one line each on the continuous months.
4. **A legend takes the rows it needs** above the plot, and the box grows by the same. A series coloured bar by bar shows in the legend the colour most of its bars wear.
5. **A card alone in its row spans it** (`.v2-grid`).
6. **Long table text folds.** In `DataTable` and `PagedTable` a plain-text cell over 80 characters shows its lead before the colon, else one line, with a "Details" button. Long headings wrap.
7. **"On this page" lists a title once**, at its first heading.

## Cost if wrong

Each rule sits in one kit file; revert that file's part.
