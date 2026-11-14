# Backend lane ledger

One line per dispatch, ruling or merge. Owner: the backend orchestrator. Frontend lane's ledger: `docs/plan/ledger.md`
on `claude/orchestrator-m0-gate`. Format for rulings: `Ruling: what, why, cost if wrong`.

## RESUME HERE (backend orchestrator; restart #3 session_01KEBF2A79g1EjjKrbU4mw4v, 14 Nov 09:10 UTC)

Start a fresh orchestrator with: "Orchestrate `docs/plan/MILESTONES.md` per `CLAUDE.md`, backend lane; read `docs/plan/ledger-backend.md`, RESUME HERE block first." Model: Sonnet high (`.claude/rules/pstack-models.md`). Restart at 60% context (get_session `context_usage.used_tokens` > 600000; set a send_later check every ~12 min). On restart message every child session and the frontend orchestrator with the new parent id.

- **Rules now (Nimish):** merges by orchestrators only, on covering checks green; he no longer merges from the GitHub page.
  Builders run `pnpm precheck` + only the whole test files they touched before a push; CI runs the full suite once at ready.
  No test deleted or weakened. Draft PRs run no CI. Never re-run a job more than once. Each new ticket starts in a FRESH session
  whose first message is `/poteto-mode <brief>`, and the brief begins with a "what already exists on main" check (fill gaps only).
  One migration in flight across both lanes (lock via FRONTEND). One reviewer per PR; two adversarial reviewers only for
  migration/auth/tenancy; one fix round; merge main into the PR first when it touches files another merged PR touched.
- **Merged today (backend):** #195 #199 #204 #206 #210 #211 #212 #216 #217 #220 #227 #228 (migration 0012, lock released) #230 (merged by
  someone else before CI) + ledger PRs. **Tickets:** 29 done; 32 server half merged (follow-up with fixes + triggers in flight).
- **In flight (09:10 UTC):**
  (a) #239 board today: MERGED c552ab5 (09:09). Builder session_01KEBF26jsg9UEsX8tryR6QB finished: archive it.
  (b) #240 31 acknowledge (draft; head f1995ed; reviewed + fixed): builder session_01KEBF26FLSD7aUqQ4zXwbzo waits for "main moved": message it NOW, it merges main into #240 (reply-contract route count becomes 97), pushes once, you mark ready (`update_pull_request draft:false`), subscribe, merge on green server checks (static, secrets, api x3, pr-meta, gallery; browser red = the two sign-in specs red on main, see (d)). Then say "main moved" again for #241.
  (c) #241 31 part B roster + ladder settings API (draft; head 196daab; reviewed; the fix round is committed LOCALLY on claude/t31-roster-ladder-settings, same builder): after #240 merges the builder merges main in, sets the reply-contract count to 103, pushes once, updates the body; you mark ready and merge on green. Product notes for Nimish: roster/ladder are head/admin only; a plant head/supervisor cannot see who is on duty until a read view exists.
  (d) #231 35 devices + support access (head 889def0): server checks green; browser red on 3 web specs: who-is-acting wrong-current-password needs the web to accept 422 field 'old' (frontend PR #238 '21 fix: a signed-out phone goes to sign-in...' carries it plus the signIn fixture fix); held until #238 merges; then builder session_01KEBF27bzgyREScPzFL623W merges main in (one push), you mark/keep ready, merge on green.
  MERGED today (backend): #195 #199 #204 #206 #210 #211 #212 #216 #217 #220 #227 #228 #230 #233 #234 #239 + ledger PRs. Ledger PR for this file: open a draft PR from claude/orchestrator-backend (fragment changes/<PR#>-<slug>.md; run prettier and precheck).
