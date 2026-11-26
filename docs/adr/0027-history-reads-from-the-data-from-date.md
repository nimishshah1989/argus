# 0027 — History lane: the 69 path is the plan; 2026 figures read from a data-from date

Date: 2026-11-24 · Decided by: Plan (ADR 0012 unattended rule)

> Points 2 and 3 are superseded in part by ADR 0063 (26 Nov 2026): the data-from date still sets the headline figures, but the figures that learn from history and the month trend series read every year, and a reader can pick a span of years.

## Context

- Draft PR #300 (`docs/plan/history-registers-plan.md`, 17 Nov) is superseded by the 19 Nov re-plan `docs/slices/69-legacy-history.md`, already built as 69a–69c (#449, #451, #454, #461), 79 (`validate:full`, #465) and 91. Locally the 19 workbooks load: four batches done, 1,855 of 2,084 summary machine-months equal or rule-explained, 229 unexplained (`docs/plan/evidence/69c-real-load.md`).
- Production never passes a span: `loadEngineData` reads every ticket and `run` gets no span, so `dashboard.total-breakdowns`, `total-downtime-hours`, `avg-bd-hours-per-machine`, the per-day averages' numerators, the bubble chart, A2, the breakdown log, A6, the machine-page history and A10 read all years. Loading 2022–2025 on staging would move them off Bhavin's 2026 key, and no test catches it. `tools/answer-key.test.ts` (named by G3.3) only checks fixtures; the engine-vs-key tests are `packages/domain/test/analytics-*.test.ts` on the 2026-only `ENGINE_DATA`.

## Decision

1. Close #300 unmerged; the 69 slice is the history plan.
2. **Data-from date.** `EngineSettings.dataFrom` (plant date). With it set and no span, `runWith` cuts tickets, tasks, reports, plant events and Why-Why records before it; a named span still reads its own period, so history is reached by period. Cosmos's value is `2026-01-01`, stored in setting `analytics.data-from`; `tools/load-legacy.ts --data-from` writes it and refuses to load without it. Chosen over "every no-window figure reads year to date": that would reset the Dashboard totals every January and change their meaning; the cut keeps today's meaning (everything since the platform's data starts).
3. Figures that read all years on purpose (forecast, Forecast Lab, compare, team focus, money matters, fix finder, data checklist) also lose the old years in the default run. Feeding them history is later work, not M3.
4. Tickets, in build order: **621** domain cut (seeds the guard test `packages/domain/test/history-parity.test.ts`) → server setting + `load-legacy --data-from` → 69d staging load job (`.github/workflows/legacy-load.yml` + `infra/instance/legacy-load.sh`: SSM, dump first, temp folder always removed) → running it needs Nimish's upload. G3.3's test becomes the history-parity test; G3.1's is `tools/load-legacy.ts`'s summary-sheet check, not `validate:full`.

## Cost if wrong

One setting and one cut in `runWith`; removing it restores today's behaviour exactly (no data change).
