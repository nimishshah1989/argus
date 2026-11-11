# M1b-admin — Account sheet + admin correct/restore faces

## Goal

Two missing desk surfaces: an **account sheet** (who am I, the acting person, sign out) and the
**admin faces** for the C3/M3 commands the API already has — **Restore** a cancelled ticket and
**Correct** a ticket's facts — with the reason the domain records in the audit event.

## Contract (commands already exist)

- `restore`: `forcecommand('restore', { personId, reason })` — admin, cancelled tickets only.
- `correct`: `command('correct', { reason, changes: { reportedAt?, startedAt?, closedAt?, problem?,
machineId?, kind?, leadPersonId?, closedByPersonId? } })` — admin only; `reason` required.
- Both via `useTicketCommand`; the server/domain already enforce role and windows.

## Files and write scope

- `apps/web/src/components/AccountSheet.tsx` (new) — a sheet/panel with the person name, title,
  role, the acting person, and **Sign out** (`clearToken()` → navigate `/login`). Open from the
  app header (a person button) or the desk h1; mobile-first, ≥52px targets.
- `apps/web/src/components/AdminPanel.tsx` (new) — rendered in `TicketDetail` only when
  `me.user.role === 'admin'`: **Restore** (cancelled tickets, reason) and **Correct** (an inline
  form: reported/started/closed dates, problem, machine, kind + reason). Keep the form small and
  reuse `ActionForm`-style fields.
- `apps/web/src/components/actions.ts` — add `restore` (cancelled, admin) to `legalActions` or keep
  it inside the admin panel (your call; keep `canWork` semantics).
- `apps/web/src/i18n/en.ts` (+ `gu.ts` derived) — new keys.
- `apps/web/e2e/desk.spec.ts` (or a new `admin.spec.ts`) — admin restores a cancelled ticket and
  the account sheet signs out; the existing specs stay green.
- `apps/web/src/components/actions.test.ts` or a small new unit test for the correct-changes
  builder (only the fields the admin filled).

## Rules

- The admin panel is hidden for non-admins; `restore` only on `cancelled`; `correct` needs a
  reason and at least one changed field (block submission otherwise with a message).
- All new copy via `t()` (the i18n lint rule).
- The account sheet's Sign out must clear the token and land on `/login`.
- `pnpm verify` + `pnpm test:e2e` green.

## Out of scope

The full admin corrections screen from Bhavin's tool (this is the minimal face for the commands),
the day-report web button, Views completion.
