# Where things stand — handoff for the next session (human or model)

**The one plan is `docs/plan/MILESTONES.md` (ticket 91 is the redesign); everything else is detail under it.** Read this, the tail of `docs/plan/ledger.md`, then `docs/slices/v2-build.md` (section 5) (queue, recipe, ready-to-paste briefs). `git log
origin/main` and the PR list beat this text. As of 17:20 UTC, 20 Nov 2026. **Second orchestrator session running.** Staging deploys on every merge (`https://cosmos.3-108-95-203.sslip.io/api/v1/health` shows the commit).

## In flight (orchestrator session 2, 17:20 UTC, 20 Nov): check each against GitHub first

- LIVE on staging (11 of about 34 screens): Cell change log; Machines register, Age, Footprint, Fix Finder, Problem Analysis; Energy, Shift-calendar KPIs, Bottleneck, Forecast Lab (#529); the Dashboard (#526).
  Also merged today: the shell with Desk link, Ctrl+K palette and router rail links (#531), the live reader's saved-copy fix (#525), fixes to #523's screens (#528), the engine printing no database ids with a guard test (#533),
  the Excel exports printing codes (#534), the Breakdown Log row-ticket fix (#521). Every screen PR got an independent Opus review and each needed a fix round (ids on screen, a drill not equal to its card, a screen-switch crash, lost behaviour).
- Open: #532 Action Center (reviewed PASS; 4th CI round on one phone e2e: the Escape key does not close a machine drawer on a phone; the builder is fixing it and merging main).
  Builder running: `claude/engine-determinism` (same-day ties and float sums must not depend on UUID order; reviewer probes in the scratchpad).
- Nimish's answers (20 Nov, written in session): the disabled period box on Today is DROPPED; the Desk link is hidden from logins that cannot open the desk; General Work is not built now.
  Open product questions for him (none blocks): a heading per priority group in the Action Center (the builder restored v1's per-priority counts on the chips instead); "Open full page" of a nudge goes to the same page; add "raise an inspection ticket from a nudge" later?
- Next: batch 4 (BD% and PM split, Category and Cell, MTTR and MTBF, Manpower, Why-Why) and PM Calendar and Breakdown Log wiring live; Machine page, Data Checklist, Compare, Team Focus rebuilds; batches 6 and 7. "Reliability scorecard" is not a v1 screen (ticket 53 is the monthly scorecard).
- Follow-ups: a DOM test runner (needs an ADR); keep the shell mounted when a screen goes from loading to ready (a phone menu opened early closes); blank Gujarati keys on the v2 screens (English shows); the Breakdown Log export has two identical columns
  (Ticket ID and Ticket No.), the PM Reports Data column still holds UUIDs; a person switch may keep the previous person's screen until the next 30 s refresh; the `who-is-acting` e2e and the `sla-timers` deadlock are unrelated flakes.
- Rulings (Nimish): do not spend time on CI noise outside the diff; only act on what blocks a merge or changes a result. Cost rules: tests minimal, Sonnet builders, Opus reviewers. The repo setting "Allow auto-merge" is off.
- Lessons (in the builder contract used this session, `scratchpad/builder-preamble.md`, copy it into `docs/slices/v2-build.md` if it should outlive the session): the answer-key fixture sets machine id = code, so re-key to UUIDs in tests; a drill must equal its card;
  v1's 30 s refresh must stay; every v2 screen is the same component in the same place, so key pages by screen; a draft PR runs no CI and "ready" does not start it, a push does; the real-server e2e needs Docker and cannot run in the sandbox, so CI is the first run;
  gallery specs run locally with the preinstalled Chromium (throwaway Playwright config with `launchOptions.executablePath: '/opt/pw-browsers/chromium'`); gitleaks flags a long literal beside the word `key`.

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
