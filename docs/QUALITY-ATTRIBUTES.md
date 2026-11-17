# Quality attributes — what every change must satisfy

`docs/QUALITY-BAR.md` scores the whole product at a gate. This page is the per-change contract: the
attributes a pull request must satisfy **before** it may merge, each with a fixed id, how it is checked, and
the evidence the PR must carry. The ids are stable; a reviewer, a PR body and a gate report all cite the same
number.

Two kinds of checking:

- **auto** — a command decides. Run by `pnpm quality` locally and by `pnpm quality:pr` in CI (`pr-meta`).
- **review** — a fresh reviewer decides (never the writer). The verdict names the id.

## The attributes

| id  | Attribute                | What it means                                                                                                                                  | Checked by | Fails when                                                                                        |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| Q1  | Behaviour tested         | Every new branch, command, figure or refusal has a test that fails when that behaviour breaks. Tests assert what a user or caller observes.    | review     | New logic with no test, or a test that passes when the behaviour is removed.                      |
| Q2  | Test integrity           | No test deleted, skipped, weakened or marked `.only`. A test that cannot fail is a defect: remove it and say why in the commit.                | auto       | A removed assertion or file, a new `skip`/`todo`/`.only`, or an unchanged test count after a fix. |
| Q3  | Tenancy sealed           | Every tenant table is under forced RLS; no read or write crosses tenants; a new tenant table appears in the isolation catalogue.               | auto       | The isolation suite fails, or a new table is missing from its discovery list.                     |
| Q4  | Auth and permission      | Every route sits behind the kernel guard; each role's permission has a test; a refusal names its reason and its code.                          | auto       | A route without a reply schema, an unguarded route, or a permission with no test.                 |
| Q5  | Data safety              | Migrations are additive first and destructive last, with a backup/guard; a merged migration is never edited; the revert is honest.             | auto       | `migrations:check`/`migrations:immutable` fails, or a destructive step has no guard.              |
| Q6  | Lean budgets             | File ≤ 400 lines, function ≤ 60, no new dependency without an ADR, dead code removed, PR ≤ 400 lines (≤ 800 with a `Large PR:` reason).        | auto       | A budget fails, a dependency arrives unargued, or a PR is over 800 with no reason line.           |
| Q7  | Design lock              | Screens are built from the kit and patterns; tokens only; no `className` or raw colour in `faces/`; deliberate differences listed.             | auto       | `ui:check` fails, or a screen PR has no side-by-side evidence and no difference list.             |
| Q8  | Accessibility            | Targets ≥ 44 px (≥ 52 px primary), WCAG AA contrast, axe clean, the four view states, light and dark.                                          | auto       | The gallery axe run fails, a token contrast test fails, or a control is under the tap floor.      |
| Q9  | Internationalisation     | Every visible string is a catalogue key in both languages; no literal strings; Gujarati line height per the lock.                              | auto       | The catalogue test or the no-literal-string lint fails, or a shipped namespace has a blank `gu`.  |
| Q10 | Determinism              | Pure and domain code reads no clock, random source or local-time zone; a figure for a date is the same every run.                              | auto       | The determinism scan finds a clock, `Math.random`, `Date.parse` or a local-time constructor.      |
| Q11 | Operability              | No N+1 on a polled route, nothing that grows unbounded, every failure names its state, logs carry tenant and request ids.                      | review     | A per-item query on `/state` or a list reply, or an error the screen cannot explain.              |
| Q12 | Evidence and memory      | The PR says what changed for a user, how to try it, what must be decided; a `changes/` fragment exists; rulings and merges reach the ledger.   | auto       | The body lacks the three headings, the fragment is missing, or the PR text is over the size gate. |
| Q13 | No secrets, no real data | No secret in code, tests, fixtures, logs or screenshots; real names and phone numbers stay out of the repo.                                    | auto       | `secrets` or `pii:scan` fails.                                                                    |
| Q14 | Honest review            | A fresh reviewer that did not write the change returns the verdict in the ponytail format, with numbered `file:line` findings and the Q table. | review     | Self-review, a verdict without evidence, or a finding without a proof.                            |

## How the gate runs

- **Local, before every push:** `pnpm quality`. It runs the `auto` attributes that are cheap and prints the
  Q table; a red row stops the push. It does not replace `pnpm precheck`; it adds the test-integrity and
  evidence checks precheck does not do.
- **Before any push:** `pnpm push:check`. It refuses a HEAD with nothing ahead of `main` (a rebase abort
  leaves you on main's commit, and the push empties the PR) and a tree with unresolved conflicts — the
  17 Nov incident, when a mid-conflict rebase plus a force push closed the PR.
- **CI, on every ready PR (`pr-meta`):** `pnpm quality:pr`. It fails the PR when the body does not carry the
  Q table, when a test was weakened, or when a size/parity/changelog gate fails.
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
