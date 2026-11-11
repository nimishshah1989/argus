# Prototype decisions — D0.1

Status: delegated direction recorded on 11 November 2026. These are decisions for isolated D0.2/D0.3 review artifacts, not production implementation evidence and not Nimish's visual approval.

## 1. Condition and work are independent

Show both axes together, for example **Stopped · In progress**. Transferred work remains open with **Waiting for pickup**; transferred is not a stored status. A later running interval changes the condition to **Running** but never closes the ticket.

- **Existing evidence:** the domain/API expose `kind`, `parentId`, `machineRunningAt`, `machineStoppedAt`, `status` and `handedOver`; current ticket detail retains timeline, people and figures.
- **Pending evidence:** the exact two-axis icon + label presentation and its accessibility at phone, desktop and kiosk sizes. The current single-status badge and dot do not satisfy the contract.
- **Production state:** todo after design alignment; no TSX or status mapping changed in D0.1. The authoritative semantics live in `docs/DESIGN.md` and `docs/spec/SPEC.md`.

## 2. Offline new stopped/support reports

The D0.3 design should show a new stopped or support report as queued with a visible pending state. Persist a client idempotency key with the queued report and reuse that same key on every replay. If the machine already has a duplicate open report, resolve to and show the existing ticket. Any unresolved replay failure remains visible as **needs attention**; nothing disappears silently.

**General/other-work is excluded and requires a connection until separately approved.** This exclusion is deliberate, not an omitted case.

- **Existing evidence:** cached reads and the outbox implement only close with report, close without report, mark done and late report (`apps/web/src/offline/outbox.ts`). Existing close/report conflicts become visible drafts. The online raise API already has idempotency and duplicate-open handling.
- **Pending evidence:** persisted new-raise key reuse across reload/replay, visible queued/pending and needs-attention behavior, duplicate-open resolution, Floor offline presentation, and phone tests. No D0.1 screenshot demonstrates these behaviors.
- **Production state:** separate M1 todo slice (`v3.alerts.09`), not implemented by this documentation/evidence slice.

## 3. My complaints is acting-person scoped

Scope My complaints to the acting person. The report-only journey should not expose device-wide history and should not send a report-only user to the Desk.

- **Existing evidence:** `MyComplaints` calls `listTickets({ raisedBy: personId })` with `me.user.actingPersonId`, and the server applies `raisedBy` to `reported_by_person_id`. Existing `v3.views.07` evidence remains intact and its status remains `in-progress`.
- **Pending evidence:** shared-phone proof that one acting person cannot browse another's history through this presentation, and a report-only card/detail journey with no Desk link. Current ticket cards link to `/desk/{id}`; that is current-truth scaffolding, not approval. No-device-history and no-Desk-link presentation are prototype-only/pending.
- **Production state:** acting-person filtering exists; the report-only presentation and its evidence remain todo. Existing evidence is neither deleted nor marked complete.

## Approval gate

D0.2 and D0.3 may make these decisions clickable in isolation with synthetic data. Before any production migration, Nimish must provide an explicit **D0.3 visual-alignment record** covering the coherent design system and Floor/Desk prototypes. That record is separate from agent image inspection, automated tests and usability sessions. Board, Management, Settings, role-shell changes and offline implementation require their own later slices.
