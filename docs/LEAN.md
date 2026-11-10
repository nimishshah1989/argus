# Lean — the anti-bloat mechanism

Agents default to more code: more abstractions, more options, more files, more dependencies. This repo makes “the smallest complete change” a review gate, not a preference. The source skill is Ponytail (MIT, [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)); the adapted skill is `.claude/skills/ponytail/SKILL.md`.

## 1. The ladder

Before writing, read the task and the code it touches — callers, tests, fixtures, config, exports. Then take the first rung that fully works:

1. **Does it need to exist?** Drop features, options and flexibility nobody asked for; name them in one line.
2. **Already in this codebase?** Reuse the helper, component, service or pattern.
3. **Standard library or platform feature?** Use it.
4. **An installed dependency?** Use it; never add one for a few lines.
5. **Can it be one line a reader gets?** One line.
6. **Otherwise:** the minimum that works.

**Rule of two:** no abstraction, interface, factory, wrapper or generic until there is a second real use. A one-implementation interface is deleted in review.

**Delete before add.** Prefer removing a branch, an option, a file or a dependency over adding one. A feature that is not a parity row or a written addition is not built.

**Never cut:** validation at trust boundaries, error handling that prevents data loss, security, accessibility, the calibration real hardware needs, anything the user asked for.

## 2. Hard budgets

| Budget                      | Limit                                                                | Enforcement                                                                                                |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Source file                 | **400 lines** (warn 250)                                             | `tools/check-size.ts` + ESLint `max-lines`; tests, migrations, generated code and i18n catalogues excluded |
| React screen/component file | **300 lines** (warn 200)                                             | `tools/check-size.ts`; split by responsibility, not by line count                                          |
| Function                    | **60 lines** (warn 40)                                               | ESLint `max-lines-per-function`                                                                            |
| Cyclomatic complexity       | **12**                                                               | ESLint `complexity`                                                                                        |
| Nesting depth               | **4**                                                                | ESLint `max-depth`                                                                                         |
| Parameters                  | **4**                                                                | ESLint `max-params`                                                                                        |
| New runtime dependency      | **0 without an ADR**                                                 | `tools/check-deps.ts`; every dependency in `THIRD_PARTY.md`; licence allowlist                             |
| PR changed lines            | **400 soft / 800 hard** (excluding lockfiles, migrations, generated) | `tools/check-pr-size.ts`; a `size:large` label or `LEAN_ALLOW_LARGE=1` with a written reason               |
| `shortcut:` comments        | Ledger at every gate                                                 | `tools/check-shortcuts.ts` → `docs/plan/DEBT.md`                                                           |
| Duplicate logic             | 0                                                                    | Review: grep before writing; reuse the shared function                                                     |

**Exceptions:** a file over 400 lines may carry `// lean-allow: <one-line reason>` in its first five lines **and** a reviewer’s approval in the PR. The default is no. Schema files are split by domain (`tickets`, `people`, `machines`, `config`) so no one file owns the whole database. Migrations are exempt from the line budget, not from review.

## 3. The lean review (every PR)

Added to `docs/REVIEW-MECHANISMS.md` as part of code review. The reviewer asks:

- What can be **deleted** from this diff?
- Is any abstraction, interface, wrapper or option used **only once**?
- Is this already in the codebase, the standard library or an installed dependency?
- Is there a **new dependency**? What did it replace? Was an ADR written?
- Are any files, functions or components over budget? Is the exception justified?
- Is there a `shortcut:` comment? Is it in the ledger with an upgrade trigger?
- Is the **net line count** justified by the user-visible behaviour?
- Did the change touch anything outside its slice?
- Is the non-trivial logic tested, without testing the implementation?

Verdict is still `PASS` or `FAIL`; a lean finding is numbered like any other.

## 4. Automation

| Check             | Script                     | Fails when                                                                           |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| File size         | `tools/check-size.ts`      | A source file is over 400 lines without `lean-allow`                                 |
| Dependency budget | `tools/check-deps.ts`      | A runtime dependency is not in `THIRD_PARTY.md` or is outside the licence allowlist  |
| PR size           | `tools/check-pr-size.ts`   | Over 800 changed lines without an explicit large-PR reason                           |
| Shortcut ledger   | `tools/check-shortcuts.ts` | A `shortcut:` comment is not in `docs/plan/DEBT.md` (reported, not silently dropped) |
| Lint budgets      | ESLint                     | Function/complexity/depth/params limits                                              |
| Duplicate/unused  | ESLint + `tsc`             | Unused exports/variables, duplicate imports                                          |

The checks run on every PR and print a one-screen **size report**: total source lines, files over 250, largest files, runtime dependency count, new dependencies, shortcut count, net diff. The gate report includes it.

## 5. At every milestone gate

A **lean audit** (run `pnpm audit:lean`) produces:

- Total source lines and the ten largest files.
- Files over 250 and 400 lines, with reasons.
- Runtime dependency count and any new dependency since the last gate.
- `shortcut:` ledger with owner and upgrade trigger.
- Duplicate or unused code found by the reviewer.
- Net lines added vs deleted.
- The senior-engineer scorecard (`docs/QUALITY-BAR.md`).

A gate does not pass with a file over 400 lines that has no approved reason, a new dependency without an ADR, or an unresolved shortcut with no trigger.

## 6. Why this is not “code golf”

The goal is not the fewest characters. It is **the smallest complete change that a senior engineer can read, test and maintain**. The rules never cut validation, error handling, security, accessibility or a test for non-trivial logic. Fewer lines are a consequence of solving the right problem once, not of hiding complexity.

## 7. The one-sentence version

Before adding code, prove it needs to exist; before adding an abstraction, prove a second use; before adding a dependency, prove the standard library or an installed one cannot do it; before merging, leave the code smaller and clearer than you found it.
