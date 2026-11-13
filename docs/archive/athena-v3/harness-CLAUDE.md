# Athena v3: how work is done here

Shared by every v3 repository; installed by athena-ops `harness-v3/install.py`, which overwrites it. Repo-specific facts live in the repo's own `CLAUDE.md`, below the line that imports this file.

## Who decides
- Nimish answers product and business questions only, and tests previews. Never ask him a technology question.
- Agents decide all technology, review each other, and merge when CI is green and the PR review passes.
- Report to him in plain English: what changed for a user, what he can try, what question you need answered.

## Four rules (Karpathy)
1. **Think first.** State assumptions. Two readings of the ask: name both; never pick one silently.
2. **Simplest thing that works.** Nothing the slice didn't ask for. If 200 lines could be 50, rewrite them.
3. **Surgical.** Every changed line traces to the slice. Match the existing style; don't refactor beside it.
4. **Goal-driven.** Turn the slice into failing tests, then loop until they pass.

## Engineering rules
- Vertical slices by default: one slice is usable end to end. Split backend from frontend only when a slice cannot stand alone.
- Modules talk only through their published interfaces. CI enforces the boundaries.
- A bug is fixed by reproducing it in a failing test first, then fixing the root cause, not the symptom.
- Every slice ships its tests; the whole suite runs on every PR.
- Never delete, skip or weaken a test to go green. A test you believe is wrong is a question for the planner (or, if it is a product rule, for Nimish).

## Determinism rule
A coder starts only when the slice plan names every file, interface, data field and test case (given / when / then).
If the plan is silent on something, the coder stops and returns the question to the planner. Never guess.
A schema or architecture change found mid-build goes back through the architecture maker-checker.

## Flow and models
| Step | Who makes | Who checks | Output |
| --- | --- | --- | --- |
| Brief | `office-hours`, then `grill-with-docs` (product questions only) | Nimish answers | `docs/BRIEF.md` |
| Architecture and schema | `architect` agent (Fable, `claude-fable-5-1`) | `architecture-reviewer` (Opus, fresh context): modular monolith unless reasoned; one interface per module; no cross-module database access; versioned contracts; one source of truth; failure and idempotency at boundaries; observability; security by default; simplest stack; every choice traces to the brief. `schema-reviewer` (Opus): tables match the data map; normalised; keys, constraints, indexes for known queries; personal and child data minimised and scoped; reversible migrations, no silent data loss; audit fields; every slice covered | `docs/ARCHITECTURE.md`, `docs/DATA-MAP.md` (Nimish approves this one), the technical schema |
| Milestones to slices | `to-spec`, then `to-tickets`; one milestone ahead only | | GitHub issues |
| Slice plan and test cases | `slice-planner` agent (Opus) | `plan-reviewer` (Opus, fresh context): files, interfaces, fields and tests named; Given/When/Then tests that fail first; no guessing; vertical or split justified; own interface only; regression risk named | `docs/slices/<issue>.md` |
| Build | Sonnet: `tdd` + `subagent-driven-development` | the tests | a PR |
| PR review | | `code-reviewer` (Opus): matches the plan exactly, nothing extra; tests first, none deleted, skipped or weakened; boundaries kept; no secrets or real personal data; errors handled at boundaries; data safety; whole suite green | PASS + green CI: the agent merges |
| Design | `impeccable` + `docs/DESIGN.md` | Nimish tests the preview | |
| Debug | `diagnosing-bugs` | the failing test | |

Issues live in this repo's GitHub Issues; a ticket an agent may build carries the label `ready-for-agent`.
Every reviewer is a read-only agent with a fixed checklist; its verdict is `PASS` or `FAIL` plus numbered findings, each naming the checklist item, the evidence and the fix.
Fable is used only for the architecture step and later schema changes. Everything else runs on the model in the table.

## Data safety
- No secrets and no real personal data anywhere: code, tests, fixtures, screenshots, logs. Use environment variables and fake data.
- A migration that alters or deletes existing data needs the `schema-reviewer`'s PASS and a backup step written into the migration's plan, run before it.

## Hooks (`.claude/harness/hooks/`, five, Python standard library)
- Session start loads `docs/HANDOFF.md` and `wiki/index.md`.
- Before a tool runs it blocks: secrets in files, pushes to main or master, force-pushes, `--no-verify`, deleting or skipping tests.
- After a file edit it formats that file when the repo has a formatter.
- Stop runs the fast tests (`.claude/harness/fast-tests.sh`); you cannot finish while they fail (after three failures in a row it lets you stop: write the failure into the handoff).
- Session end refreshes the facts block in `docs/HANDOFF.md` and appends a line to `wiki/log.md`.

## Git
- Work on a branch; never push to main or master; never force-push; never `--no-verify`.
- One slice per PR. The PR body says what changed for a user, which tests prove it, and how to try the preview.

## Memory (Karpathy's LLM wiki)
- `docs/HANDOFF.md`: where things stand, under 50 lines. Read first; rewrite the top part at the end of every session.
- `wiki/`: one page per topic the code cannot say for itself (why, not what). `wiki/index.md` lists every page in one line each.
- `wiki/log.md`: append-only, one line per session or slice. Never edit old lines.
- Decisions: `docs/decisions/`, one short file each, with what was rejected and why.

## Design
Anything a person looks at follows `docs/DESIGN.md` (Apple's principles: clarity, deference, depth) and uses the `impeccable` skill.
