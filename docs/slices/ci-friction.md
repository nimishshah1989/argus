# CI friction follow-up

No GitHub issue (follow-up to #76) · branch `claude/ci-friction` · one PR · fragment `changes/165-ci-friction.md`
(165 is the next free number after `164-pstack-process.md`) · this PR's own body carries a `No parity:` line (it changes
`apps/server/test/`, and `apps/`).

Revision 2. Rulings from the orchestrator: no auto-label; the size/parity check moves to its OWN workflow and
`ci.yml`'s triggers and matrix stay as they are (a later run with jobs `skipped` could replace a red check and
turn a failing PR green); T17 dropped; two more test files may be guarded (setup and teardown only).

## 1. Goal

A PR author unblocks the size and parity gates by writing the reason in the PR description instead of hunting for a
label; runs the fast static checks locally with one `pnpm precheck`; and no longer sees a passing test run end in
"Unhandled Errors" from a stopped Postgres container.

## 2. Decisions

- **No auto-labelling.** A `GITHUB_TOKEN` label event does not re-trigger workflows, so a labeller would race the
  check it serves and would need `pull-requests: write`. The body line is a second accepted proof. The label alone
  still passes as today; no label and no valid line still fails. The guard is not weakened.
- **Own workflow.** `.github/workflows/pr-meta.yml`, job `pr-meta`, runs `pnpm parity:update` and `pnpm pr:size`.
  Triggers `pull_request: [opened, edited, labeled, unlabeled, synchronize, reopened]`. `permissions: contents: read`
  only (it labels nothing). No `pull_request_target`. `concurrency: pr-meta-${{ github.ref }}`, cancel in progress.
  Same pinned actions as `ci.yml` (`actions/checkout@v4` with `fetch-depth: 0`, `pnpm/action-setup@v4` 10.30.3,
  `actions/setup-node@v4` 24 with cache pnpm); no new third-party action. `timeout-minutes: 5`.
  `ci.yml` loses only its two steps `pnpm parity:update` and `pnpm pr:size` (they now live in `pr-meta`); its
  triggers, jobs, matrix and every other step are unchanged. An edit to the body re-runs only `pr-meta`.
- The PR body is untrusted: it reaches the script only through a step `env:` value, never a `run:` script.
- Reason text inside an HTML comment is ignored, so a template placeholder never counts as a reason.
- **Root cause (P3), from CI log evidence.** Run 43421128861, `api (3/3)`: "This error originated in
  apps/server/test/tags.test.ts", client user `app_api`, `_poolUseCount: 76`: a shared-harness pool left an idle client
  that Postgres shut down at container stop. `api (1/3)` in the same run also failed with all 226 tests passing; its
  file was not extracted. `tags.test.ts` was deleted by ticket 06, so that emitter is gone from main. Measured here:
  a `pg.Pool` with an idle client and no `'error'` listener gives vitest "Unhandled Errors", code 57P01, exit 1.
  The guard prevents any recurrence from a pool in the files it covers. pg-boss is not the surface: it forwards its
  pool errors to an emitter on which `startJobs` attaches a listener.
- **Precheck scope.** It runs the fast checks that need neither a build nor Docker nor the PR description. Excluded,
  with the reason: `format:check` (the prettier `--write` step makes it pass), `build` and `ui:check` (slow),
  `pr:size` and `parity:update` (need the PR description; they run in `pr-meta`), tests (slow; run on their own).

## 3. Files

- `tools/pr-reason.ts` new: `ReasonKey`, `prReason`. `tools/pr-reason.test.ts` new: T1–T9.
- `tools/check-pr-size.ts`: add `largePrAllowed`, use it at the HARD gate, new message, `import.meta.url` main-guard
  (as `check-parity-update.ts:50`). `tools/check-parity-update.ts`: add `paritySkipAllowed`, use it in `main()`, name
  both fixes in the skip log and in the one `parityUpdateErrors` message (it still contains `docs/spec/parity.yaml`).
- `.github/workflows/pr-meta.yml` new; `.github/workflows/ci.yml`: remove the two steps and nothing else.
- `tools/precheck.ts` new (under 60 lines, stdlib only; ends with `if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();` as `check-parity-update.ts:50`, so the test can import `changedFiles` without running the checks); `tools/precheck.test.ts` new: T10–T12; `package.json`:
  `"precheck": "tsx tools/precheck.ts"`.
- `apps/server/test/harness.ts`: add `tolerateShutdown`; attach it to `admin` and `app` in `startTestDb`; `stop()` calls
  both begins first, then ends the pools, then stops the container. `apps/server/test/harness-shutdown.test.ts` new:
  T13–T16.
