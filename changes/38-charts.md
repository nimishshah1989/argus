- The Dashboard now shows the figures it computes instead of printing the word "Ready": the bubble chart (one bubble per
  machine with a breakdown; size is MTTR), the expansion timeline (bars by machine-id prefix plus the cumulative fleet
  line), Breakdown-free as "53 of 125", Costliest problems as its ranked table, and the Data checklist as its open items —
  each with a table or list underneath and its rows behind a drill link.
- The chart kit learned two shapes (scatter, and mixed bars + a second-axis line) with no new dependency; every chart
  keeps its numbers in a table and its role/label for screen readers.
- No object-valued figure can print "Ready" again: a value with no renderer says "Only numbers so far", and the string
  "Ready" is asserted absent from every figure tile.
- A figure whose content is not a sentence (chart, table or list) spans the grid — two columns on a tablet, three on
  a desk — so its numbers have room; the review fix keeps every KPI tile one column.
