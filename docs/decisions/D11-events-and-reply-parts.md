# D11 — Upward reactions by in-transaction events; upward reads by reply parts

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

A lower module never imports a higher one. For writes it publishes an event (`ticket.changed`, `machine.hot`) and subscribers run inside the publisher's transaction. A subscriber may only write its own tables and enqueue jobs; it never calls an outside service in the transaction. For reads, the kernel holds a reply-part registry: `tickets` asks `replyParts('ticket', tx, ids)` and each registered module returns a map of ticket id to its fragment (`sla`, `handback`, later `ai`), one query per contributor per request.

## Why

ADR 0006 requires ticket, timers and queued jobs to commit together. Ticket replies embed SLA data today; without reply parts `tickets` would have to import `accountability`. This is what lets WhatsApp land last.

## Rejected

- A message broker: new infrastructure.
- `tickets` importing higher modules: a cycle.
- A second web request per ticket for clocks: slower on 3G and breaks the single `/state` payload.
