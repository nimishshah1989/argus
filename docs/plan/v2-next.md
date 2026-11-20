# v2 redesign: what is queued, how to build a screen, and ready-to-paste briefs

Written 20 Nov 2026 when Nimish paused the cloud session to continue locally on cheaper models. Read `docs/HANDOFF.md` first.

## 1. Queue (in this order)

1. **Clear batch-1 coverage debt** (`docs/design/v2/coverage/batch1.md`): put back every MISSING item and add the cheap
   intelligence wins the audit lists. Start with Compare (health score, longest breakdowns, by shift, cells and periods).
2. **Plumbing** (brief A below): screens and gallery views register themselves, gallery CI in two shards, a PR-body
   generator. Do this BEFORE more screens, or every parallel PR conflicts again.
3. **Coverage gate** (brief B): `pnpm quality:pr` fails a screen PR without a clean coverage table.
4. **Prototype** (brief C): can a v2 screen be fed from the API the v1 screens already use instead of invented fixtures?
   Measure before deciding; it could remove most of the code in a screen PR, and it makes "nothing dropped" checkable.
5. Batches 2 to 7 (list in HANDOFF), five screens per PR, up to three PRs in parallel.

## 2. How to build one screen (a checklist a cheaper model can follow)

1. **Inventory first, design second.** Read the v1 screen, its e2e spec (`apps/web/e2e/`), its `docs/spec/SPEC.md` section and
   the engine figures it uses. Write the coverage table (`docs/design/v2/COVERAGE.md`) before any code.
2. Copy the nearest merged screen (`screens/v2/action-center` for a decision list, `data-checklist` for grouped checks,
   `team-focus` for people, `compare` for side by side, `machine` for a full page, `dashboard` for an overview).
3. Files: `model.ts` (everything printed arrives ready to print), `fixture*.ts` (computes every figure from invented rows;
   a test checks totals add up), `View.tsx` (`EntityShell`, kit parts only), `<name>.test.ts`, a gallery view
   `gallery/v2-<name>-view.tsx`, one e2e `apps/web/e2e/gallery/v2-<name>.spec.ts` (loads, one drawer opens, Back closes it,
   axe light and dark). Add the key to `Screens` and `PROVIDERS` in `screens/v2/data.ts` and the view in `Gallery.tsx`.
4. Every machine, cell, person, decision: an `EntityChip` (in text `{{kind:id|label}}`). No colours, sizes, weights or motion
   in screen files (`pnpm ui:check`).
5. Light checks before a push (web and docs only): `pnpm format:check`, `lint`, `typecheck`, `ui:check`, `pii:scan`,
   `changelog:check`, the tests you touched. **Run Prettier on every file you edit with a script** (the format-on-edit hook skips
   them). Anything outside `apps/web`, `docs`, `changes` gets the full `pnpm precheck`.
6. PR body must carry (CI `pr-meta` fails otherwise): the template headings; `Q1` to `Q15` each `pass`, `n/a — reason` or
   `fail — finding` (**never `pending`**); `Large PR: <reason>` over 800 lines; `Tests removed: none`; for gallery-only PRs
   `No parity: <10+ characters>`; a `changes/<n>-<slug>.md` fragment. CI skips draft PRs: mark ready to run it. Check the
   body is YOURS (one run overwrote a PR body with another PR's text).
7. Merge squash pinned to the head sha, only after reading the check runs of the CURRENT head (a suite event can be for an old
   head). If the gallery job is cancelled at its limit or fails, read the log; one re-run at most.
8. Screenshots (light, dark, phone) go to a scratch folder, never the repo; invented data only.

## 3. Which model for what (my advice; I am not certain, test it on one batch)

- **Cheaper model is probably fine for:** copying a screen from the nearest merged one, fixtures and their totals tests, e2e smokes,
  Prettier and lint fixes, PR bodies from the generator, rebasing on registry conflicts.
- **Keep a strong model for:** the coverage inventory and the "more intelligent" proposals (judgment about what the plant needs),
  the URL and history logic in `screens/v2/entity/`, CI and workflow changes, anything that touches the engine or the schema, the
  final read of a coverage table against the v1 code (a builder's "nothing is missing" is a claim, not evidence).

## 4. Ready-to-paste briefs for the work that was stopped before it started

**A. Plumbing.** Make a new v2 screen a folder with no shared-file edit: `Screens` becomes an interface that each screen extends by
declaration merging from `screens/v2/<name>/register.ts`; `PROVIDERS` built from `import.meta.glob('./*/register.ts')`; gallery
views discovered from `gallery/v2-<name>-view.tsx` (`?view=v2-<name>`, same URLs as today); the v2 style sheet list in
`style.css` and `ui/v2/language.test.ts` derived from a folder or glob. Split the CI `gallery` job into a 2-shard matrix
(`--shard=N/2`, artifacts per shard, timeout 15, baselines unchanged). Add `pnpm pr:body` (tools/pr-body.ts, tested) that prints a body
that passes `pnpm quality:pr` as is. Touches `.github/` and tools: run the full `pnpm precheck`. Test that a screen folder with only
its own files is discovered.

**B. Coverage gate.** Add attribute Q16 "Scope kept" to `docs/QUALITY-ATTRIBUTES.md`, the PR template and every hard-coded 15
(`tools/check-quality.ts` IDS, tests, docs counts). In `pnpm quality:pr`: when the diff changes `apps/web/src/screens/v2/**` (non-test
`.tsx`), the body needs a `## Coverage` table with at least one data row, every row whose v2 column says MISSING or DROPPED must end
with `Nimish said yes: <date>`, and the diff must include `docs/design/v2/coverage/<screen>.md` for each changed screen folder, with the
same rule. Unit tests with a failing and a passing example per rule. The check proves the table exists and is clean, not that it is
true: a human still compares it with the v1 code.

**C. API prototype (throwaway, measure, no PR).** Take the merged Action Center. In a local worktree write `adapter.ts` that builds its
`ActionCenterModel` from what the live v1 Action Center fetches (`apps/web/src/screens/analytics/ActionCenterPage.tsx`,
`action-center*.ts[x]` and the server routes behind them). Report per model field: carried by the API / derivable / missing (what the
server would need); lines of adapter vs the fixture lines it replaces; time taken; what real data does to the screen (staging has
UUIDs where names belong, unformatted floats, A1 all 0.00%); and a recommendation (adapters from now on, fixtures, or a mix).

## 5. Known open issue

`apps/web/e2e/gallery/v2-team-focus.spec.ts` "a person chip opens the drawer, Back closes it" hung for 60 s on CI in 2 of 3 runs and
never in about 170 local runs; it passed on the last run. The spec now has named steps, 10 s limits and a retained trace. If it fails
again, read the step name and the trace in the `gallery-diffs` artifact; the builder's suspicion is `page.goBack()` (unproven).
