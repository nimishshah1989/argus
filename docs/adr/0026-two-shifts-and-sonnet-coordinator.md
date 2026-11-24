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
