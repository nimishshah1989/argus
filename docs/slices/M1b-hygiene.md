# M1b-hygiene — pay down the quality-bar debt

## Goal

Bring the repo back inside its own budgets and close the small review findings, without changing
behaviour.

## Web (one worker)

- `apps/web/src/api.ts` (398 → under 300): move the types/DTOs into `apps/web/src/api-types.ts`
  and keep the client functions in `api.ts` (re-export the types so imports don't churn).
- `apps/web/src/screens/Desk.tsx` (331 → ≤300): extract the board/list pieces into
  `screens/desk/*` components (e.g. the tabs/segments and the ticket list) — no behaviour change.
- `apps/web/src/screens/TicketDetail.tsx` (312 → ≤300): extract the facts/report's sub-sections.
- `apps/web/src/components/ReportForm.tsx` (309 → ≤300): extract the field sections.
- Account sheet: on a shared login, show the login `username` (the `name` is the acting person) —
  the reviewer's finding.

## Server / domain (a second worker)

- Needs-report scope: also include the ticket's **lead** (`lead_person_id = acting person`) in the
  non-manager filter, per the plan wording (the reviewer's finding).
- Domain `leave`: add the missing `canWork` guard (the PR #23 gap; the web already gates it, the
  domain should too) + a domain test.

## Rules

- Pure refactors: no behaviour change, all existing tests stay green, no test weakened.
- Every file back under its budget (web screens ≤300, `.ts` ≤400, functions ≤60); the i18n
  lint rule and no-literal-string stay green.
- `pnpm verify` + `pnpm test:e2e` green.

## Out of scope

Feature work (Views 1–7, the day-report web button, the team variant).
