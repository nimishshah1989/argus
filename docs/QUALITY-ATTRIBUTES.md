# Quality attributes — what every change must satisfy

`docs/QUALITY-BAR.md` scores the whole product at a gate. This page is the per-change contract: the
attributes a pull request must satisfy **before** it may merge, each with a fixed id, how it is checked, and
the evidence the PR must carry. The ids are stable; a reviewer, a PR body and a gate report all cite the same
number.

Four runners decide an attribute, and the "Checked by" column names the exact one:

- **`quality`** — the local tool (`pnpm quality`; `pnpm quality:pr` in CI). It decides Q2, Q5, Q6, Q7, Q9, Q10, Q12, Q13 and Q16, plus Q15 through its `--main` mode (`pnpm main:check`).
- **`CI: api suite`** — needs Postgres, so CI runs it: Q3 (isolation) and Q4 (auth and permission).
- **`CI: gallery`** — the Playwright axe run in CI: Q8.
- **`review`** — a fresh reviewer decides, never the writer: Q1, Q11, Q14. The verdict names the id.

## The attributes

| id  | Attribute                | What it means                                                                                                                                                                                                    | Checked by    | Fails when                                                                                               |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| Q1  | Behaviour tested         | Every new branch, command, figure or refusal has a test that fails when that behaviour breaks. Tests assert what a user or caller observes.                                                                      | review        | New logic with no test, or a test that passes when the behaviour is removed.                             |
| Q2  | Test integrity           | No test deleted, skipped, weakened or marked `.only`. A test that cannot fail is a defect: remove it and say why in the commit.                                                                                  | quality       | A removed assertion or file, a new `skip`/`todo`/`.only`, or an unchanged test count after a fix.        |
| Q3  | Tenancy sealed           | Every tenant table is under forced RLS; no read or write crosses tenants; a new tenant table appears in the isolation catalogue.                                                                                 | CI: api suite | The isolation suite fails, or a new table is missing from its discovery list.                            |
| Q4  | Auth and permission      | Every route sits behind the kernel guard; each role's permission has a test; a refusal names its reason and its code.                                                                                            | CI: api suite | A route without a reply schema, an unguarded route, or a permission with no test.                        |
| Q5  | Data safety              | Migrations are additive first and destructive last, with a backup/guard; a merged migration is never edited; the revert is honest.                                                                               | quality       | `migrations:check`/`migrations:immutable` fails, or a destructive step has no guard.                     |
| Q6  | Lean budgets             | File ≤ 400 lines, function ≤ 60, no new dependency without an ADR, dead code removed, PR ≤ 400 lines (≤ 800 with a `Large PR:` reason).                                                                          | quality       | A budget fails, a dependency arrives unargued, or a PR is over 800 with no reason line.                  |
| Q7  | Design lock              | Screens are built from the kit and patterns; tokens only; no `className` or raw colour in `faces/`; deliberate differences listed.                                                                               | quality       | `ui:check` fails, or a screen PR has no side-by-side evidence and no difference list.                    |
| Q8  | Accessibility            | Targets ≥ 44 px (≥ 52 px primary), WCAG AA contrast, axe clean, the four view states, light and dark.                                                                                                            | CI: gallery   | The gallery axe run fails, a token contrast test fails, or a control is under the tap floor.             |
| Q9  | Internationalisation     | Every visible string is a catalogue key in both languages; no literal strings; Gujarati line height per the lock.                                                                                                | quality       | The catalogue test or the no-literal-string lint fails, or a shipped namespace has a blank `gu`.         |
| Q10 | Determinism              | Pure and domain code reads no clock, random source or local-time zone; a figure for a date is the same every run.                                                                                                | quality       | The determinism scan finds a clock, `Math.random`, `Date.parse` or a local-time constructor.             |
| Q11 | Operability              | No N+1 on a polled route, nothing that grows unbounded, every failure names its state, logs carry tenant and request ids.                                                                                        | review        | A per-item query on `/state` or a list reply, or an error the screen cannot explain.                     |
| Q12 | Evidence and memory      | The PR says what changed for a user, how to try it, what must be decided; a `changes/` fragment exists; rulings and merges reach the ledger.                                                                     | quality       | The body lacks the three headings, the fragment is missing, or the PR text is over the size gate.        |
| Q13 | No secrets, no real data | No secret in code, tests, fixtures, logs or screenshots; real names and phone numbers stay out of the repo.                                                                                                      | quality       | `secrets` or `pii:scan` fails.                                                                           |
| Q14 | Honest review            | A fresh reviewer that did not write the change returns the verdict in the ponytail format, with numbered `file:line` findings and the Q table.                                                                   | review        | Self-review, a verdict without evidence, or a finding without a proof.                                   |
| Q15 | Merge keeps main green   | After each merge the queue verifies the new `main`: check it out, run the test files the merged PR touched, and hotfix a red tree before the next merge.                                                         | quality       | The new `main` fails a test the merge touched, or the next PR discovers it (a red main blocks every PR). |
| Q16 | Scope kept               | A change to a v2 screen keeps everything the plant had: its `## Coverage` table is in the PR body and in `docs/design/v2/scope/<screen>.md`, and no row is MISSING or DROPPED without `Nimish said yes: <date>`. | quality       | The table is absent or empty in either place, or a MISSING or DROPPED row lacks the sign-off.            |

