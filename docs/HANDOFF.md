# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (frontend orchestrator handover, 14 Nov 2026 ~09:15 UTC)

Start with: "Orchestrate `docs/plan/MILESTONES.md` per `CLAUDE.md`." You are the FRONTEND orchestrator (apps/web, infra,
staging, MILESTONES, HANDOFF, `docs/plan/ledger.md`). The BACKEND orchestrator is session_01KEBF2ANCJYSxcYWMb43Pwz
(apps/server, packages, scripts; ledger-backend.md). Restart yourself at ~60% context (Nimish's standing rule).

**State:** M0 closed (Nimish "GO - IT WORKED", 14 Nov). M1 is current. Staging https://cosmos.3-108-95-203.sslip.io
(admin login `bhaven`; the password is the first-sign-in password Nimish chose, never in any file).

**Rules today (all in the ledger):**

- Only the orchestrators merge, on the covering checks green. Nimish said he will NOT merge from the GitHub page.
  Rulesets are not enforced on a private personal repo, so a habit, not a setting, holds the line.
- **CI cost (#224):** drafts run no CI; builders run `pnpm precheck` + the whole spec files they touched locally and push
  once; the orchestrator marks a PR ready (one CI run); no CI on main. Actions spend was ~$42 in 14 days; the budget
  alert is Nimish's to set (billing page).
- **New tickets start in a fresh session** whose first message is `/poteto-mode <brief>` (the skill cannot be loaded from
  a relayed message). Reviews: ponytail-review + `/interrogate` for schema, auth, tenancy, deletes, history.
- One migration in flight; FRONTEND grants the lock (none held now; #228 released it).
- Builder cap 6 across lanes for today (frontend 3, backend 3). Screens only from approved mockups (`docs/design/LOCK.md`).

## In flight (frontend)

- Sign-in builder session_01KEBF28gYoZ8XReuz1auL6F: ONE new PR (not yet opened): signed-out /floor and /desk redirect to
  /login (they hang on "Loading…" today: reproduced), visible error + retry on failed loads, the "Could not send. Try
  again." message (name the real failure), the 2 stray browser errors (run 43571698489), the sign-in /config change
  (8051c6e), an e2e-only login-limit env var. Mark ready when it says so.
- Pattern builder session_01KEBF26LgQj2ZmZDx8Km8Mi: PR-C, the desk two-pane (list left, detail right from 1024 px).
- Live board builder session_01KEBF28GwjEXv9mZoRUHYCf: #229 merged (goal 1). Left: its response/repair-today tiles
  (need backend, asked) and goal 2 (alerts, push, update banner, WhatsApp text).
- Designer session_01KEBF29W6XpMpBRfZAEgga6: slice 4 phone + desktop + icon frames done; idle.

## Next frontend tickets (each a fresh `/poteto-mode` session)

22/23 settings screens (CrudPage config, D5), 20/21 people + audit, 19 follow-up tasks + the past-breakdown screen
(`POST /api/v1/tickets/past` is live; contract in the ledger), the outbox follow-up (a permanent refusal must leave the
queue visibly; entries are now per person), the account sheet's "Change" using `askWhoIsActing()`, the repair/"waiting"
figure next to repair on ticket screens (Q10). Mockups: slice 4 https://claude.ai/artifact/7iLVAMkHLQ8ncGEg5ZWhXL, live board
https://claude.ai/artifact/M3Gc2VpfMqTBrQ6u6MrV6p.

## Waiting on Nimish

Actions budget alert; the 31 status labels; weekly dump (RESTORE.md §0, 2 commands). Answered today: Q10 to Q13 ("all
yes": v3 repair rule + a waiting figure; escalation defaults; support access; erased stays erased).
