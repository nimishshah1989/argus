# ADR 0018 — Team Focus notes: stored in `setting`, read per month, written by the analytics audience

Date: 2026-11-24 · Status: accepted (Plan, under ADR 0012 §3; Nimish away) · Ticket: #573 (TF-1)

## Context

The v2 Team Focus screen (S17) shows a status, an owner and a note on every action. The engine's figure prints
the platform's defaults (open, no owner, no note) because it has no persistence; its own comment names the store
as `focus:<period>|<action>`. Nothing reads or writes those rows today: the v1 page only prints the engine's
defaults, `selectSettings` hides `focus:` rows, `PUT /settings/:key` refuses them, and the legacy input
(`fixtures/answer-key/input.json`) carries no Team Focus state. So there is no stored data to carry over.

## Decisions

1. **Storage: the existing `setting` table**, one row per action, key `focus:<period>|<action key>`. No migration:
   the table already has `tenant_id`, RLS and the `(tenant_id, key)` uniqueness that makes one row per action.
   DATA-MAP already lists these rows and the erasure trigger already scrubs names in them.
2. **Period** is the focus month the engine plans (`YYYY-MM`, its `focusMonthOf`). The **action key** is the
   engine's own, stored as given (1–200 characters; it can hold `|`, `/`, `%`, `_`).
3. **Value** `{ status, owner, note, at }`. Status is the platform's four words `open | prog | done | skip` (the v1
   catalogue's keys). Owner is free text (≤80), like the nudge acks, not a person id: that is what the erasure
   trigger scrubs, and a plant names owners who have no login. Note ≤500. `at` is the database's `now()`. The
   limits are the write body's; a stored longer value still reads.
4. **Endpoints**: `GET /api/v1/analytics/team-focus/notes?period=YYYY-MM` answers `{ period, notes }` (by action
   key). `PUT /api/v1/analytics/team-focus/notes` takes `{ period, action, status, owner?, note? }` and answers the
   month's fresh `{ period, notes }`, so the screen never patches its own copy. The action is in the body, not the
   path, because action keys hold `|` and `/`.
5. **Who**: read and write are `canAnalytics` (supervisor, head, plant head, admin), the same audience that sees
   the figure and acts on nudges (DATA-MAP lists both in one row). Operator, technician and board get 403.
6. **No check against the current figure**: a month's actions shift as data lands, so a write is not refused for
   an action the figure no longer prints, and a stored note on a gone action is kept and simply not shown.
7. **Always upsert**: a note set back to open and empty keeps its row (one id across writes); there is no delete.
8. **Audit**: every write records `focus.save` on `entity: 'setting'`, the row's id, with before (or null) and after.
9. **Tenant**: only `ctx.tenantId` through `withTenant`; nothing in the body or query names a plant.

## Consequences

TF-1 (#573) builds the server side; the contract is in `packages/shared/src/team-focus-notes.ts`. A later
ticket (TF-2) reads the notes into the v2 screen and adds the edit control.
