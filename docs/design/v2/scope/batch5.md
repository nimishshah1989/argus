# Batch 5: what was built and what was not (20 Nov 2026)

Batch 5 was listed as Energy heat map, Bottleneck, Shift-calendar KPIs, Forecast Lab and Reliability scorecard. Four are built and live (their tables are `energy.md`, `bottleneck.md`, `shift-kpis.md`, `forecast-lab.md`). The fifth is not a v1 screen:

- There is no v1 page called Reliability scorecard. The section "Reliability & forecast" in the rail holds exactly two screens, Bottleneck (`a9-bottleneck-forecast`) and Forecast Lab (`forecast-lab`), both built here.
- The only figure with "reliability" in its key is `reliability` (ticket 67: the Weibull fit and critical spares), a second figure of the Machine page, not a screen (`registry.ts`: "never a screen of its own"). It is shown as the Machine page's reliability block (`reliability-parts.tsx`), which belongs to the Machine page rebuild in batch 1.
- The monthly published scorecard is ticket 53 (`todo`), not built in v1 either.

So nothing a v1 screen showed is left out. If Nimish wants a new Reliability scorecard screen (the fit per machine, failing-faster list, critical spares across the plant), that is a new screen with new engine work, to be shaped as a product question.
