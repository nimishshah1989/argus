# ADR 0015 — M1 closes when G1.1, G1.2b, G1.3, G1.4 (Dashboard, Problem Analysis), G1.5 and G1.6 merge; G1.2a and the rest of G1.4 are carried

Date: 2026-11-23 · Status: accepted (Plan, under ADR 0012 §3; Nimish away)

## Decision

M1 is marked done once tickets #551–#558 are merged. Two parts of its goals move out:

- **G1.2a** (one ticket-number column in the Breakdown Log export) waits for Nimish: the duplicate column is pinned by the
  frozen answer key (`workbook-export.json`), and answer-key changes are his (ADR 0012 §3).
- **G1.4 for Shift KPIs and Energy** moves to M2: neither screen has a gallery view or a wireframe snapshot, and new
  wireframes need Nimish's `loop approve`. M2 adds their gallery views and snapshots first.

## Why

Both blocked parts need Nimish. Holding M1 open would stall M2, whose first screens (S15–S17) are already approved.

## Consequences

The next session starts M2 with Compare, Data Checklist and Team Focus, then queues the Shift KPIs/Energy snapshot ticket.