- **Hardening ticket (queued, backend): all ticket commands on a SHARED login take the acting person from the session (tx.auth.personId), not body.personId (tickets/routes.ts resolveActingPerson shared branch); today a shared phone can name any active person. Also: acknowledge button needs a /state fact (assignee or rostered) + screen (FRONTEND).
- **Next (dispatch as slots free; cap 3 backend builders, ask FRONTEND for a 4th):** 31 g2 acknowledge command + roster/ladder API
  (+ seed ESCALATION_DEFAULTS as editable rows, 1-year roster purge); 33 escalation (needs 31+32); 34 sign-off (handback events, timeout,
  turnaround); 66 lockout flag; 26 leftovers (/brand rate limit, /state p95 test, stale /files wording); board today (FRONTEND ask 07:55, with waitingMin from Nimish Q10): `GET /api/v1/board/today` or /state returns today's tickets (plant-tz calendar day) + a pure domain day score (response = work start minus report; repair per v3 rules; waitingMin), feeds the board's 'Response today' / 'Repair today' tiles (#229);
  erased-stays-erased (keyed hash of normalised name+phone; may need a migration: ask for the lock); push_subscription.session_id (device
  sign-out drops push); zod 4 migration (lifts D28 exception); then M6 part 1 (55 needs lock, 71, 56, 72 incl. PR #173, 57; gate off until
  Nimish supplies signed Anthropic terms, Cosmos consent N14, cap figure, threshold) and M4a (36/37, leadership read API).
- **Answered by Nimish (relayed, "all yes"):** escalation defaults accepted as editable starting settings; support access = read all + change
  plant settings, no ticket/people writes, admin can end early (machine criticality kept refused: re-arms open tickets); erased person stays erased;
  PDF access and team day report yes; real Cosmos data in tests, names/phones invented.
- **Open for Nimish (batch via FRONTEND):** raise backend builder cap from 3 to 5? (recommended); "change plant settings" read as
  machines/segments/groups/shifts/logo/company/SLA/lists, not criticality; who merged #230/#225 from the GitHub page.
- **Do not:** edit MILESTONES.md or HANDOFF.md (FRONTEND owns them; if the session-end hook edits HANDOFF.md or wiki/log.md locally, discard);
  push to main; force-push; skip hooks. Ledger PRs: changes fragment named `changes/<PR#>-<slug>.md`, run `pnpm exec prettier --write`, `pnpm precheck`.
- **FRONTEND orchestrator:** session_01KEBF27UzWD37VxyiA2gNP7 (fresh Sonnet since 07:56 UTC; its handoff is docs/HANDOFF.md on docs PR #232; it grants the migration lock; the lock is free). Previous: session_01KEBF28FjJbxz9dfKVhZPSp (retired).

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
- 2026-11-14 05:30 UTC — 21 PR #199 (draft, head 03e3c5a) up; two adversarial Opus reviewers running (auth/sessions/
  tenancy; data/privacy/audit/tests). Builder rulings under review: token on another tenant's host = 401 (replaced the
  old "trusts the token, not the host" test); last enabled admin protected (409); must_change_password returned, not
  enforced server-side (would lock seeded logins); 400 vs the API's 422 (likely ruled to 422). MIGRATION LOCK granted
  by FRONTEND for 23 (function-only) and relayed. Rule: backend PRs stay DRAFT until the review passes (Nimish has
  merged before reviews finished). 20 goal 1 complete on main (#191 + #200, FRONTEND). Its builder
  session_01KEBF29QyDatvrERY9YAqZk handed to me; held on stand-by (read-only prep for 29) to keep the 2-builder cap.
- 2026-11-14 05:35 UTC — 21 goal 1 merged as #199 by Nimish at 05:30 (head aa54f05) before the reviews finished; 8/9
  green, api 1/3 still running. Reviews: auth/tenancy PASS with MEDIUMs (admin re-check after lock, session
  resurrection race, must_change_password unenforced, push subscribe race); data/privacy FAIL (HIGH: CrudPage contract
  mismatch; HIGH: switching off a person on an active ticket leaves them on the crew with an open work stretch;
  MEDIUM: shared phone signed out when its acting person is switched off, shared admin login unaccountable; LOW:
  password trim/Indian patterns, THIRD_PARTY row, phoneChanged). Held: phones never reach non-admins, E.164, no hard
  delete, one audit row per change in the same transaction, no test weakened, host rule correct.
- Rulings: (1) switch-off of a person on an active ticket = 409 "transfer or close first" (rewrites no history);
  transfer/pause targets must be active. (2) Shared phone keeps its session and push registration, forgets the acting
  person (D24/0009 precedent). (3) Shared login cannot hold admin (default for Nimish). (4) must_change_password
  enforced server-side behind `features.enforcePasswordChange`, default OFF until FRONTEND ships the change-password
  step (else seeded Cosmos logins are locked out). Cost if wrong: temporary passwords stay usable until then.
  (5) Validation = 422 everywhere. All sent to builder 21 as one follow-up PR (claude/t21-followup), draft until my
  re-check.
- 2026-11-14 05:40 UTC — RULINGS (Nimish via FRONTEND): (1) MERGES = option A: only the two orchestrators merge;
  Nimish tests staging. Must be as fast as his own merging: the adversarial review starts the moment a PR opens (in
  parallel with CI), ~30 min, one fix round, merge within minutes of green + review pass. Builders now report the PR
  number at first push. (2) Defaults accepted: a shared login cannot hold admin; switching off a person on an open
  ticket is refused until it is transferred or closed.
- Migration-runner flake (both lanes, FRONTEND asked): root cause found by me: pg-pool end() resolves before sockets
  close; container.stop() then killed the still-ending admin-pool backend (57P01, CI dump: database 'test',
  _poolUseCount 13 = the 13 partial databases). Fix: endPool() waits for every 'remove' event; draft PR #204
  (test-only), merge on green.
- 2026-11-14 05:48 UTC — FRONTEND orchestrator handed over: new FRONTEND = session_01KEBF29s188PmJ6P6e68eEZ (old
  session_01KEBF28rZZwgSDVMzdNjw77 ended). The MIGRATION LOCK for 23 stays granted. 23 draft PR #206 opened; two
  adversarial reviewers started in parallel with CI (migration/files; contract/guards). Main red since #196/#199:
  FRONTEND's #205 fixes #196's browser part; builder 21 fixes #199's part (secrets, sign-in refusals). Queued for the
  next free slot (FRONTEND request, from approved mockups): operator may upgradeKind support->stopped (DOMAIN section 3
  change + test); work requests get WR refs not BD (ref-counter bug + test). Infra (FRONTEND): logos on server disk
  FILES_DIR need a persistent, backed-up volume until S3.
- 2026-11-14 05:52 UTC — FRONTEND #205 merged (8de140e): main's browser part fixed; builder 21's fix narrows to #199's
  secrets part. FRONTEND asked: 18 goal 2 server (breakdown PDF with v3 QR, day report on real shifts, Gujarati) before
  29 (M1, blocks cutover). The stand-by session had ended; dispatched a fresh builder session_01KEBF2AEVwnmoe18e8BYdfW,
  branch claude/t18-pdfs-day-report. Backend at 3 builders for now, counted against the combined cap of 5 (told
  FRONTEND). Ruling: the shared-phone signal is /auth/me actingPerson null + 403 code 'choose_acting_person' (21
  follow-up). FRONTEND rulings: logo volume = docker named volume + nightly tar to the backup bucket (FRONTEND
  infra PR); board filter = FRONTEND #203.
- 2026-11-14 06:00 UTC — #206 (23) reviews: reviewer 1 (migration/files) FAIL: logos on disk cannot work on the
  deployed image (USER node, root-owned /app, no FILES_DIR in refresh-env.sh, no volume) + lowercase/alias time zone
  -> 500; definer functions, grants, search_path, tenancy, upload limits held. Reviewer 2 (contract/guards) FAIL:
  restore/correct put an active ticket on a switched-off machine; a tenancy test proved nothing (old PATCH verb);
  segment active=false leaked to the floor picker; LOWs (blank on create, fail-open guard Map, hard-coded dates,
  contract helpers private, wrong 409 field). Held: legacy /lists untouched, route count only grew, race safe.
- Rulings: (1) logos stored as bytes in the database (bytea on `file`, in 0011), no disk, no volume: RDS backups cover
  them; supersedes the FRONTEND volume plan (told the likely new FRONTEND session_01KEBF28FjJbxz9dfKVhZPSp and its
  infra builder). (2) Settings READ routes are head/admin only (supersedes my 05:35 'reads open'); floor/desk read
  /config. (3) Segment active=false refused (422) until 29, like shifts/glossary. (4) The switch-off guard fails
  closed. (5) Contract helpers exported from one place; people routes adopt them after #206 merges. One fix push.
- 2026-11-14 06:00 UTC — RULING (Nimish, direct): pace matters as much as green. Do not wait for all 9 checks or rerun
  the whole suite for a small change. Merge when the checks that cover the change are green (static, secrets, the
  api shard or browser job that runs the touched tests, plus the touched tests run locally) and the review has no
  blocker; an unrelated slow or flaky job does not hold a merge, and no full re-run for one flaky test. Builders run
  only affected tests locally. Applied at once: merged #202 (ledger, docs only) and #204 (test teardown fix: static,
  secrets, gallery, pr-meta, api 1/3 green; the 7 touched db test files green locally) without waiting for browser.
  Nimish is not merging himself for now. 21 follow-up #210 (draft, 251e5ab) opened; scoped re-check running.
