# Where things stand — handoff for the next orchestrator session

Read this first, then the 19 Nov tail of `docs/plan/ledger.md`, then "Road to v1" at the top of
`docs/plan/MILESTONES.md`. That section is the goal document: nine numbers that define v1, the stages, and a
number on every ticket's goal.

## START HERE (V0, then two lanes)

**State:** `main` = `1d51ad2`. M0, M2 and M4a are gated. M4b is mostly merged: 46, 47, 48, 49, 51, 52 and 67 are
done; **50c (the PM calendar screen), 53 and 54 are open**. M1's open tail is 24, 26, 27, 28 and 68. M6 has its
plumbing merged ahead (55 mostly, 71, 72 server-side in shadow) and no feature a user can see. The tracker was
reconciled against the code on 19 Nov; the server and browser suites were not rerun in that session.

**CI runs again.** The repository is public for the development phase (Nimish, 19 Nov), Actions is green and the
deploy run for `1d51ad2` succeeded. Ruling R10 (merge on local evidence) ends with ticket 74: no merge without a
green run.

**Frontier:**

- **V0:** 73 (this plan; its second goal, the tracker check, is still to build), then 74.
- **Backend lane (E → H → I):** 75, 76, 77 and 78 together after 74; 79 after 75 and 76; 69's converter beside
  them (re-plan `docs/slices/69-legacy-history.md` first — its 19 Nov amendment supersedes R1, R6 and R14);
  the load after 79; then 90–96.
- **Frontend lane (F):** 80 (foundations and three directions for Nimish to pick from), 81, then 82 and 84, 83,
  85, and the waves 86 → 87 with 88 and 89 beside them. 50c is built inside 87.
- **Then:** 53 and 54 (M4b gate), M6 in shadow, and P (97, 98, then 27 and 28).

**Rules added 19 Nov (MILESTONES "Rules added on 19 Nov", D33, D34):** every goal has a number; an engine,
figure, report or import ticket is `done` only after `validate:full` is green on the whole staging database; the
floor and desk keep Bhavin's flow, order, button positions and words while analytics is redesigned freely; design
work uses `impeccable` and Emil Kowalski's skills; the tracker changes in the pull request that changes the code.

**How this repo is worked (unchanged):** plan first and a fresh plan review; one packet = one acceptance
assertion, ≤ 3 files / ≤ 150 lines, a named red and green command; a fresh reviewer runs the **covering suite**;
`pnpm precheck` before push; one PR per packet, merged one at a time, then `pnpm main:check`; never weaken a
test; whole-figure `toEqual`. PR bodies follow `.github/pull_request_template.md`. Fragments:
`changes/<digits>-<slug>.md`, one per ticket.

**Known traps:** `check-size` counts the trailing newline (keep files ≤ 399 wc-lines); `migration-runner`,
`escalation`, `state-scale` and `who-is-acting` are timing flakes on exactly the escalation and migration paths —
rerun, and treat a repeat as a finding; a checkout path with a space breaks `tools/backup-dump` and
`tools/staging-deploy`; prettier runs over `docs/` too.

**Waiting on people (`docs/plan/NEEDS.md`):** N16 Bhavin's machine answers (Star sheets, retired machines, which
machines are out of production data); N17 February–March 2022, any 2020–21 files, and the 2023 and 2024 workbooks
placed with the others outside git; N18 the ranking method (54); N19 AI thresholds; N5 Gujarati sign-off; N10 the
security reviewer; N15 usability sessions; N7 the production account.

**Debt and open calls:** `docs/plan/DEBT.md` (three rows, ticket 41); the M4a gate's report calls; CSV not XLSX
for the cell-log export (ADR needed); ARCHITECTURE and INFRASTRUCTURE describe stored figures and a production
stack that do not exist yet — tickets 75 and 97 make them true.
