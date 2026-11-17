- The Dashboard now draws its charts instead of printing the word "Ready": the bubble chart (one bubble per machine
  with a breakdown; size is MTTR) and the expansion timeline (bars by machine-id prefix plus the cumulative fleet line),
  each with its numbers in a table underneath and its rows behind a drill link.
- The chart kit learned two shapes (scatter, and mixed bars + a second-axis line) with no new dependency; any
  object-valued figure without a renderer now says "Chart not drawn yet" instead of "Ready".