- `apps/server/test/ticket-pdf.test.ts` (pool `pool`): setup and teardown only, zero assertion changes. It imports
  `tolerateShutdown` from `./harness.js`, attaches it where the pool is created and calls the returned begin first in
  `afterAll`. `sla-jobs.test.ts` is NOT guarded (decided at build): ESLint forbids a file under `apps/server/src`
  importing `apps/server/test/harness.ts` (`LEAVES`), inlining a copy would duplicate the guard, and its teardown
  already ends both pools before `container.stop()`.
- `docs/LEAN.md`: row at line 33 ends `a size:large label, or a "Large PR: <reason>" line in the PR description`;
  row at line 62 ends `(or the no-parity label, or a "No parity: <reason>" line in the PR description)`.
- `CLAUDE.md` section "Git": append one sentence: `Run pnpm precheck before every push.`
- `.github/pull_request_template.md`: exact text in §4. `changes/165-ci-friction.md`: three one-line user-facing bullets.

## 4. Interfaces

- `prReason(body: string | undefined, key: 'Large PR' | 'No parity'): string | null`: strips comments with `/<!--[\s\S]*?-->/g` (multiline, non-greedy), then scans
  lines for `^\s*(?:[-*]\s+)?<key>\s*:\s*(.+)$` (key case-insensitive, its space literal); returns the first reason,
  trimmed, with at least 10 non-space characters, else `null`.
- `largePrAllowed(env: NodeJS.ProcessEnv): boolean` = `Boolean(env.LEAN_ALLOW_LARGE) || prReason(env.PR_BODY, 'Large PR') !== null`.
  `paritySkipAllowed(env)` is the same with `PARITY_ALLOW_SKIP` and `'No parity'`.
- Messages: `pr-size: FAIL over 800 lines; split the PR, add the size:large label, or put a line "Large PR: <reason>" (at least 10 characters) in the PR description`;
  `parity:update: N product file(s) changed but docs/spec/parity.yaml did not; update the ledger, add the no-parity label, or put a line "No parity: <reason>" (at least 10 characters) in the PR description`.
- `pr-meta.yml` step env: `PR_BODY: ${{ github.event.pull_request.body }}`; `PARITY_ALLOW_SKIP` and `LEAN_ALLOW_LARGE` exactly as `ci.yml` has them today (label `no-parity` / `size:large`).
- `tolerateShutdown(pool: Pool): () => void`: attaches one `'error'` listener that returns when the returned `begin` was
  already called and `(error as { code?: string }).code === '57P01'`; otherwise it re-throws.
- `changedFiles(outputs: string[], exists: (path: string) => boolean): string[]`: splits each listing on `\n`, trims,
  drops blanks, dedupes in first-seen order, keeps existing paths.
- `precheck.ts main()`: lists files with `execFileSync('git', args, { encoding: 'utf8' })`, a non-zero exit counting as
  an empty list, for `diff --name-only --diff-filter=ACMR origin/main...HEAD`, `diff --name-only --diff-filter=ACMR HEAD`
  and `ls-files --others --exclude-standard`. If the first fails it prints exactly
  `precheck: no origin/main to compare with; formatting uncommitted and untracked files only`. Then `prettier` as the
  step named `prettier`: `execFileSync('pnpm', ['exec','prettier','--write','--ignore-unknown','--no-error-on-unmatched-pattern', ...files], { stdio: 'inherit' })`, skipped when the list is empty. Then `execFileSync('pnpm', ['run', step], { stdio: 'inherit' })` for, in
  order: `lint`, `typecheck`, `changelog:check`, `docs:check`, `boundaries`, `pii:scan`, `migrations:check`,
  `migrations:immutable`, `parity`, `licences`, `size`, `deps`, `shortcuts`. Any throw (including prettier) prints
  `precheck: FAILED at <step> — fix it, rerun pnpm precheck` and `process.exit(1)`. Success prints
  `precheck: OK — <n> file(s) checked by prettier, <k> checks passed` (`n` = files passed to prettier, `k` = steps run).
- PR template, exact. Verification list: the parity bullet becomes
  `- [ ] docs/spec/parity.yaml updated for every apps/ or packages/ change (or the no-parity label, or a "No parity: <reason>" line below)`;
  the size bullet becomes `- [ ] PR under 800 changed lines (or the size:large label, or a "Large PR: <reason>" line below)`
  (backticks around code as today); one new first bullet `- [ ] pnpm precheck green before the push` (in backticks).
  The "Label reasons" section becomes `## Reasons` holding only
  `<!-- Over 800 lines, or apps/ or packages/ without the parity ledger? Add a line below, for example: Large PR: ports the whole gallery suite  /  No parity: test-only change to the harness  (at least 10 characters; the examples stay inside this comment so they never count). -->`

## 5. Data

No table, column or migration is read or written, so no schema change. Values: `PR_BODY`, `LEAN_ALLOW_LARGE`,
`PARITY_ALLOW_SKIP` (`string | undefined`, step env); the reason text (`string | null`, lives only in the PR
description); three git listings (`string`); the pg error `code` (`'57P01'`, in-process).