- 2026-11-14 06:03 UTC — Merged #211 (3d03ad7, builder 21): .gitleaksignore fingerprints for the squash commit of #199
  (secrets only; with FRONTEND #205 main should be green for new pushes). FRONTEND confirmed: new FRONTEND =
  session_01KEBF28FjJbxz9dfKVhZPSp; logo volume PR #209 closed; combined builders 5; pstack on main (#208): builds via
  /poteto-mode, reviews ponytail-review + /interrogate for schema/auth/permissions/tenancy/deletes/history.
- #210 (21 follow-up) re-check: items 1-3, 5-9 FIXED (sign-in with a stored weak password = 200 verified); item 4 done
  in 9ebe091 (403 'choose_acting_person'; /auth/me keeps '' plus optional actingPerson). Sent 4 LOWs (lock order
  deadlock -> 500, join race FOR UPDATE/FOR SHARE, admin count, handover check order). #212 (18 goal 2 server: QR
  mid = machine code like v3, day-report windows from the shift table, pending-at-end fix; cut: plant_head team report)
  in one adversarial review. Queued small ticket for FRONTEND asks: POST /tickets/past (no recordPastBreakdown exists
  in domain; figures stored from entered start/finish), operator upgradeKind, WR refs.
- 2026-11-14 06:05 UTC — #212 review (one Opus): PASS with fixes (QR = v3's own bdQR on real tickets; IST windows;
  domain minutes; Gujarati read back; #182 kept). Fix push asked: pending-at-end from event history (restore clears
  cancelled_at), plant_head interim 403, QR mid = machine code at report time (snapshot first), note the whole-day
  default. NIMISH ANSWERS (via FRONTEND, 'all yes'): breakdown PDF = operator only own reports (shared floor login: its
  cell), technician and above all, board none; team day report for plant_head is M1 (before cutover). Both go to
  builder 18 as a follow-up PR (claude/t18-team-report-pdf-access) after #212 merges; DOMAIN section 3 gains the PDF row.
