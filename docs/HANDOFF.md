# Where things stand

Read first. Rewrite when the state changes. Under 50 lines.

## RESUME HERE (third regime, 16 Nov 2026)

**State:** `main` = `925d4a9` (PR #269). M0 gate passed 14 Nov; M1 is current (3 done / 6 in progress / 6 todo);
M2 server work is ahead of the tracker. Staging is live with Cosmos's real data. **8 PRs are open and unmerged —
clearing that queue is the first job.**

**Routing and budget:** see `docs/decisions/D31-third-regime-routing-and-quality.md`. Development and testing run
on the hosted coder; goal drafting, planning, final review and compliance run on the reasoning model. Two hard
budgets: $5 hosted-coder credit and $10 reasoning credit. Probe the coder route before the first packet (a model
list is not a route). No silent model switch.

**Quality rails:** the writer never reviews its own work; a fresh reviewer gets the plan, diff and test output
only and returns PASS/FAIL with numbered `file:line` findings; every packet names a red test and a green command;
`pnpm precheck` before every push; one CI run per ready PR; one merge queue; rebase and rerun stale greens.

## PR queue (one at a time, rebase + rerun on current main)

1. #265 engine shell — green on current main
2. #261 sign-off web — rebase; server #262 already merged
3. #258 settings screens — rebase
4. #264 lockout web — rebase
5. #268 M4a migration — draft → ready → CI (before any analytics writer)
6. #267 M4a triage / answer key — needs Nimish's sign-off on the triage
7. #263 Gujarati — last of the screen set; regenerate baselines
8. #260 account/Alerts — conflicts; e2e never run

## Direction (Nimish)

- **Frontend-first:** finish the M1 screens, then the M2 screens. Backend only the fine-tuning those screens need.
- **M4 is the advanced turn:** analytics, forecasting, manufacturing integrations. AI layer after that. M3/M5 parked.
- Product questions only for Nimish; settle technical forks by running something.

## Blocked / external

- Bhavin: triage sign-off for #267; real inputs for cutover. Backup workflow failed 16 Nov — fix before the next deploy.
