# ADR 0016 — M1 is done; M2 builds Data Checklist, then Team Focus, then Compare

Date: 2026-11-24 · Status: accepted (Plan, under ADR 0012 §3; Nimish away)

## Decision

- M1 is marked Done in PROJECT.md: #551–#558 are merged and closed (G1.1, G1.2b, G1.3, G1.4 Dashboard and Problem
  Analysis, G1.5, G1.6). G1.2a and G1.4 for Shift KPIs/Energy stay carried as ADR 0015 says.
- M2 goes live screen by screen in this order: Data Checklist (S16), Team Focus (S17), Compare (S15).

## Why

The Data Checklist engine already computes every MISSING check, so it needs only a client adapter and the go-live.
Team Focus needs a new server endpoint to save notes, status and owner first. Compare needs a server input for the
machine pair, and it has the most rows (20). The cheapest screen goes first, so v1 pages start getting deleted soonest.

## Consequences

The first M2 tickets are DC-1, the live adapter, and DC-2, the go-live that deletes v1 `DataChecklist.tsx`. The v2
model's owners, record ages and last-week deltas have no engine source. DC-1's ticket decides what prints in their
place and adds a short note here.
