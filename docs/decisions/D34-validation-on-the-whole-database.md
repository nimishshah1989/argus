# D34 — Validation runs on the whole database

Date: 19 November 2026 · Status: accepted (Nimish) · Owner: backend orchestrator · Builds on: D21, D32 (Q13),
`docs/TESTING.md`. Ticket 79.

## Decision

1. **A figure is proven on every ticket the plant holds.** `pnpm validate:full` runs on staging against the whole
   database — 2022 to today, history and live — and compares every figure with its reference: the 2026 answer key,
   the legacy workbooks' own summary sheets, and the figures Nimish spot-checks on Bhavin's platform.
2. **A ticket that touches the engine, a figure, a report or an import is `done` only with a green run linked.**
   It also runs nightly; a red nightly run is a required status check on every pull request until the nightly run is green again (a workflow under `.github/workflows/`).
3. **The pull-request suite stays, and stays fast.** It runs on the 2026 log with names and phones swapped
   (1,343 real rows). That is real plant data, not invented data; what it lacked was the other four years.
4. **The data stays where it is safe.** The full database lives on staging. The command prints counts and machine
   codes, never a name, so its output can sit in a log.

## Why

Nimish, 19 Nov: stop validating on a sample. The audit found the reason it matters: the 2026 tests read a fixture,
not the database, so they stay green while a multi-year plant gets wrong numbers — 9 places in the engine assume
one year (re-read and listed in the ledger on 19 Nov; 3 more are one year by design).

## Rejected

- **Commit the full history as a fixture.** The history files are a client's operating record: slice 69
  counts about 7,800 dated rows for 2022–2025 (4,745 in 2022, 2024 and 2025, and 3,078 in 2023), against the
  1,354-row Breakdown Log already in `docs/discovery/real-2026-11-13/`. Q13 forbids it either way. The public
  development repository is an accepted risk for what is already there (Nimish, 19 Nov; N20), not a reason to add
  to it.
- **Run the full database on every pull request.** A full run takes tens of seconds per engine pass and needs the
  private database; the nightly run and the per-ticket run catch the same faults a day sooner than a release would.

## Cost if wrong

One command and one nightly job. If the references are incomplete, a wrong figure can still pass; the reference
list is printed with each run so the gap is visible.
