# M4a-39c/39d — the audited move-date correction (ticket 39 goal 1's third clause)

Ticket 39 goal 1: "…the cell change log exports as the platform's sheet, **and an admin correcting a cell move's date
is audited**; register exports carry their controlled-document numbers." Packets 39a/39b shipped the figures, the
screens and the CSV export with its controlled-document number, but the correction is not in the code: today there
is only `GET /api/v1/machines/:id/moves` (`settings-routes.ts:262`) and `insertMove` on a cell change
(`repo/plant-settings.ts:116`), and nothing updates a move's `effective_from` or audits it. These two packets close
that clause before the M4a gate.

## Packet 39c — the API (one PR, one writer)

`PATCH /api/v1/machines/:id/moves/:moveId`, body `{ effectiveFrom: 'YYYY-MM-DD' }`:

- Permission: the same cell as the machine resource's write routes — `gate(pool, request, reply)` in
  `settings-routes.ts:182` (the kernel's settings cell: head and admin; any other role gets the kernel's `403 forbidden`).
- Validation: `effectiveFrom` must be an ISO plant date (`dateSchema` from `@uptimo/shared` if it exists, else the
  `/^\d{4}-\d{2}-\d{2}$/` rule with a real day) → 422 naming `effectiveFrom`; a move id that is not this machine's, or
  a machine that is not this tenant's, → 404 `not_found` naming the machine (never a cross-tenant read).
- One tenant transaction: read the move (before), `UPDATE machine_move SET effective_from = $1 WHERE id = $2 AND
  machine_id = $3`, `audit.record(tx, { …auditEntry(ctx, machineResource, 'machine.move.correct', moveId), before,
  after })` — the audit line carries the old and the new date; reply `{ move: { id, machineId, fromCell, toCell,
  effectiveFrom } }` in the shape the GET already returns.
- Repo: `correctMove` in `repo/plant-settings.ts` (raw SQL only there, D01/D02); no migration (the column exists).
- Tests (`apps/server/test/plant-moves.test.ts`, real Postgres through the existing harness): an admin corrects a
  date and the row changes; the audit row names `machine.move.correct` with the before/after dates and the login;
  the head is allowed; an operator/technician gets 403; another tenant's move id answers 404; a bad date answers 422
  naming `effectiveFrom`; the correction changes what the cell change log reads (the analytics loader's move list
  shows the new date) — one test proves the effect, not just the row.
- Files: `apps/server/src/modules/plant/settings-routes.ts`, `apps/server/src/modules/plant/repo/plant-settings.ts`,
  `apps/server/test/plant-moves.test.ts`, `changes/39-move-audit.md`. No UI in this packet.

## Packet 39d — the screen (one PR, one writer, after 39b merges)

On the Cell change log screen (`apps/web/src/screens/analytics/CellChangeLog.tsx`), for head and admin only:

- Each move row gets a **Correct date** action opening the existing form side panel (`FormSheet` pattern) with one
  date field, prefilled; save calls `PATCH /api/v1/machines/:machineId/moves/:moveId` through `apps/web/src/api.ts`.
- Honest states: the server's 422 names the field; the 403 is shown as the kernel's refusal line; on success the row
  updates in place (refetch) and the screen does not invent a new date before the reply.
- The action is hidden for other roles (the reply carries the same rule; the screen never invents a second rule beyond
  hiding what the server would refuse).
- Tests: a pure unit test for the form's value/error mapping; the existing machines e2e gains one journey — a head
  corrects a move's date, the new date shows, and the audit screen lists the correction. Catalogue keys in
  `analytics.en.ts` (gu follows the namespace's blank convention); `docs/spec/parity.yaml` rows
  `analytics.registers.03` gain this packet's e2e evidence.
- Files: `apps/web/src/screens/analytics/CellChangeLog.tsx`, `apps/web/src/api.ts`,
  `packages/shared/src/i18n/analytics.en.ts`, `apps/web/e2e/analytics-machines.spec.ts`, `docs/spec/parity.yaml`,
  `changes/39-move-audit.md`.

## Rails

Red first; no test weakened; one writer per packet; file ≤ 400, function ≤ 60, screen file ≤ 300; raw SQL only in
`repo/`; no new dependency; money/roles rules unchanged. This is an R2 ticket (server behaviour, audit) — one fresh
reviewer plus the covering suite; the audit and tenancy assertions are the risk surface. Commit locally, no push.

## Acceptance

An admin opens Analytics → Machines → Cell change log, corrects a move's date, sees the corrected row, and the audit
screen shows "machine.move.correct" with the old and new date; another role never sees the action and the server would
refuse it anyway.
