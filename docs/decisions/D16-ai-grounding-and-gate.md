# D16 — AI grounding and the provider gate

Date: 13 November 2026 · Status: accepted (architect); amended the same day (gate, vendor) after Nimish's residency decision; detail in `docs/ARCHITECTURE.md` §6 and D22

## Decision

The model is reached only through `AiProvider`. **Gate (amended):** the residency record is ADR 0007. A real call, in evaluation, shadow or live, needs three things: ADR 0007 accepted with its data-protection note completed from the signed terms; the tenant's written consent recorded (`ai.consent`); and the tenant's monthly cap set. Without all three the fake provider is used. CI always uses the fake provider. Codes are validated against the tenant's list; briefings and analytics answers carry `kpi_snapshot` and ticket ids and the screen prints the numbers; fix finder and duplicate detection take candidates only from `tickets.search`. Suggestions are stored, run in shadow first, and are applied only by the owning module's normal command when a person confirms. **Vendor (amended):** Anthropic's Claude, outside India, with names and phone numbers removed first (ADR 0007). The model id is configuration, not a decision. Diagnosis on the ticket follows the fix-finder rule: candidates come only from `tickets.search` and `tickets.machineHistory`, and every cited id is re-checked against the tenant (D22).

## Why

BRIEF: AI never invents numbers or codes; data stays in India unless an ADR with a data-protection note says otherwise (AI: ADR 0007).

## Rejected

- Free-text answers containing numbers.
- A vector store up front: only if the evaluation harness shows text search misses the threshold.
- A tool-use loop in which the model fetches its own evidence (D22).

**Build phase (Nimish, 13 November):** these lines and the consent record do not block building or staging. Staging calls Claude now, using the staging key and the default cap of 50 USD a month. They gate production for a real plant only.