## 6. Test cases

`tools/pr-reason.test.ts`:

- **T1** Given `"intro\nLarge PR: ports the whole gallery suite\n"`, When `prReason(body,'Large PR')`, Then `'ports the whole gallery suite'`.
- **T2** Given `"- large pr: ports the whole gallery suite"`, When called, Then the trimmed reason.
- **T3** Given `"Large PR: too  big"` (6 non-space characters), When called, Then `null`.
- **T4** Given the exact new template text (the comment holds `Large PR: ports the whole gallery suite` and `No parity: test-only change to the harness`), When called for each key, Then `null`.
- **T5** Given `"this is a Large PR: because I said so and more"`, When called, Then `null`.
- **T6** Given `undefined` and `''`, When called, Then `null` twice.
- **T7** Given a body with only a `No parity:` line, When called for `'Large PR'` then `'No parity'`, Then `null` then the reason.
- **T8** Given `{LEAN_ALLOW_LARGE:'1'}`, `{PR_BODY:'Large PR: ports the whole gallery suite'}`, `{}`, `{PR_BODY:'Large PR: short'}`, When `largePrAllowed`, Then `true,true,false,false`.
- **T9** The same four shapes for `paritySkipAllowed` with `PARITY_ALLOW_SKIP` and `No parity:`.

`tools/precheck.test.ts` (`changedFiles` is the tested seam; `main()` is a thin loop over `execFileSync`, proved by the
manual runs in §7):

- **T10** Given `['a.ts\nb.ts\n','b.ts\n','']`, `exists = () => true`, Then `['a.ts','b.ts']`.
- **T11** Given `['gone.ts\nkept.ts\n']`, `exists = p => p === 'kept.ts'`, Then `['kept.ts']`.
- **T12** Given `['','\n','  ']`, Then `[]`.

`apps/server/test/harness-shutdown.test.ts` (T17 was dropped; it passed on main):

- **T13** Given `new Pool()` guarded by `tolerateShutdown`, When `pool.emit('error', e)` with `e = Object.assign(new Error('terminating connection due to administrator command'), {code:'57P01'})` before `begin`, Then it throws; then `await pool.end()`.
- **T14** Same pool after `begin()`, same emit, Then it does not throw.
- **T15** After `begin()`, emit an error with `code: '08006'`, Then it throws.
- **T16** (timeout 60_000) Given `const container = await new PostgreSqlContainer('postgres:16-alpine').start()` and two `max: 1` pools on `container.getConnectionUri()`, each having run `select 1`; `observed` has a plain `'error'` listener: `const seen = new Promise<Error>(r => observed.once('error', r))`; `guarded` has `tolerateShutdown` and `begin()` called. When `await container.stop()`, then `await vi.waitFor(() => expect(guarded.totalCount).toBe(0))` (pg drops the errored client before it emits, so this proves guarded's error was handled before `end()`), Then `((await seen) as {code?:string}).code === '57P01'`, `guarded.listenerCount('error') === 1`, and `await expect(guarded.end()).resolves.toBeUndefined()`, same for `observed`. The absence of "Unhandled Errors" is the red step, run once by hand: with `tolerateShutdown` removed from `guarded`, the vitest run ends with `Errors 1` and exit 1.

## 7. Regression risk

- `tools/parity-update.test.ts` assertions are untouched; the message still has the ledger path and still yields one error.
- `check-pr-size.ts` gains an `import.meta.url` guard; `pnpm pr:size` runs it directly so it still executes.
- `pr-meta.yml` adds one short job per PR event (install, two tools); `ci.yml`'s matrix does not change. Moving the two
  steps out means the `static` check no longer fails on size or parity; `pr-meta` does.
- `tolerateShutdown` re-throws anything but 57P01-after-begin (T13, T15).
- T16 starts one extra container inside the `api` shards (about one more among about 25 test files that already start
  one); `maxWorkers: 4` is unchanged.
- Manual proofs in the PR: `pnpm precheck` green; `pnpm precheck` with a lint error planted in a scratch change, to
  see `FAILED at lint`; the red run of T16.
- Required checks: `pr-meta` is a new check name. A repo admin must add it to the required status checks, and the merge rule "all 8 checks green" becomes 9. I cannot do that and do not edit `docs/plan/ledger.md`; the PR body says it.
- `packages/db` tests already end pools before the container stops and get no change.

## 8. Not touched

`docs/plan/ledger.md`, `docs/plan/MILESTONES.md`, product code under `apps/server/src` (except the setup lines
of `sla-jobs.test.ts`), `apps/web`, `packages/`, vitest config, `ci.yml` triggers and matrix, the 400/800 budgets,
any existing test assertion.
