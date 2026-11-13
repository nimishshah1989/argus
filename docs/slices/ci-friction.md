# CI friction follow-up

No GitHub issue (follow-up to #76) · branch `claude/ci-friction` · one PR · fragment `changes/85-ci-friction.md`
(85 is the next free number) · this PR itself needs the `no-parity` label or its own `No parity: <reason>` line.

## 1. Goal

A PR author unblocks the size and parity gates by writing the reason in the PR description instead of hunting for a
label, runs every static CI check locally with one `pnpm precheck`, and no longer sees a passing test run end in "Unhandled Errors" from a stopped Postgres container.

## 2. Decisions (already ruled, technical)

- **No auto-labelling:** a `GITHUB_TOKEN` `labeled` event does not re-trigger CI, so a labeller would race the check it is meant to satisfy and would need `pull-requests: write`. The body becomes a second accepted proof; the label alone still passes as today, and a missing or too-short reason with no label still fails.
- The PR body is untrusted input: it is passed as a step `env:` value, never interpolated into a `run:` script.
- Reason text inside an HTML comment is ignored, so the template's placeholder never counts as a reason.

## 3. Files

- `tools/pr-reason.ts` — new: `ReasonKey`, `prReason`.
- `tools/pr-reason.test.ts` — new: T1–T9.
- `tools/check-pr-size.ts` — add `largePrAllowed`, use it at the HARD gate, new failure message, and guard `main()` with `import.meta.url === pathToFileURL(process.argv[1] ?? '').href` (as in `check-parity-update.ts`) so a test can import it.
- `tools/check-parity-update.ts` — add `paritySkipAllowed`, use it in `main()`, name both fixes in the skip log and in the `parityUpdateErrors` message (still contains `docs/spec/parity.yaml`, still exactly one error, so the existing assertions pass).
- `tools/precheck.ts` — new, under 60 lines, node stdlib only: `changedFiles` + `main()`.
- `tools/precheck.test.ts` — new: T10–T12.
- `apps/server/test/harness.ts` — add `tolerateShutdown`; attach it to `admin` and `app` in `startTestDb`; `stop()` calls both begins, then ends the pools, then stops the container (existing order kept).
- `apps/server/test/harness-shutdown.test.ts` — new: T13–T17.
- `.github/workflows/ci.yml` — `pull_request.types` gains `edited`; `PR_BODY: ${{ github.event.pull_request.body }}` added to the `env:` of the `pnpm parity:update` and the `pnpm pr:size` step.
- `.github/pull_request_template.md` — the "Label reasons" section documents the two lines with the examples **inside** the HTML comment; the two label bullets name the body line too; one new `pnpm precheck` bullet in Verification.
- `package.json` — `"precheck": "tsx tools/precheck.ts"`.
- `docs/BUILD-PROTOCOL.md` — one bullet at the end of "Rules that do not bend": run `pnpm precheck` before every push.
- `changes/85-ci-friction.md` — new fragment, one user-facing line per part.

## 4. Interfaces

- `tools/pr-reason.ts`: `export type ReasonKey = 'Large PR' | 'No parity'` and `export function prReason(body: string | undefined, key: ReasonKey): string | null` — strips `<!-- … -->` comments, then scans lines for `^\s*(?:[-*]\s+)?<key>\s*:\s*(.+)$` (key case-insensitive, its space literal); returns the first captured reason, trimmed, with at least 10 non-space characters, else `null`.
- `tools/check-pr-size.ts`: `export function largePrAllowed(env: NodeJS.ProcessEnv): boolean` = `Boolean(env.LEAN_ALLOW_LARGE) || prReason(env.PR_BODY, 'Large PR') !== null`.
- `tools/check-parity-update.ts`: `export function paritySkipAllowed(env: NodeJS.ProcessEnv): boolean` = `Boolean(env.PARITY_ALLOW_SKIP) || prReason(env.PR_BODY, 'No parity') !== null`; existing exports unchanged.
- `tools/precheck.ts`: `export function changedFiles(outputs: string[], exists: (path: string) => boolean): string[]` splits each listing on `\n`, trims, drops blanks, dedupes keeping first order, keeps only existing paths. `main()` collects `git diff --name-only --diff-filter=ACMR origin/main...HEAD` (empty plus a printed note when the base is missing), `git diff --name-only --diff-filter=ACMR HEAD` and `git ls-files --others --exclude-standard`; runs `pnpm exec prettier --write --ignore-unknown --no-error-on-unmatched-pattern <files>` (skipped when empty); then `pnpm run <step>` for `lint`, `typecheck`, `changelog:check`, `docs:check`, `boundaries`, `pii:scan`, `migrations:check` in that order, `stdio: 'inherit'`, failing fast.
- `apps/server/test/harness.ts`: `export function tolerateShutdown(pool: Pool): () => void` attaches one `'error'` listener that returns when the returned begin function has already been called **and** `(error as { code?: string }).code === '57P01'`, and re-throws otherwise. `TestDb` fields are unchanged.
- Messages: `pr-size: FAIL over 800 lines; split the PR, add the size:large label, or put a line "Large PR: <reason>" (at least 10 characters) in the PR description`; `parity:update: N product file(s) changed but docs/spec/parity.yaml did not; update the ledger, add the no-parity label, or put a line "No parity: <reason>" (at least 10 characters) in the PR description`; `precheck: FAILED at <step> — fix it, rerun pnpm precheck` then `process.exit(1)`; on success `precheck: OK — <n> file(s) formatted, 7 checks passed`.

## 5. Data

No table, column or migration is read or written, so there is **no schema change** and this slice does not go back
through the architect or the schema reviewer. Values used: `PR_BODY` (`string | undefined`, step env from
`github.event.pull_request.body`); `LEAN_ALLOW_LARGE`, `PARITY_ALLOW_SKIP` (`string | undefined`, step env from the
label check, unchanged); the reason text (`string | null`, lives only in the PR description, never stored); the
three git listings (`string`, stdout); the pg `'error'` payload `code` (`string`, `'57P01'`, in-process only).

## 6. Test cases

`tools/pr-reason.test.ts`, `describe('pr reason')`:

- **T1** `reads the reason from a Large PR line` — Given `"intro\nLarge PR: ports the whole gallery suite\n"`, When `prReason(body, 'Large PR')`, Then `'ports the whole gallery suite'`.
- **T2** `matches the key case-insensitively and after a bullet` — Given `"- large pr: ports the whole gallery suite"`, When the same call, Then the trimmed reason.
- **T3** `rejects a reason under 10 non-space characters` — Given `"Large PR: too  big"`, When called, Then `null`.
- **T4** `ignores placeholder text inside an HTML comment` — Given the template text whose comment contains `Large PR: <why this PR is over 800 lines>`, When called for either key, Then `null`.
- **T5** `does not match the key mid-line` — Given `"this is a Large PR: because I said so and more"`, When called, Then `null`.
- **T6** `returns null for an undefined or empty body` — Given `undefined` and `''`, When called, Then `null` twice.
- **T7** `keeps the two keys apart` — Given a body with only a `No parity:` line, When `prReason(body, 'Large PR')` and then `prReason(body, 'No parity')`, Then `null` and the reason.
- **T8** `allows a large PR by label or by body line` — Given `{ LEAN_ALLOW_LARGE: '1' }`, `{ PR_BODY: 'Large PR: ports the whole gallery suite' }`, `{}` and `{ PR_BODY: 'Large PR: short' }`, When `largePrAllowed(env)`, Then `true, true, false, false`.
- **T9** `allows a parity skip by label or by body line` — the same four shapes with `PARITY_ALLOW_SKIP` and `No parity:`, When `paritySkipAllowed(env)`, Then `true, true, false, false`.

`tools/precheck.test.ts`, `describe('precheck changed files')`:

- **T10** `dedupes a path listed by two git commands` — Given `['a.ts\nb.ts\n', 'b.ts\n', '']` and `exists = () => true`, When `changedFiles(...)`, Then `['a.ts', 'b.ts']`.
- **T11** `drops a path that no longer exists` — Given `['gone.ts\nkept.ts\n']` and `exists = (p) => p === 'kept.ts'`, When called, Then `['kept.ts']`.
- **T12** `returns nothing for empty output` — Given `['', '\n', '  ']`, When called, Then `[]`.

`apps/server/test/harness-shutdown.test.ts`, `describe('tolerate shutdown')`. Red step: with the listener removed, T13 fails and T16 ends the file in "Unhandled Errors".

- **T13** `re-throws 57P01 before shutdown begins` — Given an unconnected `new Pool()` guarded by `tolerateShutdown`, When `pool.emit('error', shutdownError, undefined as never)` where `shutdownError = Object.assign(new Error('terminating connection…'), { code: '57P01' })`, Then it throws; then `await pool.end()`.
- **T14** `swallows 57P01 once shutdown has begun` — Given the same pool with `begin()` called, When the same emit, Then it does not throw.
- **T15** `re-throws any other code after shutdown begins` — Given `begin()` called, When emitting an error with `code: '08006'`, Then it throws.
- **T16** `a stopped container emits 57P01 and the guarded pool still ends` (timeout 60_000) — Given a bare `new PostgreSqlContainer('postgres:16-alpine')` (not `startTestDb`, so there is no second container teardown to manage) and two `max: 1` pools that have each run `select 1`, one `observed` with a plain `'error'` listener and one `guarded` with only `tolerateShutdown`, both begun, When `await container.stop()`, Then `observed` receives `code === '57P01'`, `guarded` reports nothing unhandled, and `await expect(guarded.end()).resolves.toBeUndefined()` and the same for `observed` — pg drops a client whose socket errored, so `end()` has no live client to drain and a hang would show as this test timing out.
- **T17** `startTestDb teardown is clean` (timeout 60_000) — Given `startTestDb()` with one query on `admin` and one on `app`, When `await db.stop()`, Then it resolves and the file reports no unhandled error.

## 7. Regression risk

- `tools/parity-update.test.ts` assertions are untouched: the reworded message still contains the ledger path and still yields exactly one error.
- `check-pr-size.ts` gains an `import.meta.url` guard; `pnpm pr:size` runs the file directly, so it still executes.
- `edited` re-runs CI on any title or body edit; the existing concurrency group cancels superseded runs.
- `tolerateShutdown` must not hide real failures: anything other than 57P01-after-begin is re-thrown (T13, T15).
- `packages/db` tests already end their pools before `container.stop()`; they need no change and get none.

## 8. Out of scope / not touched

No auto-labelling action and no `pull-requests: write`. No change to the 400/800 budgets, the parity rule, the vitest config, `pnpm verify`, the CI job matrix or shard counts, or product code in `apps/server/src`, `apps/web` or `packages/`. No change to `docs/plan/ledger.md`, `docs/plan/MILESTONES.md`, `docs/LEAN.md`, `docs/spec/parity.yaml`, or any existing test assertion.