- 2026-11-14 06:15 UTC — Merged #212 (cbaaf2a, 18 goal 2 server): QR = v3 (machine code at report time), day report on
  real shift windows (IST), pending-at-end from events, Gujarati, plant_head interim 403; merged on 8/9 (api 2/3 still
  running; touched tests green locally) per the pace ruling. Builder 18 started the follow-up (team day report + PDF
  access per Nimish). #210 (21 follow-up) e6c2bf1: + shared login may sign in without an acting person (FRONTEND
  request, Nimish's approved flow; POST /auth/acting picks; 403 choose_acting_person until then); merges on api +
  browser (it touches sign-in). #206 re-check: A-H fixed; one blocker (logo PUT with a non-image body -> 500) + 2 LOWs
  sent; merge waits for FRONTEND 'drill done'. NEW backlog item: legacy GET /settings, /lists/:list,
  /translations/missing are open to every role (check web callers, then gate to head/admin).
- 2026-11-14 06:18 UTC — Nimish (direct): "merge 206 now, don't wait for the drill". Merged #206 (0e37df7): 23 server
  (lists, glossary, company name/language/time zone, logo as DB bytes, /files/:id, /brand/logo, migration 0011
  additive) + #195 review fixes; re-check PASS after the logo-500 fix (469008b); merged with secrets green and the
  rest running. MIGRATION LOCK released (told FRONTEND; warned that the next staging deploy applies 0011, so time it
  after the drill). Builder 23 -> next ticket claude/server-small-items: operator upgradeKind, WR refs, POST
  /tickets/past (+ domain function), gate legacy GET /settings, /lists/:list, /translations/missing. Builder 21 ->
  contract commit on #210 using the helpers now on main.
- 2026-11-14 06:35 UTC — Main red again (api): #212's reports-real shift test read GET /shifts as an array + PATCH;
  #206 changed it to {items,nextCursor} + PUT. Fixed by me in #217 (d36c1fc, test-only, merged on static/secrets +
  local run). Lesson: under the pace ruling, merge a PR whose base is stale only after merging main into it when two
  PRs touch the same contract. Merged #215 (ledger). Merged #210 (a1bdee9, 9/9 green): 21 follow-up = security fixes,
  shared login without acting person (POST /auth/acting), CrudPage contract for people/logins (reusing #206's
  helpers), secrets fix (runtime-built test passwords + one fingerprint for d8ef0b7). #216 (team day report + PDF
  access) review FAIL vs v3 (membership dropped 1,382 real minutes, Closed/Pending contradiction, switched-off people
  vanish, no Primary/Support split): ruled 'follow v3 exactly', fixed in ba5a51e; merges on static/secrets/api.
  Builder 21 -> 'M1 server leftovers' (26 dependency advisory in CI, audit 11/12/14/17/19, erase_person import_row).
  POST /tickets/past final contract sent to FRONTEND (three times reported/workStarted/running; overlap 409).
- 2026-11-14 06:52 UTC — Merged #216 (dd8fab0, 9/9; team day report per v3 + breakdown PDF access) and #218 (ledger).
  MIGRATION LOCK granted by FRONTEND for 29 (builder 18, claude/t29-m2-schema; conditions: interrogate + schema
  review before merge, warn if the restore drill still runs, 'released' on merge). #220 (small server items) review
  FAIL (operator could upgrade closed/cancelled tickets) + 3 MEDIUM/LOW, fixed; builder caught its own import
  regression (shared event writer) before merge, fixed in dd616cd. Since ~06:47 UTC GitHub Actions starts no jobs
  (every job fails in 1-2 s, runner_id 0, logs 404) on all branches: likely Actions minutes/spending limit or outage;
  Nimish asked to check billing. Ruling (both lanes): no merges until CI runs again; builders keep working.
- 2026-11-14 06:56 UTC — Actions recovered at 06:51 (outage ~4 min; billing check not needed); re-ran failed jobs once
  on #220 and #223. RULINGS (Nimish): (1) CI cost rules (#224): drafts run no CI; local precheck + touched suites
  before every push; CI runs once when the orchestrator marks ready; no CI on push to main; one re-run max.
  (2) "pstack on in the backend sessions": every backend builder runs its ticket through the poteto-mode skill
  (Skill tool, playbook named in the PR), delegates as poteto-agent subagents, models per
  .claude/rules/pstack-models.md; my adversarial reviews follow .claude/skills/interrogate/SKILL.md (findings only
  when proven by a run). All three builders told; each confirms poteto-mode is loaded.
- 2026-11-14 07:02 UTC — poteto-mode and interrogate are user-invocation only (disable-model-invocation); a relayed
  message cannot load them (builder 23 correctly refused). Ruling: every new ticket starts in a FRESH session whose
  first message is '/poteto-mode <brief>'. CONFIRMED working: builder 35 (session_01KEBF27bzgyREScPzFL623W) reports
  "poteto-mode loaded (Feature playbook)". FRONTEND adopted the same. Running builders (29, M1 leftovers) finish by hand.
  Merged #220 (d3d03ce, 9/9; small server items). Builder 23 archived. Dispatched 35 goals 2+3 (devices; support access
  with admin approval, 7 days, audited) + auth/password wrong-old = 422 (FRONTEND ask). FRONTEND restore drill A passed.
