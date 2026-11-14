# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (frontend orchestrator session_01KEBF28FjJbxz9dfKVhZPSp, 14 Nov 2026 ~08:30 UTC)

**Two lanes (CLAUDE.md):** FRONTEND orchestrator (apps/web, infra, staging, MILESTONES, HANDOFF, `docs/plan/ledger.md`)
and BACKEND orchestrator session_01KEBF2ANCJYSxcYWMb43Pwz (apps/server, packages, scripts; `ledger-backend.md`).
One migration in flight across lanes; FRONTEND grants the lock (now held by backend for 29, M2 schema).
**Merges:** only the orchestrators. **CI cost rule (Nimish, #224):** drafts run no CI; builders run precheck and the
touched suites locally; CI runs once when the orchestrator marks a PR ready; no CI on main. Actions budget is Nimish's.
**pstack:** vendored in `.claude/skills` (#208, #214). New tickets start in a fresh session whose first message is
`/poteto-mode <brief>`; reviews are ponytail-review plus `/interrogate` for schema, auth, tenancy, deletes, history.
**Screens:** only from approved mockups (`docs/design/LOCK.md`); desktop layouts live in the patterns (#222).

## M0: CLOSED (Nimish: "GO - IT WORKED", 14 Nov; signed in on staging as the admin)

Restore drill A passed (11-minute point-in-time restore, counts identical). The weekly dump is carried into M1.

## In flight (frontend)

- #222 desktop patterns (side panel, sortable tables, SideNav), ready, one CI run, then merge. Then PR-C, the desk
  two-pane (builder session_01KEBF26LgQj2ZmZDx8Km8Mi).
- #225 who-is-acting + change password (builder session_01KEBF28gYoZ8XReuz1auL6F): /interrogate FAIL, fixing the
  /who-/password reload loop and outbox entries recorded per person.
- 25 live board (session_01KEBF28GwjEXv9mZoRUHYCf) from the approved combined board, 'now' version.

## Next frontend (as slots free, each a fresh /poteto-mode session)

22/23 settings screens as CrudPage config, then 20/21 people + audit, then 19 follow-up tasks plus the past-breakdown
screen (POST /tickets/past contract in the ledger), and the outbox follow-up (any permanent refusal leaves the queue,
visibly). Slice 4 canvas (phone + desktop + icons): https://claude.ai/artifact/7iLVAMkHLQ8ncGEg5ZWhXL.
Live board (approved): https://claude.ai/artifact/M3Gc2VpfMqTBrQ6u6MrV6p.

## Waiting on Nimish

M0 go; Q10 repair vs waiting (recommend v3 rule plus a separate waiting figure); Q11 escalation defaults (recommend
accept); the 31 status labels; the Actions budget alert; the weekly dump (RESTORE.md §0).

## Staging

https://cosmos.3-108-95-203.sslip.io, deploys on every merge to main. Server i-0c8debfdec0da8209, RDS
uptimo-postgres, ap-south-1. Cosmos loaded (192 machines, 26 logins, 275 tickets).
