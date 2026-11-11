# M1b-actions — desk join/leave + cancel, floor cancel-own

## Goal

Close the action gaps from the parity review so the desk can run the whole state machine and the
floor can cancel its own mistake.

## Behaviour (DOMAIN.md §2/§3, commands already exist in the API)

- **Desk — join**: on an `open`/`working`/`waiting` ticket a technician (or above) can add
  themselves as crew: `POST /tickets/{id}/join {personId, role}` with `role` =
  `primary | support`.
- **Desk — leave**: the same person can remove themselves: `POST /tickets/{id}/leave
{personId, reason}` (reason required); the command only exists for crew members, so show it
  only when the acting person is on the crew.
- **Desk — cancel from `working`**: technicians and above may cancel a working ticket (the
  domain `canCancel` allows it); surface `Cancel` in the `working` action set too.
- **Floor — cancel own**: an operator may cancel a ticket they raised that has **not started**
  (`status open` and no `startedAt`); show a `Cancel` action on their sent confirmation and in
  "My complaints" for such a ticket.

## Files and write scope (one worker — the action model is shared)

- `apps/web/src/components/actions.ts` — `legalActions` gains `join`/`leave` (gated by role/crew)
  and `cancel` in `working`; `quickAction` unchanged.
- `apps/web/src/components/ActionForm.tsx` — `join` (role select `primary`/`support`, default
  `support`) and `leave` (reason textarea, required) fields + body builders.
- `apps/web/src/i18n/en.ts` (+ `gu.ts` same keys) — the new labels
  (`action.join`, `action.leave`, `action.role`, `action.rolePrimary`, `action.roleSupport`, …).
- `apps/web/src/screens/floor/SentConfirmation.tsx` + `apps/web/src/screens/floor/MyComplaints.tsx`
  — a `Cancel` action for the caller's own not-started ticket (reuse `command('cancel')`).
- `apps/web/src/components/actions.test.ts` (new) — `legalActions` unit test (join/leave present
  for crew, cancel in working, floor cancel only when open and unstarted).
- `apps/web/e2e/` — extend the desk spec with join → leave (optional if it makes the spec slow).

## Rules

- The crew gate: `join`/`leave` only for `canWork(role)`; `leave` only when the acting person is
  on the crew (the ticket's `people`/crew or the lead). The server remains the authority.
- The floor cancel is only for the caller's own ticket (`raisedBy`/`reportedBy` = them) and only
  while `status === 'open'` with `startedAt === null`.
- All new UI copy goes through `t()` (the i18n lint rule covers `.tsx`); the `ActionSpec.label`
  values in `.ts` stay English for now (known follow-up).
- `pnpm verify` + `pnpm test:e2e` green.

## Out of scope

Admin correct/restore faces, the account sheet, the needs-report list (separate slices), the
`.ts` label extraction.
