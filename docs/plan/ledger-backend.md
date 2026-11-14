# Backend lane ledger

One line per dispatch, ruling or merge. Owner: the backend orchestrator. Frontend lane's ledger: `docs/plan/ledger.md`
on `claude/orchestrator-m0-gate`. Format for rulings: `Ruling: what, why, cost if wrong`.

- 2026-11-14 UTC — RULINGS (Nimish, 14 Nov, "go backend lane"; binding, override CLAUDE.md for the two lanes):
  (1) Two orchestrators; combined cap 5 builders: FRONTEND (session_01KEBF28rZZwgSDVMzdNjw77) up to 3, BACKEND up to 2.
  BACKEND writes `apps/server`, `packages/domain`, `packages/db` (migrations), `packages/shared` contracts, `scripts/`,
  server `tools/` checks; FRONTEND owns `apps/web`, `infra/`, staging. Backend builders never touch `apps/web` except a
  test fixture a contract change forces (said in the PR). (2) ONE MIGRATION IN FLIGHT across both lanes: 'MIGRATION LOCK
  request: <ticket>' to FRONTEND, wait for 'granted', 'MIGRATION LOCK released' on merge. (3) M2+ backend work may run
  ahead of the M1 cutover gate; unanswered product details are built on proposed defaults held as configuration and
  listed for Nimish. (4) Product questions go to FRONTEND (batched, plain English, with a recommendation); never ask
  Nimish a technical question.
- 2026-11-14 UTC — Started on main 636e24d. Survey: no people/logins write API (identity has login/me/logout/password
  only); plant has settings PUT, lists PUT/DELETE, translations; no machines/segments/groups/shifts write routes. All
  tables needed by 21/22/23 already exist (person, login, session, push_subscription, machine, segment, machine_group,
  shift, machine_move, list_item, glossary_term, setting, audit_log): no migration, no lock needed.
