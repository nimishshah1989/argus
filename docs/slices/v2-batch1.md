# v2 batch 1: Action Center, Data Checklist, Team Focus, Compare, Machine page

Nimish, 20 Nov: every screen is redesigned in the v2 language. Source of truth: `docs/design/v2/UX-RULES.md`
(behaviour) and `LANGUAGE.md` (look and recipe). The merged Dashboard (`screens/v2/dashboard/`) and the entity-links
kit (#500, `docs/slices/entity-links.md`) are the pattern: copy their structure, not their content.

## Three PRs, three branches, in parallel (each in its own worktree)

| PR  | Branch                  | Screens                       |
| --- | ----------------------- | ----------------------------- |
| A   | `claude/batch1-today`   | Action Center, Data Checklist |
| B   | `claude/batch1-people`  | Team Focus, Compare           |
| C   | `claude/batch1-machine` | Machine page                  |

Create yours with `git worktree add ../argus-<name> -b <branch> origin/main`, then `pnpm install --frozen-lockfile`.
Push only your own branch. Never touch another PR's directory. Merges go one at a time after CI; whoever merges later
merges `origin/main` into their branch (the only shared lines are described below) and re-checks.

## Scope rule (precedent: the Dashboard)

v2 screens are **gallery-only until the backend adapter is wired**: `/gallery?view=v2-<name>`, fixtures through
`useScreenModel`. Do **not** change `App.tsx`, any route, or any v1 screen, and do not delete or edit a v1 test or spec;
v1 is removed in one step when the adapters land. A screen may not import from `screens/analytics` (v1), `components/`
or `faces/` (take what the screen needs from the v2 kit; copy a pure helper if one is needed and say so in the PR).

## What each screen is

For each screen read its v1 page (what it shows and the numbers it needs), its mockup in `docs/design/v2/mockups/`
(**illustrative only**: layout and mood, never copy its figures), `docs/spec/SPEC.md` for the screen, and the Dashboard
View. Then build it decision-first (UX-RULES 5 to 8): a verdict sentence and 2 to 4 KPI cards, exceptions first, every
card that shows a problem ends in its next action, detail behind a click or in the drawer.

- **Action Center**: what to decide today (open decisions, who owns each, what each is worth). Reuses `DecisionList`.
- **Data Checklist**: what data is missing or stale before the numbers can be trusted, by owner, with the fix.
- **Team Focus**: the people and what each is on; who is overloaded; the focus list. Person chips open the person drawer.
- **Compare**: two machines, cells or periods side by side, differences first, aligned boxes (LANGUAGE.md).
- **Machine page** (a full page because it is its own workflow): state and why, hours, breakdown history (10-row table with
  search, sort, chips), spares, PM, 12-week trend, what to do next. The machine drawer's "Open full page" lands here.

## Files per screen (the plug-and-play recipe)

`screens/v2/<name>/{model.ts, View.tsx, fixture.ts, <name>.test.ts}` (split a file before 400 lines, a function before 60).
Add the key to `Screens` and `PROVIDERS` in `screens/v2/data.ts` (one line each, appended: that is the only shared
file you edit besides the gallery registry, where you add one `v2-<name>` view the way `v2-dashboard` is registered).

- Everything printed arrives in the model, ready to print: the engine's figures, the reader's words. Fixtures **compute**
  every figure from the invented rows they hold, and a test checks the totals add up (a cell's hours = its machines').
- Invented names and codes only; reuse the Dashboard fixture's plant (`dashboardFixture` machines and cells, the people
  in `screens/v2/entity/fixture.ts`) so chips resolve in the drawer; no real names, no real plant data, no screenshots in the repo.
- Views use `EntityShell` (never `Shell`) and kit parts from `ui/v2` and `ui/v2/domain` only. Codes and names of a
  machine, cell, person or decision are `EntityChip`s; in sentences, segments `{{kind:id|label}}`. `pnpm ui:check` enforces
  colours, sizes, weights, motion, chips.
- Every screen has designed loading, empty, error and "no results for this filter" states (`ScreenStates`), tables of 10
  rows with search, sort and filter chips (`DataTable`), Indian number format, DD-MMM-YYYY dates, a source and as-of line.
- All visible words through `t()` with keys in the existing way (Gujarati left blank like `ashell.*`).
- If the kit lacks a part, compose from what exists. Add to `ui/v2` only a new, additive file, in its own commit, and list it
  under "Elements I found missing" in the PR. Never edit a kit file another PR could also touch.

## Done means (per PR)

- One smoke e2e per screen in `apps/web/e2e/gallery/` (loads, headline visible, one drawer open, Back closes it, axe clean in
  light and dark) plus the unit tests above. Behaviour a user sees, never table or column names.
- **Light checks before the push** (CLAUDE.md, web and docs only): `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
  `pnpm ui:check`, `pnpm pii:scan`, `pnpm changelog:check`, and the tests you touched, with the Playwright chromium
  (trace off). Run Prettier on every file you edit by script. Do not run the full precheck.
- Screenshots (light, dark, phone) of each screen at deviceScaleFactor 1 into the scratchpad `shots/` folder, not the
  repo; the orchestrator looks at them before merge.
- PR: draft, template headings, one `changes/` fragment per screen's PR (follow `changes/` naming already used), body with
  what changed for a user, tests, how to try (`/gallery?view=v2-<name>`), `Large PR:` and `Tests removed: none` lines,
  "Elements I found missing", and anything you could not verify. Reach the PR in about an hour; past two, cut scope and say what.
- No new dependency, no secrets, no real data. Never weaken or delete a test.
