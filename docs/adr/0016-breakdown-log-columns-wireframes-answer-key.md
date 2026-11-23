# ADR 0016 — Breakdown Log columns, two new wireframes, answer key stays frozen; session budget 75%

Date: 2026-11-24 · Status: accepted (Nimish, in chat, 03:12 IST: "yes to all")

## Decisions

1. **Breakdown Log (G1.2a):** the Excel workbook export keeps both ticket-number columns (Ticket ID and Ticket No.), because it must match Bhavin's workbook and the frozen answer key (`workbook-export.json`, 30 columns). The on-screen table and the CSV export drop the duplicate and show one ticket-number column.
2. **Shift KPIs and Energy (G1.4):** Plan drafts their v2 wireframes from the existing kit (chart card with "Show the numbers"); they wait in `design/wireframes/` for Nimish's `loop approve`. All other work continues meanwhile.
3. **Answer key stays frozen (§6, 52.70 → 52.69): no change.** The engine orders ties deterministically (by date, then ticket number) without changing any published figure. If a figure would change, that is a bug, not a decision.
4. **Session budget** raised from 110k to 150k tokens (~75% of the window) to cut hand-over churn; planning helpers run on Sonnet (`helper` subagent), never general-purpose/Opus.
