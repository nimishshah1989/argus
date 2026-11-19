# Where things stand — handoff for the next orchestrator session

Read this first, then the 19 Nov tail of `docs/plan/ledger.md`, then "Road to v1" at the top of
`docs/plan/MILESTONES.md`: nine numbers that define v1, the stages, and a number on every ticket's goal.

## START HERE (V0, then two lanes)

**State:** `main` = `69aed57` (main moves; `git log` is the truth). M0, M2 and M4a are gated. M4b is mostly merged:
46, 47, 48, 49, 51, 52 and 67 are done; **53 and 54 are open** (50c, the PM calendar screen, merged in #407; its 50d polish is open). M1's open tail is 24,
26, 27, 28 and 68. M6 has plumbing merged ahead (55 mostly, 71, 72 in shadow), nothing a user can see. Tracker reconciled
against the code on 19 Nov (suites not rerun). `pnpm parity`: 120 rows, 0 problems on 19 Nov 2026.

**CI runs again.** The repository is public for the development phase (Nimish, 19 Nov) and Actions is green. R10
(merge on local evidence) is withdrawn (ticket 74): 0 merges without a green CI run on the pull request. It goes
private again before cutover only once Actions billing is fixed. Real data already in the public repo is accepted for development and gates
nothing; N20: before cutover Nimish decides whether to purge `docs/discovery/real-2026-11-13/` and its history, or
rely on going private.

**Frontier:**

- **V0:** 73 (goal 1 left to merge: this PR; goal 2, the tracker check, is merged, #409), then 74.
- **Backend lane (E → H → I):** at most two of 75–78 at once, 69's converter taking the second slot; 76 then 75
  (both rewrite the engine); 77a, 78a are the API parts (re-plan `docs/slices/69-legacy-history.md` first: its 19 Nov
  amendment supersedes R1, R6 and R14); 79 after 75 and 76; the load after 79; then 90–96.
- **Frontend lane (F):** 80 (foundations and three directions for Nimish to pick from), 81, then 82 and 84, 83,
  85, then 77b and 78b (the screens), and the waves 86 → 87 with 88 and 89 beside them. 87 restyles 50c and adds its keyboard move.
- **Then:** 53 and 54 (the M4b gate waits for 85 but not for 86–89), M6 in shadow, and P (97, 98, 27, then 28).

**Rules added 19 Nov (MILESTONES "Rules added on 19 Nov", D33, D34):** every goal has a number; an engine,
figure, report or import ticket is `done` only after `validate:full` is green on the whole staging database; the
floor and desk keep Bhavin's flow, order, button positions and words while analytics is redesigned freely; design
work uses `impeccable` and Emil Kowalski's skills; the tracker changes in the pull request that changes the code.

**How this repo is worked (unchanged):** plan first and a fresh plan review; one packet = one acceptance
assertion, ≤ 3 files / ≤ 150 lines, a named red and green command; a fresh reviewer runs the **covering suite**;
`pnpm precheck` before push; one PR per packet (template in `.github/`), merged one at a time, then
`pnpm main:check`; never weaken a test; whole-figure `toEqual`; one `changes/<digits>-<slug>.md` per ticket.

**Known traps:** `check-size` counts the trailing newline (keep files ≤ 399 wc-lines); `migration-runner`,
`escalation`, `state-scale` and `who-is-acting` are timing flakes — rerun, and treat a repeat as a finding; a
checkout path with a space breaks `tools/backup-dump` and `tools/staging-deploy`; prettier runs over `docs/` too.

**Waiting on people (`docs/plan/NEEDS.md`):** N16 Bhavin's machine answers (Star sheets, retired machines, which
machines are out of production data); N17 February–March 2022, any 2020–21 files, and the 2023 and 2024 workbooks
placed with the others outside git; N18 the ranking method (54); N19 AI thresholds; N5 Gujarati sign-off; N10 the
security reviewer; N15 usability sessions; N7 the production account; N20 (not blocking).

**Debt:** `docs/plan/DEBT.md` (three rows, ticket 41); the M4a gate's report calls; CSV not XLSX for the cell-log export (ADR needed); ARCHITECTURE and INFRASTRUCTURE describe stored figures and a production stack
that tickets 75 and 97 will build.
