# Where things stand — handoff for the next session (human or model)

> **Superseded on 23 Nov 2026 (ADR 0010, 0011):** the repo runs the loop. Current state is the root `HANDOFF.md`, the
> blueprint and milestones are `PROJECT.md`. This page is kept as the record of the pstack sessions up to 21 Nov.

**The one plan is `docs/plan/MILESTONES.md` (ticket 91 is the redesign); everything else is detail under it.** Read this, the tail of `docs/plan/ledger.md`, then `docs/slices/v2-build.md` (section 5) (queue, recipe, ready-to-paste briefs). `git log
origin/main` and the PR list beat this text. As of 02:05 UTC, 21 Nov 2026. **Second orchestrator session running.** Staging deploys on every merge (`https://cosmos.3-108-95-203.sslip.io/api/v1/health` shows the commit).

## In flight (orchestrator session 2, 02:05 UTC, 21 Nov): check each against GitHub first

- LIVE on staging (19 of about 34 screens, all with their v1 page deleted): Cell change log; Machines register, Age, Footprint, Fix Finder, Problem Analysis; Energy, Shift-calendar KPIs, Bottleneck, Forecast Lab (#529); the Dashboard (#526); the Action Center (#532);
  BD% and PM split, Category and cell, MTTR and MTBF (#539); Manpower and Why-Why with its per-row Start/Save/PDF (#538); Breakdown Log and PM Calendar with the move write (#537).
  Also merged: shell with Desk link, Ctrl+K palette, rail links (#531), saved-copy fix (#525), engine prints no database ids (#533), Excel prints codes (#534), same-day determinism (#536), Breakdown Log row-ticket fix (#521). Every screen PR got an independent Opus review; every one needed a fix round.
- OEM is NOT built and not lost: v1 has no OEM screen or address and the engine does not compute `oem-analytics` (m4a-triage: DEFERRED, Bhavin's call). Its scope doc and gallery view stay.
- STOPPED FOR THE NIGHT on Nimish's instruction (20 Nov): the remaining about 15 screens are NOT started: Machine page (a first version was built on the superseded draft #527, branch `claude/v2-batch1-live`: look there first, then close #527), Data Checklist, Compare, Team Focus; batch 6 (Money Matters, Monthly, Annual, Guide, Settings); batch 7 (floor phone, desk, ticket, TV board, login). General Work is not built (Nimish).
  A full total order of the engine across days is NOT done: it changes last digits in the frozen answer key (52.70 to 52.69); needs Nimish's yes before the key moves.
- Nimish's answers (20 Nov, written in session): the disabled period box on Today is DROPPED; the Desk link is hidden from logins that cannot open the desk; General Work is not built now. Open product questions (none blocks): a heading per priority group in the Action Center; "raise an inspection ticket from a nudge" later?; sort order: the kit's first click is descending (v1 was ascending), accepted on every v2 table; the refused login keeps the page title and shows the alert, no heading-free page (same as the Action Center).
- Follow-ups: DOM test runner (needs an ADR: reviews found bugs unit tests without a DOM cannot see, for example a form keyed by position); keep the shell mounted loading to ready; blank Gujarati keys on the `v2*` strings (English shows); 'Show the numbers' is missing on Shift KPIs, Energy, Problem Analysis, Dashboard (v1 had it on charts; #539 added it to the page body only);
  Breakdown Log export has two identical columns (Ticket ID, Ticket No.) and the PM Reports Data column holds UUIDs; person switch may keep the previous screen until the next 30 s refresh; `apps/server/test/escalation.test.ts` ('a named person who is switched off falls through to the roster') depends on the wall clock: it fails when run in the 31 minutes before midnight IST (17:59 to 18:30 UTC), proven by a green re-run after midnight: make it clock-free (backend lane).
- Rulings (me, with their cost if wrong in `docs/plan/ledger.md`): `who-is-acting` /floor ERR_ABORTED and `sla-timers` deadlock never block a merge, one re-run; CI starts when a PR is marked ready; a push restarts it, so one push per fix round.
- Lessons (the builder contract of this session, `scratchpad/builder-preamble.md`, not yet copied into `docs/slices/v2-build.md` section 5, copy it there): answer-key fixture sets machine id = code, so re-key to UUIDs; a drill equals its card; the 30 s refresh stays; key pages and forms by screen and by ticket, never by position; a wide table must clip its screen-reader text (a phone page 686 px wide broke a drag); the real-server e2e needs Docker and runs first in CI; gitleaks flags a long literal beside `key`; check `parity.yaml` cites no deleted test.

## The one job: redesign every screen in the v2 language (Nimish, 20 Nov)

- **Rule that outranks speed: a redesign never reduces scope.** Same or more detail, insight and analytics, smarter with
  our data. Each screen PR carries a coverage table (`docs/design/v2/COVERAGE.md`, `UX-RULES.md` section 11). "Not built"
  needs Nimish's written yes. Nothing is deleted from v1 until its v2 screen has a clean table.
- Look and behaviour: `docs/design/v2/UX-RULES.md`, `LANGUAGE.md`. Screen recipe: `screens/v2/<name>/{model.ts, View.tsx,
fixture.ts, tests}`, `EntityShell` (never `Shell`), kit parts only, data through `useScreenModel`, a machine, cell,
  person or decision is always an `EntityChip` (`docs/slices/entity-links.md`). `pnpm ui:check` enforces it.

## What is merged (main = c633043), all gallery-only, v1 untouched and still live

- Kit, Dashboard, entity chip + drawer in the URL (#496, #497, #500). Action Center, Data Checklist (#502), Machine page
  (#501), Team Focus, Compare (#503), CI gallery limit 15 min (#504). View any at `/gallery?view=v2-<name>`.
- 6 of about 36 screens are done. Batches left: 2 Machines register, OEM, Age, Footprint, Cell change log · 3 Breakdown Log,
  General Work, PM Calendar, Fix Finder, Problem Analysis · 4 BD% and PM split, Category and Cell, MTTR and MTBF, Manpower,
  Why-Why · 5 Energy heat map, Bottleneck, Shift-calendar KPIs, Forecast Lab, Reliability scorecard · 6 Money Matters,
  Monthly, Annual, Guide, Settings · 7 Floor phone, desk, ticket, TV board, login.

## Coverage debt (the batch-1 gate is CLOSED until cleared)

- Audit: `docs/design/v2/scope/batch1.md`. Of 187 v1 items checked across the six merged v2 screens: 28 same, 62 changed,
  **97 MISSING** (Dashboard 26 of 38, Compare 20 of 33, Data Checklist 17 of 30, Machine page 16 of 34, Action Center 14 of 36,
  Team Focus 4 of 16). Worst: no figure opens the tickets behind it (parity rule), Compare lost the health score and tables,
  Machine page lost the reliability fit and nameplate, Dashboard lost the "needs you now" strip, Data Checklist runs 5 of v1's
  16 checks, rupees show to every role (parity says head, plant head, admin only). Some v2 fixtures show data we do not collect.
- Not yet verified by a second reader: whether renamed figures keep v1's formulas. Spot-checked only the Action Center filters.
- Clear the debt, then the gate report `docs/plan/gates/M-v2-1.md` (under 30 lines), then Nimish's go.

## Waiting on Nimish (plain words, product only)

- Compare: keep v1's health score and the two tables? (my advice: yes)
- A decision's "Open full page": Action Center with it open?
- Rail: list pages inside each section, or sections only? Verdict line at body size or one 20px line?
- Keep mid-green running tiles (3:1 contrast)? Footprint meaning (assumed "20% of machines cause most hours" + cell map)?
  Older: PM hours, manpower and spend figures, staging history (69d).

## Rulings (Nimish)

**A v2 screen goes live in its own PR and the old v1 page is deleted in that PR: no gallery-only screens, no Old view, no two copies.**
Never reduce scope (above). Light checks for web and docs PRs. Everything is redesigned. Floor phone: new
look, Bhavin's step order, button order and words unchanged. Desk, ticket, TV: flow may change. Rupee figures OK. Running grey,
Waiting amber, Transferred blue; Indian grouping; system dark and light; power and air failures count in downtime. Real data
already in the public repo is an accepted risk: add NO more (never commit screenshots of Bhavin's files).

## What cost time (details in `docs/slices/v2-build.md` (section 5))

About 20 minutes from brief to an open PR, 40 to 85 to merge. Waste: PR-body lines CI checks (`No parity:`, Q14 never `pending`),
the gallery job limit (now 15 min), PRs appending to the same registry lines, one Team Focus gallery test that hung in CI twice and
never locally (now instrumented). A builder run is about 300k tokens; most of a screen PR is invented fixture data and its tests.
