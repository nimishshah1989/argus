# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE

**State**: `main` (f7b1fe7) has the M1b importer, M2 configurable tags and M2-2.1 severity merged. The build
coder is now the **hosted free route** (`openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`): it passed the
harness gate (probe 1.7 s; fixtures A 40 s/4 calls, B 22 s/6, C 40 s/10) and a real microtask (shared-login
E2E) after one review FAIL and fix; fresh re-review PASS. The contract is `docs/orchestration.yaml` +
`docs/ORCHESTRATION.md` §10; a one-word probe must run before the first packet — `list_subagent_models` is
not a route check.

- Machine-local setup: `~/.dsh/profiles/desktop/cordis.patch.yml` declares the `openrouter` provider and both
  free models; `~/.dsh/.credentials.yaml` must hold the `llm-pi-ai/openrouter` api-key record. The credential
  store hot-reloads; a profile patched after boot needs an app restart (provider registry is built at boot).
- M2-2.2 SLA timers are complete and verified on branch `sla-timers` (504 tests, 38/38 browser, independent
  reviews PASS). No PR is open yet. M2-2.3 escalation has not started.
- Gate evidence from the coder evaluation is uncommitted in the main worktree:
  `apps/web/e2e/fixtures.ts` (VC-7/VC-8, optional `actingPersonId`) and new `apps/web/e2e/shared-login.spec.ts`.

## Live on main

- M0 foundation: schema v1 with forced RLS and `app_api`, auth, settings/config, Cosmos seed, walking skeleton.
- M1a ticket core: domain state/figures/permissions, tickets API, floor/desk, lists and real E2E harness.
- M1b shipped: report/PDF, live board, PWA/WhatsApp, offline outbox, push, needs-report, day-report, admin,
  Desk Views, exact cancel time and per-person minutes, synthetic importer with undo.
- M2: configurable ticket tags (PR #71) and the 2.1 severity matrix (PR #72).

## In flight

- `sla-timers`: verified; only PR creation, green GitHub CI and merge remain.
- Build route: hosted free coder adopted; local TwIL is a development-only fallback.
- Real N1 export/Worker schema, reviewed N12 aliases and the cutover runbook remain external.

## Next

- Rebase `sla-timers` on current `main`, open the M2-2.2 PR with `size:large` + `no-parity`, green CI, merge.
- Write the M2-2.3 escalation slice plan (rule/roster schema, acknowledge, fake-clock timer paths, notification
  adapter) and run it through a fresh plan review before any coder packet.
- Day-report follow-ups, a shared-login acting-person picker for the login screen (the E2E covers the session
  path only), real Gujarati strings.

## Blocked / external inputs

- N1 Bhavin live export and Worker source; N11 real shifts; N12 legacy aliases; N5 Gujarati strings.
- Production migration needs backup/restore evidence and human security sign-off.

## Parallel rule

One orchestrator. Children use fresh contexts and disjoint files; contract-first and never two writers on one file.

<!-- prettier-ignore-start -->
<!-- facts: written by the session-end hook -->
Last session ended 2026-11-13 06:57 UTC on branch `claude/orchestrator-ledger`.
- 82922f2 docs(plan): ledger — ticket 01 rulings
- b21370f docs(plan): ledger — format ruling
- 6520cc3 docs: format session-end facts for prettier
Uncommitted files: 1 (first: ocs/HANDOFF.md)
<!-- end facts -->
<!-- prettier-ignore-end -->
