# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE

**State**: `main` has M2-2.2 SLA timers (#74), the milestone plan (#75) and tickets 01 (#145) and 10 (design kit, D20; PR pending). The only build
process is pstack (`CLAUDE.md`, `docs/plan/ORCHESTRATOR.md`; D23, replacing Athena v3). The progress tracker
in `docs/plan/MILESTONES.md` is the queue.

- CI: `static`, `api` ×3 and `browser` ×2 (each under 8 minutes), plus `secrets`. Browser tests seed one tenant per
  Playwright worker (`apps/web/e2e/test.ts`).
- Guards: `pnpm docs:check`, `pnpm pii:scan`, `pnpm changelog:check` (one `changes/` fragment per PR), `pnpm boundaries` (owners, calls and dated exceptions in `apps/server/src/modules/manifest.ts`; SQL on a module's tables only in its `repo.ts` or `repo/`).

## Live on main

- M0 foundation: schema v1 with forced RLS and `app_api`, auth, settings/config, Cosmos seed, walking skeleton.
- M1a ticket core: domain state/figures/permissions, tickets API, floor/desk, lists and real E2E harness.
- M1b: report/PDF, live board, PWA/WhatsApp, offline outbox, push, needs-report, day-report, admin, Desk
  Views, exact cancel time and per-person minutes, synthetic importer with undo.
- M2: configurable tags (#71), severity matrix (#72), SLA policies and timers (#74).

## Ticket 05 (in review, branch `claude/t05-actions-words-domain`)

- Ticket buttons come from `availableActions` (`packages/domain/src/actions.ts`); catalogues live in `packages/shared/src/i18n` (D7). Parity drift: until the server calls `availableActions`, a server rule change must update `packages/domain/test/actions.test.ts` T1. Follow-ups (server accepts what the Spec forbids) are in `docs/slices/05-pr-body.md`.
- Gujarati is still empty (ticket 24): the `gujarati` e2e project proves only the seed and config.

## Next

- Gate: Nimish opens `/gallery` (dev; staging after ticket 13) and picks blue or deep teal before ticket 15.
- The M0 frontier after 10: 03 (after 02), 08, 13 (MILESTONES "What can run at the same time").

## Blocked / external inputs

- N1 Bhavin live export and Worker source; N11 real shifts; N12 legacy aliases; N5 Gujarati strings.
- Production migration needs backup/restore evidence and human security sign-off.

## Parallel rule

One orchestrator. Children use fresh contexts and disjoint files; contract-first and never two writers on one file.

<!-- prettier-ignore-start -->
<!-- facts: written by the session-end hook -->
Last session ended 2026-11-13 14:04 UTC on branch `claude/orchestrator-ledger`.
- 4c24791 docs: session notes (hook)
- 303d079 docs(plan): ledger — #163 merged; one PR at the gate
- 12fcb1c merge main (ledger PR #163 merged)
Uncommitted files: 0
<!-- end facts -->
<!-- prettier-ignore-end -->
