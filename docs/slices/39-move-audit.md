# M4a-39c/39d — the audited move-date correction (ticket 39 goal 1's third clause)

Ticket 39 goal 1: "…the cell change log exports as the platform's sheet, **and an admin correcting a cell move's date
is audited**; register exports carry their controlled-document numbers." 39a/39b ship the figures, the screens and the
CSV export; nothing in the code updates a move's `effective_from` or audits it (`machine_move` has INSERT/SELECT only;
the settings machine edit creates a NEW move). A fresh plan review confirmed the gap, the permission cell and the
audit/harness facts, and returned FAIL on dispatch detail; this revision settles every finding.

## Packet 39c — the API (one PR, one writer)

`PATCH /api/v1/machines/:id/moves/:moveId`, body `{ effectiveFrom: 'YYYY-MM-DD' }`.

- **Permission:** the same cell as the machine resource's write routes — `gate(pool, request, reply)` defaults to
  `canSettingsLists` = head + admin; other roles get the kernel's `403 forbidden`.
- **Body:** `calendarDay` (packages/shared/src/plant-settings.ts:24-29 — it already refines a real calendar day);
  422 names `effectiveFrom`.
- **Date rule (settled, mirrors the machine edit's own bounds):** reject with 422 when the date is **in the future**
  (plant today) or when it would **reorder the history** — it must be strictly after the machine's previous move's date
  and strictly before its next move's date; the newest move is therefore only bounded by "not in the future". A
  correction to the *same* date changes nothing: reply 200 and write **no audit line**, mirroring `update()`'s
  no-change rule.
- **Tenancy/404:** inside `withTenant`; `UPDATE machine_move SET effective_from = $1, updated_at = now() WHERE id = $2
  AND machine_id = $3` (the column is NOT NULL since 0001, no migration; `app_user` keeps UPDATE). Zero rows → 404
  naming the machine. Valid ids via `idOrNotFound`; a machine that is not this tenant's is a 404, never a read.
- **Audit (settled):** `audit.record` with `entity: 'machine'` (the audit-area enum has no `machine_move` chip),
  `entityId: machineId`, `action: 'machine.move.correct'`, `before/after: { machineId, moveId, fromCell, toCell,
  effectiveFrom }` — so the audit screen shows the machine and the old→new date.
- **Reply:** `{ move: { id, machineId, fromCell, toCell, effectiveFrom } }` — the shape `machineMoveReplySchema`
  (packages/shared/src/plant-settings.ts:96-105) owns; the GET stays a bare array.
- **Home:** tests go in `apps/server/test/plant-settings-writes.test.ts` (it already has the moves describe, the
  two-tenant fixture and the `audits(entity, id)` helper) — no second Postgres fixture.
- **Tests:** admin corrects → row date changes, `updated_at` moves, audit names the action with old/new; head allowed;
  operator/technician 403; another tenant's move id 404; future date 422; a date before the previous move 422;
  same date → 200 and no new audit; the analytics figures reply (cell-change-log) shows the corrected date.
- **Files:** `apps/server/src/modules/plant/settings-routes.ts`, `apps/server/src/modules/plant/repo/plant-settings.ts`,
  `apps/server/test/plant-settings-writes.test.ts`, `changes/39-move-correct-api.md`.
- **Red / green:** Red `pnpm exec vitest run apps/server/test/plant-settings-writes.test.ts` (route answers 404 today);
  Green the same command + `pnpm lint && pnpm typecheck`.
- **Parity:** no ledger row changes in this PR (the screens' evidence lands in 39d) → the PR body carries
  `No parity: the register rows' screen evidence lands with 39d; this packet is the API it consumes.`

## Packet 39d-1 — the form's mapping (one PR, one writer; after 39b merges)

- `apps/web/src/api.ts`: `correctMove(machineId, moveId, { effectiveFrom })` returning the reply shape.
- Pure mapper in `apps/web/src/screens/analytics/machine-values.test.ts` (the file that already holds the cell log's
  pure tests): a 422 `{ field, message }` maps to `{ date: message }` for the form, a good date maps to the PATCH body,
  and a 403 maps to the kernel's refusal line.
- i18n `analytics.en.ts`: the action, the field label, the refusal, and the saved line.
- Files: `apps/web/src/api.ts`, `apps/web/src/screens/analytics/machine-values.test.ts`,
  `packages/shared/src/i18n/analytics.en.ts`, `changes/39-move-correct-form.md`.

## Packet 39d-2 — the action and the journey (one PR, one writer)

- `CellChangeLog.tsx`: head/admin only, each row gets **Correct date** opening the existing `FormSheet` (one date field,
  prefilled); on save call `correctMove` and then
  `useQueryClient().invalidateQueries({ queryKey: ['analytics-figures'] })` (the figures resource's key) so the row and
  the analytics figures refetch — never a local date mutation. The server's 422 message shows on the field; a 403 shows
  the refusal line; non-head/admin never see the action (the server refuses anyway).
- `apps/web/e2e/analytics-machines.spec.ts`: the head corrects a move's date, sees the new date, and the audit screen
  lists the correction; the operator journey keeps its refusal assertion.
- `docs/spec/parity.yaml`: rows `analytics.registers.03` gain this journey's evidence (the export + edit coverage).
- Files: `apps/web/src/screens/analytics/CellChangeLog.tsx`, `apps/web/e2e/analytics-machines.spec.ts`,
  `docs/spec/parity.yaml`, `changes/39-move-correct-e2e.md`.

## Rails

Red first; no test weakened; one writer per packet; file ≤ 400, function ≤ 60, screen file ≤ 300; raw SQL only in
`repo/`; one added fragment per PR (the three fragments above); no new dependency; money/roles rules unchanged. R2
change (server behaviour + audit): one fresh reviewer plus the covering suite; audit content and tenancy are the risk
surface. Commit locally, no push; report red, green, deviations.

## Acceptance

An admin opens Analytics → Machines → Cell change log, corrects a move's date within the real bounds, sees the
corrected row, and the audit screen shows "machine.move.correct" with the machine, the move and the old → new date;
another role never sees the action and the server refuses it anyway.
