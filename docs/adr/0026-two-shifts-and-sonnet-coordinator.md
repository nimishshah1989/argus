# 0026 — Cosmos runs two shifts; the coordinator runs on Sonnet

Date: 2026-11-24 · Decided by: Nimish (chat, 12:30 IST)

## 1. Two shifts, 16 hours

Cosmos runs **two shifts, A and B, together 16 production hours a day. There is no C shift.**

- Every figure, fixture, wireframe and seed that assumes three shifts (A/B/C, 24 h) is wrong for Cosmos. The redrawn S20 (Shift KPIs) and S26 (Settings) show a C shift in their sample data: drop it when building them. The availability, MTBF and shift-split figures are worked out over A and B only.
- The plant's shift list stays configurable per tenant (other plants may run three). This is Cosmos's setup, not a product limit.
- If the answer key or Bhavin's workbooks show any breakdown booked to a C shift, stop and ask Nimish: that is an answer-key question.

## 2. Coordinator on Sonnet, planning on Opus (loop 0.8.0)

- The session `loop auto` starts is now the **coordinator, on Sonnet**: it picks the next step, runs `loop prep/build/finish/ci`, merges green PRs and writes the handoff.
- **Every planning job goes to Opus** through `loop plan "<job>"`: specs, tickets, seed branches with failing tests, ADRs, wireframes, PROJECT.md changes. The reviewer stays on Opus.
- **No handoff-only PRs.** HANDOFF.md and metrics go on the standing branch `plan/handoff` (one open PR, merged when green) or inside a plan PR.
- `.loop.json` gets `"orchestrate": "sonnet"`; CLAUDE.md §2 table updated to match.

## 3. Two lanes: screens and history at the same time (loop 0.8.1)

Nimish wants the screen work and the history load to move together, not one after the other.

- **Screens lane** (first): build the approved S20–S26, then the M2b insight pass over the 23 live v2 screens.
- **History lane** (alongside): M3's history load — Bhavin's 2022–2025 workbooks in, figures equal his for those years. Plan it from `docs/plan/history-registers-plan.md` (draft PR #300) with `loop plan`.
- The coordinator runs one ticket from each lane side by side (`loop build <N> --bg`, `loop wait <N>`), only when their file lists share no file. Never two from the same lane.

## 4. M2b by rules in the kit, not screen by screen (Nimish: "figure out some rules and apply")

The 23 live v2 screens draw their tables through the shared kit (`ui/v2/table-model.ts`, `data-table`, `paged-table`, `table-parts`) and their figures through `kpi-card` / `figure-tile`. So the insight rules (UX 60–67) go **into the kit once**, and each screen only declares what its numbers mean.

- **Table columns declare meaning:** which column is the measure, whether higher is worse, an optional target or comparison period. From that the kit does, for every table: worst-first sort by default, the top row marked with a tone pill and word, numbers drawn as in-cell bars against the column's largest value or the target, the tail folded after 3–5 rows ("+ N more, all within target"), detail in an expand row, the exact table behind "Show the numbers".
- **Takeaways come from four rules** in `screens/v2/insight.ts`, picked from the declared meaning, not hand-written per table: **outlier** ("A shift is 3.2× C shift"), **target** ("only C shift meets 98.0%"), **concentration** ("18 of 126 machines cause half the hours"), **change** ("+10% on September"). A screen writes its own sentence only where none of the four fits.
- **Figure tiles require a yardstick** (previous period, target or peer); a tile without one fails the coverage test.
- **Order:** (1) one or two kit tickets that make the shared table and tiles insight-aware with the four rules; (2) then each screen is a small ticket that adds the column meanings and removes hand-built tables — size:small (Haiku) where it is only declarations. The `insight-coverage` test (ADR 0025) stays the finish line.
- Expect about 8–12 tickets in all, not one hand-redesign per screen.