- 2026-11-14 07:10 UTC — Reviews: #228 (29) reviewer A FAIL: erase_person misses handover signatures now that reports
  link handover_person_id (HIGH) + last_error free text, event/ticket mismatch, DELETE grants on segment/shift/glossary
  (LOW); sent, reviewer B pending. #227 (M1 leftovers) FAIL: re-import after erase writes the erased name back into
  import_row (HIGH, new leak) + ref check, touch race, SCRAM normalisation, README (LOW); sent. #35 rulings: support
  access by hashed high-entropy keys (interim, ADR), support grants may read + change plant settings but may NOT write
  ticket history or people (default for Nimish). Today's cap 6 builders (FRONTEND 3, BACKEND 3). Follow-ups queued:
  (a) erased person stays erased on re-import: HMAC(server secret, normalised name+phone) record, never the name
  (FRONTEND ruling; Q13 to Nimish); (b) push_subscription.session_id so signing out a device drops its push (next
  migration); (c) zod 4 migration to lift the single audit exception (D28).
- 07:20 UTC #227 api(1/3) red: import-real erase test is order-dependent (LIMIT 1 without ORDER BY; the fingerprint
  now tolerates erased envelopes, so undo refuses only when a fingerprinted ticket column changed). Sent builder 21
  one fix round: deterministic person + a second case (named only in raw rows → undo succeeds). No job rerun.
- 07:24 UTC #227 fix 160c5b6 checked (person ORDER BY id + precondition from erase_person counts; refusal assertion
  intact; new case: raw-rows-only erasure leaves undo allowed). pr-meta red on size (830 > 800): Ruling: "Large PR"
  line, not a split (seven separate audit items, each its own commit and test; a split costs seven CI runs; cost if
  wrong: a harder review, already done). Ruling: #227 accepted without a pstack playbook (built before the rule);
  every later backend ticket starts in a /poteto-mode session.
- 07:27 UTC #228 fix round 4586b2e (A's 4 + B's list + handoverName display ruling; main merged) scoped-checked:
  criticality test restored and stronger (revision rises, due = reported_at + S3 minutes), lock_timeout 5s,
  check-migrations scans down/ (backup line required), 409 last active shift, 422 switched-off segment. Marked ready.
- 07:33 UTC MERGED #228 (29 M2 schema, migration 0012) as f89bd7b, 9 green at 4586b2e. MIGRATION LOCK released to
  FRONTEND. Builder 29 session archived. #227 green at 160c5b6 but overlaps 0012 (erase_person replaced,
  pdf-template.ts): builder 21 merges main and re-runs import/report suites before I merge (lesson from #212 x #206).
- 07:34 UTC DISPATCH 32 notification service (server half of goal 2 too) to session_01KEBF2AVUMZygMWkC4M5two (Sonnet high per pstack-models; a first Opus session was archived within a minute) via
  /poteto-mode, branch claude/t32-notification-service. Backend builders now: 21 (#227 finish), 35, 32.
- 07:47 UTC MERGED #227 (M1 leftovers) as 16384c5, 9 green at 7d42dad. Builder 21 archived. Nimish "all yes" Q10-Q13
  (relayed): escalation defaults accepted as editable starting settings; support access = read all + change plant
  settings, no ticket/people writes, admin can end early; erased person stays erased (keyed hash of normalised
  name+phone); waitingMin to be exposed on ticket figures (follow-up ticket for the backend lane).
- 07:44 #230 (32 notify, draft, f5d6e5f): one adversarial reviewer running. Ruling: new breakdown -> active people with
  login role maint or supervisor in the plant; complaint fixed -> the ticket's reporter (v3 parity row). The trigger is a
  second small PR from the same builder after #230 merges (cost if wrong: recipient list only).
- 07:46 #231 (35 devices + support access, draft, f84627f): two reviewers running (Opus guard/tenancy, Sonnet allowlist/
  lifecycle/devices). Builder's own worries: PUT /settings/:key allowed whole, loginId = approver under a grant, grant
  outlives approver, ip-only rate limit.
- 07:42 Nimish: pace complaint, and "you rebuilt instead of reusing". Checked: from the 13 Nov baseline (eb80a47, 145
  non-test src files) 38 moved, 49 edited, ~23 untouched, 35 deleted, 283 added; one apps/server, one apps/web. Not a
  rewrite. Gap-check agent running over tickets 19/24/26/27/30/31/33/34/66; every new brief starts with "what exists".
- 07:50 UTC #230 (merged 07:45:56 by the shared account, not by this lane, before CI) review: 2 HIGH (retry dropped
  under app/DB clock skew; no sweeper so a dead job leaves the row pending until purge deletes it), 2 MEDIUM (test
  button holds a pooled connection; crash after send double-sends: document), 5 LOW. All sent to builder 32 as the
  first commits of the trigger PR. #225 (frontend) also merged by the shared account with browser red: both lanes
  agreed one merge route (orchestrators, covering checks green).