## How the gate runs

- **Local, before every push:** `pnpm quality`. It runs every `quality` row that is cheap and prints the Q
  table; a red row stops the push. Q9's catalogue test and Q10's determinism scan are plain vitest files with
  no database, so they run here too. Q3 and Q4 need Postgres (CI: api suite) and Q8 needs the gallery axe run
  (CI: gallery); the local tool never pretends to run them. It does not replace `pnpm precheck`; it adds the
  test-integrity and evidence checks precheck does not do.
- **Before any push:** `pnpm push:check`. It refuses a HEAD with nothing ahead of `main` (a rebase abort
  leaves you on main's commit, and the push empties the PR) and a tree with unresolved conflicts — the
  17 Nov incident, when a mid-conflict rebase plus a force push closed the PR.
- **CI, on every ready PR (`pr-meta`):** `pnpm quality:pr`. It fails the PR when the body does not carry the
  Q table, when a test was weakened, or when a size/parity/changelog gate fails.
- **Q16 reads the diff, not the whole repo.** `pnpm quality:pr` applies it only when the PR changes a non-test
  `.tsx` file in `apps/web/src/screens/v2/<screen>/`. It then needs a `## Coverage` table in the body with at
  least one data row, the same kind of table in the diff at `docs/design/v2/scope/<screen>.md` for each changed
  screen folder, and no MISSING or DROPPED row in either without `Nimish said yes: <date>`. The columns it reads
  are in `docs/design/v2/COVERAGE.md`. It proves the table exists and is clean, not that it is true: the
  orchestrator still compares it with the v1 code (`review`). PRs that touch no v2 screen are never held by it.
- **After every merge (Q15):** check out the new `main` and run `pnpm main:check`. It reads
  `git diff --name-only HEAD~1 HEAD`, keeps the changed `*.test.ts` files, runs them with `npx vitest run`,
  prints `main:check: <n> test file(s) from the last merge, all green`, and exits non-zero on a failure.
  Record the result in the ledger. A red `main` gets its own hotfix PR before the next merge — on 17 Nov a
  stale expectation from #206 broke `main` through #258 and was found only by the next PR's CI, which blocked
  the whole queue.
- **Before every merge:** the reviewer returns the Q table with a verdict per id. A FAIL on any id blocks the
  merge; a waiver is a ledger ruling, never a silent exception.

## The reviewer contract (Q14)

The reviewer is a fresh context that receives the plan (PR body + `changes/` fragment), the diff, and the test
output — never the writer's reasoning. It answers in the `ponytail-review` format (`What this change does:`,
then **Must fix** / **Should fix** / **Nice to have** with all four parts per finding, then `Verdict:` and
`Lean:`), followed by one line per Q id: `Q1 pass`, `Q7 n/a — docs only`, or `Q3 fail — see finding 2`.

## When an attribute fails

Stop. Fix it, re-run the gate, and record the evidence. Never merge on a failed attribute, never lower an
attribute to make a PR pass, and never add a bypass without a decision file and a ledger ruling.
