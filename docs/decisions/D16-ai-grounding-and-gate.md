# D16 — AI grounding and the provider gate

Date: 13 November 2026 · Status: accepted (architect); detail in `docs/ARCHITECTURE.md`

## Decision

The model is reached only through `AiProvider`. No real provider is called, in evaluation or in shadow, until the data-residency decision record is filed; the fake provider is used until then. Codes are validated against the tenant's list; briefings and analytics answers carry `kpi_snapshot` and ticket ids and the screen prints the numbers; fix finder and duplicate detection take candidates only from `tickets.search`. Suggestions are stored, run in shadow first, and are applied only by the owning module's normal command when a person confirms. No vendor or model id is chosen here.

## Why

BRIEF: AI never invents numbers or codes; data stays in India unless an ADR says otherwise.

## Rejected

- Free-text answers containing numbers.
- A vector store up front: only if the evaluation harness shows text search misses the threshold.