- 07:52 UTC Gap check at 16384c5 (read-only, tickets 19/24/26/27/30/31/33/34/66): none of the open tickets is mostly
  built; only schema and constants exist (0012 columns, ESCALATION_DEFAULTS, 0007 pause_max_minutes/handback_minutes
  never read). T26 g1 nearly done (missing: /brand-specific rate limit, stale /files wording, 500-machine /state p95
  timing test). Duplication: none found; two notes: T32 must extend the notifications module (done in #230), pause max
  and handback minutes live in sla_policy columns and sla_timer kinds (use the policy columns, do not add new).
  DISPATCH 30 (pause clock, server) to session_01KEBF269NGcjLaBDHMKLsLU, branch claude/t30-pause-clock, gap-only brief.
  Backend builders: 32 (#230 fix round + triggers), 35 (#231 under review), 30.
- 07:58 UTC #231 reviews done (Opus guard/tenancy: no HIGH; Sonnet allowlist/devices/lifecycle: no HIGH). Rulings:
  support may not change ai.monthlyCapUsd or features.enforcePasswordChange; grant checks approver is a live admin per
  call; machines/segments/groups/shifts/logo added to SUPPORT_WRITES, machine criticality stays refused (re-arms open
  tickets' SLA clocks = history); wrong-key limiter counts failures only; logs bind the grant; device sign-out audited;
  /auth/me gains optional supportGrantId; per-grant refusal flood = accepted insider-only nuisance (in D29).
  Sent to builder 35 for ONE batched push. Product line for Nimish (via FRONTEND, batch): "change plant settings"
  read as machines/segments/groups/shifts/logo/company/SLA/lists, not machine criticality; say if wrong.
- 08:03 UTC #233 (32 follow-up: #230 review fixes + the two v3 push triggers, draft, 5cdfb89) and #234 (30 pause clock,
  draft, 2a5b3d3) opened; one Opus reviewer each running. #231 (35) CI running at 889def0. New FRONTEND orchestrator
  session_01KEBF27UzWD37VxyiA2gNP7. Rulings accepted: breakdown push -> technician+supervisor, only kind 'stopped'; fixed ->
  reporter unless they closed it; any pause arms the pause clock (reviewer to judge pausesSla=false).
- 08:12 UTC #233 fix push 4549ee8 (savepoint per listener, sweep claim, upgrade-kind alert, batched fan-out) checked and
  marked ready (CI running). #234 reviewed: 1 HIGH (clearing the pause max leaves an armed clock that still breaches),
  1 MEDIUM (cancel/restore after a fired pause can never breach again), 4 LOW; sent for one fix push. Ruling: the pause
  clock is NOT armed for reasons with pausesSla=false (production's wait, 34's handback clock; cost if wrong: a missing
  breach). Open for Nimish (batch): overnight vendor waits breach overnight (wall-clock pause limit); alerts reach only
  people with a personal login of the role (Cosmos has shared floor logins). #231 held until the web PR (401 or 422 'old'
  - signIn fixture) lands; #231 browser red = 3 web specs, not server.
- 08:14 UTC #233 CI at 4549ee8: static, secrets, gallery, pr-meta (after Large PR line), api 2/3, 3/3 green; api 1/3 running;
  browser 1/2 and 2/2 red = ONLY the two specs red on #231 too (settings-severity.spec.ts:133, sla-timers.spec.ts:64, both
  at the signIn fixture; 11 + 27 tests did not run as a result): leftover on main from #225, not this PR. Ruling: merge #233
  on api green; risk: the ticket-event listener is untested by those 38 e2e tests (it is savepoint-isolated, 136 other e2e
  pass). #234 fix push 85af3f1 checked (retired pause clock stops the armed row; restore = new episode; restart only when
  previous status waiting; pausesSla=false arms nothing) and marked ready, CI running. Leftover from builder: a breach owed
  by pause 1 can be lost if pause 2 starts before the job runs (needs a column; 33 must fire it at startsNewPause).
- 08:17 UTC MERGED #233 (32 follow-up: notify review fixes + two v3 push triggers) as f5e5e9d on server checks green; browser red =
  the two specs already red on main. Builder 32 session archived. DISPATCH board-today (response/repair/waitingMin day score +
  GET board/today) to session_01KEBF26jsg9UEsX8tryR6QB, branch claude/board-today, gap-only brief.
- 08:25 UTC #234 round at 6505091: (1) /state golden broke because `sla.pause:null` was emitted -> key now omitted when no
  pause clock (golden untouched); (2) sla-jobs real-worker pause test timed out at 60 s in CI: root cause = TestClock ticks
  fire a DB round-trip per simulated 0.5 s poll, the test simulated ~90 min (about 7,000 polls, 54 s locally); fixed by a
  1-minute pause maximum like the siblings, same assertions (59 s no fire, fire once, 60 s later no second fire).
  Lesson for briefs: a builder must run the files that read what it changes (the /state golden), and keep fake-clock spans short.
- 08:30 UTC #239 (board today) reviewed: no HIGH; rulings sent: tiles cover kind 'stopped' only (flip = one filter; for Nimish batch:
  general/support requests are not in Response/Repair today), the day's set = stopped tickets reported today OR closed today OR still
  open now, child follow-up tasks excluded, closed-without-start tickets use stored figures and are not 'not started'; closed_at
  index (tenant_id, closed_at) carried to the next migration batch; DOMAIN.md section 4 needs a row for GET /board/today (frontend/docs).
