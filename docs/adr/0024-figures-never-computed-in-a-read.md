# 0024 — Figures are never computed inside a read

**Date:** 2026-11-24 · **By:** Plan (Nimish away, ADR 0012)

## Why

M3 goal G3.2: "A figures request answers in ≤300 ms p95 with the whole history and 30 readers; 0 engine runs inside a read — test: load script". Today `servedRun` (`apps/server/src/modules/analytics/served.ts`) serves a kept run while the data stamp is unchanged. When the stamp has moved (any ticket write) the next read computes the engine inside the request, under an advisory lock, holding a pool connection. With five years of history that read is slow. `engine.freeze` is the forecast freeze, not a warm-up.

## Decisions

1. **Order.** M2's remaining screens (S20–S26, being redrawn under ADR 0023) and M4's (S27–S30, drafted now) wait for Nimish's wireframe approvals. While they wait, Plan pulls M3's backend-only goal G3.2 forward (ADR 0012 order M2→M4→M3 otherwise unchanged). G3.1 (real 2022–2025 workbooks, needs N14/N17) and the two §6 questions (answer-key last digit; `support` downtime) stay with Nimish. Nothing here touches the answer key.
2. **Stale-while-revalidate.** A read whose kept run for that plant date exists but whose stamp has moved serves the kept run as it is and enqueues one `figures.warm` job for (tenant, asOf). The pg-boss `singletonKey` is `${tenantId}:${asOf}`, so a burst enqueues once. The job computes and keeps the run exactly as `servedRun` does today. Only a cold miss (nothing kept for that date) computes inside the read, and that is counted.
3. **Today stays warm.** After a write moves the stamp the warm job recomputes within seconds. A daily schedule warms each tenant's plant today (`plantToday`) just after midnight plant time, so the first read of a day is not a cold miss.
4. **Proof.** A module counter `engineRunsInRead()` (exported from `served.ts`, with a reset helper for tests) counts cold-miss computes. The load script (ticket 607) fails on any count above 0 after warm-up.
5. **Freshness.** After a write, figures may lag by the job's run time (seconds). The web already refreshes when figures change (`useRefreshOnFigures`). Accepted.

## Consequences

- Ticket 606 (M3-1) builds decisions 2–4; ticket 607 (M3-2, blocked by 606) is the load script that proves G3.2.
- Seed `plan/t606` rewrites the assertions in `apps/server/test/analytics-served.test.ts` that said "a read after a write computes again" (a read now serves the old figures and queues a warm job). The ticket lists them under "Tests changed by Plan".
- A read right after a write can show figures that are a few seconds old. Anything needing the exact figure (the POST that stores a run) still computes.
- (Numbered 0024: another ADR 0023 landed on main the same day.)
