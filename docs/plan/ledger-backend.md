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
- 2026-11-14 05:00 UTC — Dispatched A: 21 goal 1 (people/logins admin API, E.164, switch-off ends sessions + push subs
  - clears phone, audit, must_change_password, common-password refusal, tech replies hold no phone) + 26 goal 1
    "session cannot cross tenants" -> session_01KEBF287pZfndQ2AUpen69L, branch claude/t21-people-logins-api.
    Dispatched B: 22 goal 1 server (machines/segments/groups/shifts write API, criticality audited, dated machine_move,
    board honours group.hidden + segment.show_on_board) + audit 13 (canWrite -> domain) -> session_01KEBF29YYNjUzx9DSA4QxoC,
    branch claude/t22-plant-settings-api. Disjoint: A new shared/people.ts + identity; B new shared/plant-settings.ts +
    plant + permissions/settings.ts. Both get the two-reviewer adversarial review (permissions). Model per
    .claude/rules/pstack-models.md: feature = sonnet high.
- Ruling: merging the 31 pending short-name people is NOT in 21 goal 1 (it rewrites person links on history, D24); it
  needs its own small design later. Why: keep the auth PR reviewable. Cost if wrong: admins see the 31 pending names a
  little longer.
- Next queue: 23 server (lists, glossary, company + logo with /files/{id} permission check, language, tz, feature
  switches); audit cleanups 11 (AI idle), 12 (auth 1 query), 14, 15, 17, 19 + erase_person/import_row payload +
  migration-runner tolerateShutdown; then M2 (29 needs MIGRATION LOCK), 32, 30g2, 31g2, 33g1, 34g2, 35g2/3.
- 2026-11-14 05:02 UTC — RULING (Nimish via FRONTEND, 14 Nov): after the M2 server work, prepare M6 part 1 so diagnosis
  can switch on straight after cutover: 55 (M6 schema + AI provider; blocked by 28 only per CLAUDE-ADOPTION; needs the
  MIGRATION LOCK), 71 (real Claude provider: redaction via identity.redactionTerms, consent, monthly cap, failure
  table, logs, alarms; D22), 56 (evaluation harness and confirm), 72 (diagnosis on the ticket, shadow mode first; review
  open PR #173 '72b', reuse what fits, close with a note only if superseded), 57 (fix finder with evidence, duplicate
  detection). Gate stays OFF in production until Nimish supplies signed Anthropic terms, Cosmos's written consent
  (N14), the monthly cap figure and the diagnosis threshold: those are the only blockers to list. Tests: fixtures
  pseudonymised, provider mocked. Server-side only; the diagnosis card is FRONTEND's after a mockup.
- Ruling: queue order is now A (M1 leftovers) -> B (M2 server) -> M6 part 1 -> C (M4a engine). Audit finding 11 becomes
  "do not start the ai.suggest poll until a feature is registered" (keep the module; M6 needs it), not "delete". Why:
  Nimish wants diagnosis right after cutover. Cost if wrong: M4a server work starts later.
- 2026-11-14 05:04 UTC — RULINGS (Nimish via FRONTEND, 14 Nov): (1) REAL DATA: build and test on Cosmos's real plant
  data (192 machines, groups, faults, 275 real tickets and timings); only names and phones stay coded in anything
  committed (Nimish may override). 56's evaluation harness runs on Cosmos's real tickets, names/phones redacted per
  D22. Staging is the real-data copy once Cosmos is loaded; destructive tests only on a restored snapshot.
  (2) EFFICIENCY: no redundant pushes, batch fixes, affected tests locally, ONE adversarial reviewer unless the ticket
  is a migration or auth-critical (then two). Applied: 21 (auth) keeps two reviewers, 22 gets one; both builders told.
  My ledger pushes batched with real events from now on.
- 2026-11-14 05:20 UTC — 22 goal 1 server merged as #195 by Nimish himself at 05:16 (head deccf94; 8/9 green at
  merge, api 2/3 still running). Plant head/admin write API for machines, segments, groups, shifts; criticality
  audited; dated machine_move + GET /machines/:id/moves; canWrite replaced by canSettingsLists/canSettingsSla;
  seesAllNeedReport in views.ts. Real Cosmos data test (TC-3 cell 7 -> 2; 30 utility machines hidden via group).
  Builder rulings accepted: criticality stays on its own route (it must refresh severity/SLA across modules); who-moved
  lives in the audit row; codes fixed after create; reads open to any signed-in login. One adversarial Opus review
  running post-merge; findings -> one follow-up PR by the same builder.
- Ruling: board filtering on group.hidden / segment.show_on_board is FRONTEND's (board is built in the browser); told.
  Segment/shift switch-off needs an active column: proposed into ticket 29's migration. Cost if wrong: one more
  migration later.
- Dispatched 23 server (lists, glossary, company/logo/language/tz/switches, /files/{id} same-tenant check, one
  switch-off contract matching the generated CrudPage) to the same builder session_01KEBF29YYNjUzx9DSA4QxoC, branch
  claude/t23-plant-lists-company-api.
- 2026-11-14 05:22 UTC — Ruling (23): company name, language, time zone and logo need a migration (app_user has no
  write on `tenant`; REVOKE ALL in 0001). Chose (A) a function-only additive migration in 23's PR
  (tenant_update_profile scoped to app.tenant_id, tenant_logo(slug), owner app_router), not (B) defer to 29. Why: these
  are cutover settings; 0010 is the precedent. Cost if wrong: one more migration to review now. MIGRATION LOCK
  requested from FRONTEND; builder holds the migration push until granted; PR gets two adversarial reviewers.
- Ruling (contract): the generated CrudPage contract is GET {items,nextCursor}, POST, PUT /:id whole form + active,
  never DELETE, string fields. #195 routes move onto it in 23's PR; lists and glossary get it at new paths
  /api/v1/settings/lists/<name> and /api/v1/settings/glossary; legacy /lists routes stay until FRONTEND deletes the
  hand-built screen. Shifts/glossary active=false answer 422 until 29 adds the column; segment/group active map to
  showOnBoard/hidden as a stated interim.
- 2026-11-14 05:35 UTC — Post-merge adversarial review of #195 (one Opus reviewer, read-only, no Docker): FAIL.
  Held: role guards exactly DOMAIN section 3 (AI cap/consent still admin-only), tenancy (withTenant, forced RLS,
  tenant-scoped FKs), no hard delete, move + update in one transaction under FOR UPDATE, pinned lists additive.
  Findings: (1) HIGH contract mismatch with the generated CrudPage (PUT/active/{items,nextCursor}/string fields);
  (2) HIGH switching off a machine with an active ticket hides the breakdown from the board, and a raise on a
  switched-off machine is still accepted; (3) MEDIUM malformed uuid / impossible date -> 500; (4) MEDIUM move date
  unbounded; (5) MEDIUM tests read tables directly + missing cases (shared login, concurrency, open ticket);
  (6-9) LOW. All folded into 23's PR (same routes), failing test first. Ruling: settings reads stay open to any
  signed-in login (same data as /config, no personal data). Cost if wrong: an operator can read nameplate data.