- 08:33 UTC MERGED #234 (30 pause clock) as 3b7c96b: api 3/3, static, secrets, gallery, pr-meta green at 6505091; browser red =
  the known sign-in leftover on main (18 not run). Builder 30 archived. DISPATCH 31 (acknowledge command first, then roster + ladder
  settings API + 1-year roster purge, defaults seeded as editable rows) to session_01KEBF26FLSD7aUqQ4zXwbzo. Carried to the next
  migration batch: index (tenant_id, closed_at) for the board-today query; a column for the pause-episode start (pause 1's owed breach
  can be lost when pause 2 starts before the job runs; 33 must fire it at startsNewPause in repo/timers.ts).
- 08:47 UTC #240 (31 acknowledge, draft, f?) reviewed: HIGH shared login could acknowledge as any rostered person (body.personId over the
  chosen acting person); MEDIUM roster date from a different shift than the shift lookup (night shift after a 3x8 -> 2x12 change);
  MEDIUM which DOMAIN row governs. Rulings: acknowledge = ticket assignee OR the person on the roster for the shift running now (roles
  technician/supervisor/head/plant_head, vendor level excluded), admin NOT passed (ticket text; cost if wrong: one check in canAcknowledge).
  FOLLOW-UP TICKET (hardening, backend): all ticket commands on a SHARED login must take the acting person from the session
  (tx.auth.personId), not body.personId (tickets/routes.ts resolveActingPerson shared branch); today a shared phone can send any active
  person id. Product note for Nimish via FRONTEND: acknowledge button needs a /state fact (am I rostered/assignee) + the screen.
- 09:10 UTC RESTART #3 (orchestrator session_01KEBF2A79g1EjjKrbU4mw4v): told builders 31 (session_01KEBF26FLSD7aUqQ4zXwbzo, 'main moved' for #240) and 35 (session_01KEBF27bzgyREScPzFL623W, held for #238) and FRONTEND the new parent id; archived the board-today builder. DISPATCH 34 sign-off server half to session_01KEBF2AcM6Y76S8SYWfhzrz, branch claude/t34-signoff, gap-only brief. Backend builders now: 31, 35, 34. Next free slot: hardening (after #240 merges: both touch tickets/routes.ts), then 66.
- 09:11 UTC FRONTEND (09:09): #238 on its single CI run, merges on green and tells me at once (then #231 proceeds). FRONTEND asks BACKEND to freeze a /state fact for the acknowledge button ("am I assignee or on today's roster for the running shift") before the mockup: folded into the hardening ticket (same routes), contract to be frozen in its PR. Builder cap stays 3 until Nimish answers.
- 09:20 UTC MERGED #240 (31 acknowledge) as 6eb44a7: static, secrets, api 3/3, gallery, pr-meta green at 5466c79 (pr-meta first failed on size 931 > 800: "Large PR" line added to the body, re-ran green); browser red = only settings-severity:133 and sla-timers:64 (known on main). Builder 31 told "main moved" for #241. Builder 34 accepted its defaults 1-5 (handback = ticket_event types + sla_timer row, no migration; dispute downtime counts from dispute time; confirm/dispute actor from session) and rebases now.
- 09:22 UTC FRONTEND ask (live-board web PR #242 blocked on it): GET /board/today defect: day score ignores #203's hidden groups / off-board segments (must filter tiles AND counts server-side, failing test first); plus additive per-figure counts (closed tickets feeding each average). QUEUED as "board-today fixes", dispatch when #241 merges (slot), reply FRONTEND with the PR number. Ruling: this is a defect in my merged #239, goes first in the queue, ahead of hardening.
- 09:33 UTC MERGED #241 (31 roster + ladder settings API) as 352eeff: static, secrets, api 3/3, gallery, pr-meta green at b693fab; browser red = the same two specs (settings-severity:133, sla-timers:64) + shard 5-min timeout (#238 raises it). Builder 31 archived. DISPATCH board-today fixes (hidden groups/off-board segments out of tiles+counts; per-figure closed counts) to session_01KEBF261gQn6vb4qEEwhCd1, branch claude/board-today-fixes, for FRONTEND's #242. Backend builders: 34 (session_01KEBF2AcM6Y76S8SYWfhzrz), 35 (#231, held for #238), board-today fixes. Carried: ticket 33 must call ensureEscalationDefaults before reading rules; read-only roster view for plant head/supervisor; hardening ticket (+ /state acknowledge fact) next free slot.
- 09:40 UTC #243 (board-today fixes, draft, 1cf68d1, 180 lines) up: offBoardMachineIds now on the server (plant module), counts responseCount/responseClosed/repairCount/repairClosed added. Opus review: PASS, no HIGH or MEDIUM; 3 LOW (waiting-average comment wording; cross-plant test cannot fail; hidden-machine tests use an unstarted ticket, so averages are not proven): sent to builder for one fix push. Product note sent to FRONTEND: averages include still-open tickets measured to now, so the text should read "average of 6, 4 closed". #244 (34 sign-off, draft, 282da5b, 1247 lines, no migration): DIRTY vs main (#241 merged after its rebase; reply-contract count must become 104), so no CI until main is merged; two reviewers running (Opus auth/permissions/reopen, Sonnet timer/figures/tests); builder told to hold its push, then ONE push: main merged, review fixes, count 104.
- 09:48 UTC #244 (34 sign-off) reviews: Opus (auth/permissions/reopen) PASS on auth, tenancy, history, shared login; Sonnet (timer/figures/tests) PASS; no HIGH. Real bugs sent in ONE fix list: turnaround after dispute then re-close (production time lost), day report 'pending at end' ignores a dispute, loadReport takes the first of two breakdown reports after a re-close, dispute while a new breakdown is open on the machine gives an unrelated 409, queueAction must not fire a stopped handback clock, missing negative tests. Rulings: ask only on closeWithReport (builder widened to every close; DOMAIN says closeWithReport; cost if wrong: one flag); repairMin excludes the closed-to-dispute gap if small else stated; supervisor+ may confirm own close (matrix wins; for Nimish). For Nimish via FRONTEND: dispute while a new breakdown is open is refused with a clear message (not linked); supervisors can confirm their own fix. Leftovers listed in the PR body.
- 09:50 UTC MERGED #243 (board-today fixes) as ee82518: static, secrets, api 3/3, gallery, pr-meta (after a "No parity" line) green at 1e81b73; browser red = only the two known specs. Builder (session_01KEBF261gQn6vb4qEEwhCd1) archived. FRONTEND told. Backend builders now: 34 (#244 fix round), 35 (#231 held for #238). Free slot: dispatch hardening (acting person from the session for ALL ticket commands on a shared login, plus the /state acknowledge fact for FRONTEND), then 66.
- 09:51 UTC DISPATCH 26 leftovers (/brand rate limit, /state p95 on a 500-machine fixture, stale /files wording, behaviour tests for the other 26 clauses) to session_01KEBF28N44Vubs3SeSNhv56, branch claude/t26-leftovers, gap-only brief; told to stay out of tickets/routes.ts and the handback area (#244). Backend builders: 34 (#244 fix round), 35 (#231 held for #238), 26. Queue next: hardening + /state acknowledge fact (after #244 merges: same routes), one MIGRATION BATCH ticket (closed_at index, pause-episode column, push_subscription.session_id, erased-stays-erased keyed hash; ask FRONTEND for the lock when a slot is free), 66 lockout (after #244: tickets domain), M6 part 1, M4a.
- 09:56 UTC #245 (26 leftovers, draft, 5728543): gap check found only two real gaps: /brand and /brand/logo get the login's 60/min per-client cap (kernel/public-cap.ts), and a 500-machine /state scale test (measured p95 about 22 ms vs the 300 ms budget); one stale ARCHITECTURE row; everything else in 26 goal 1 already had tests; /files serves logos only (no PDFs stored). One Sonnet reviewer running (client-key spoofing, shared-NAT floor, composes with #238's E2E_RATE_LIMIT_MAX, test flake). FRONTEND warned: whoever merges second makes /brand honour the e2e raised limit; #245 builder merges main after #238.
- 09:58 UTC #244 fix round pushed (51917b8, main incl. #243 merged, count 104): turnaround across a dispute (90/250), day-report pending-at-end counts a dispute, loadReport takes the latest report, dispute while the machine has another open ticket = clear 409, stopped handback clock never fires, negative tests added, asked only on closeWithReport closes (DOMAIN row reworded), repair and downtime exclude the closed-to-dispute gap. Marked ready, CI running. Leftovers in the PR body. #245 Sonnet review: PASS, MEDIUM ruled: /brand and /brand/logo get their own 300/min per-address cap (login stays 60; cost if wrong: more public brand reads), Retry-After assertion, proxy-in-front note; merges only after frontend #238 (e2e raised limit must reach /brand).
- 09:58 UTC FRONTEND ask (queued, not urgent, small): apps/server/test/auth.test.ts timing-ratio cases (unknown username / erased login "takes similar time as a wrong password") fail once under full-suite load, pass alone, no server change in the failing diffs: root-cause (too few samples, ratio of noisy timings, shared pool with other tests) and make deterministic without weakening what they prove (no skipping; keep the constant-time-ish assertion). Goes to the next free builder with the hardening ticket (same auth area, test code only). Never accept a "flake" rerun habit.
- 10:05 UTC MERGED #244 (34 sign-off server half) as 03e54d3: static, secrets, api 3/3, gallery, pr-meta green at 51917b8; browser red = only the two known specs. Builder 34 archived. DISPATCH hardening (acting person from the session for all ticket commands on a shared login; /state acknowledge fact; auth timing-test root cause) to session_01KEBF27di87MeBMpmZfCXzu, branch claude/hardening-acting-person, auth-critical (two reviewers). Backend builders now: 35 (#231, held for #238), 26 (#245, held for #238), hardening. Queue: 66 lockout, migration batch (lock via FRONTEND), M6 part 1, M4a. For Nimish via FRONTEND (sent 10:05): dispute refused (not linked) when the machine has a new open breakdown; supervisor/head may confirm own fix; sign-off asked after closes WITH a report only.
