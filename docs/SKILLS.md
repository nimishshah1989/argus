# Skills — what is used, where, and what overrides what

The repo ships the Athena v3 suite: **Matt Pocock’s skills** (`grill-with-docs`, `grilling`, `domain-modeling`, `to-spec`, `to-tickets`, `tdd`, `diagnosing-bugs`), **Superpowers’** `subagent-driven-development`, **impeccable** for design, and **office-hours** for the product brief. DeepSeek Harness has native skills with the same intent; use the native one when it exists, read the pinned `SKILL.md` when it does not.

The skills are written for Claude Code with a human partner, `sonnet`/`opus` model pins and hooks. In DSH the pins and hooks do not apply; follow the **intent**, not the frontmatter. Precedence is in `docs/WORKFLOW.md`.

## 1. The map

| Phase             | Skill                                                   | Source                         | How it is used here                                                                                                                                               |
| ----------------- | ------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product shaping   | `office-hours`                                          | gstack                         | Already done; `docs/spec/SPEC.md` is the brief. Do not rerun unless a new product line is being shaped.                                                           |
| Product questions | `grill-with-docs` / `grilling` / `grill-me`             | Matt Pocock                    | Only for genuinely open product questions; one round of numbered questions with recommended answers. Nimish answers; the agent does not ask technology questions. |
| Domain language   | `domain-modeling`                                       | Matt Pocock                    | Glossary and decisions during design talks; output goes to `docs/spec/DOMAIN.md` and `docs/adr/`, not a second glossary.                                          |
| Spec and tickets  | `to-spec`, `to-tickets` / `to-issues`, `to-prd`         | Matt Pocock                    | The backlog is generated once from SPEC §11; a new feature is cut into vertical slices with blocking edges.                                                       |
| Planning          | `slice-planner`, `plan-reviewer`                        | Athena                         | R2/R3: every file, interface, field and test named before code. R1: ticket + parity row + screen spec.                                                            |
| Architecture      | `architect`, `architecture-reviewer`, `schema-reviewer` | Athena                         | New module, boundary, table or migration. Fresh context; fixed checklist.                                                                                         |
| Build             | `tdd`                                                   | Matt Pocock                    | Red → green, one seam at a time. The slice plan is the seam confirmation.                                                                                         |
| Lean code         | `ponytail`                                              | Dietrich Gebert (MIT; adapted) | The smallest complete change; no one-use abstraction; no new dependency without an ADR; hard budgets in `docs/LEAN.md`.                                           |
| Delegation        | `subagent-driven-development`                           | Superpowers                    | Fresh implementer per independent slice, task review, final integration review. See `docs/ORCHESTRATION.md`.                                                      |
| Debug             | `diagnosing-bugs` / `diagnose`                          | Matt Pocock                    | Reproduce, minimise, hypothesise, instrument, fix, regression test.                                                                                               |
| Design            | `impeccable` + `docs/DESIGN.md`                         | pbakaus / repo                 | Every user-facing screen; Operate/Read modes, not bolder modes.                                                                                                   |
| Design system     | `tailwind-design-system`, `ui-ux-pro-max`               | DSH native                     | Tokens, components, palettes, responsive patterns; the output is `docs/DESIGN-SYSTEM.md` and the component library.                                               |
| Prototype         | `prototype`                                             | DSH native                     | A throwaway floor/desk flow before committing to the screen; test on a phone.                                                                                     |
| Memory            | `handoff`                                               | DSH native                     | At two-thirds of the context or the end of a session; the next session starts from the doc.                                                                       |
| Review            | `code-reviewer`                                         | Athena                         | Every PR; fresh context; read-only; `PASS`/`FAIL` with file:line evidence.                                                                                        |
| Audit             | `improve-codebase-architecture`                         | DSH native                     | Later, at a gate, not during a feature slice.                                                                                                                     |

Not used now: `nextjs-app-router-patterns` (no Next.js), `vercel-react-best-practices` (not Vercel), `orca-cli`/`orchestration` (no Orca layer), `computer-use` (no GUI), `caveman` (not a communication mode we need).

The adapted Ponytail skill is in `.claude/skills/ponytail/SKILL.md`; the project rules are in `docs/LEAN.md`. In DSH it is not a native skill, so the lead applies it manually and the code-reviewer checks it.

## 2. The three conflicts, resolved

1. **`tdd` says “confirm the seams with the user”.** The user is not asked a technology question. The **slice plan** names the test seams; the plan reviewer confirms them. For R1, the screen spec and the four states are the seam confirmation.
2. **`to-tickets` says “quiz the user until they approve the breakdown”.** The backlog is approved once at the milestone plan, not ticket by ticket. A new feature’s slice breakdown is reviewed by the plan reviewer against the spec; Nimish sees the user-visible scope at the gate.
3. **`subagent-driven-development` says a merge is a stop-and-ask.** Our harness says the agent merges when CI is green and the review passes. The **review** is the gate, not a human click. The skill’s v3 note already replaces “rulings, not stalls” with the determinism rule; this file extends that to the merge.

## 3. How a skill is used in practice

A skill is a checklist, not an authority. For example, `tdd` means:

- The slice plan names the test file, the test name and the Given/When/Then.
- Write the test; it fails for the right reason.
- Write the minimum code; it passes.
- Run the whole suite, not just the new test.
- A test that cannot fail is rewritten; a test weakened to go green is a failed review.

For `impeccable`, the checklist is `docs/DESIGN.md` plus the screen spec: role, task, one primary action, empty/loading/error/offline states, 52 px targets, WCAG AA, Gujarati/Hindi text, low-end phone. A screenshot that looks good is not a pass.

## 4. Where the skills live

- Repo: `.claude/skills/<name>/SKILL.md` and `.claude/agents/<name>.md`.
- DSH native: the session skill catalogue (`tdd`, `diagnose`, `grill-me`, `grill-with-docs`, `to-issues`, `to-prd`, `triage`, `handoff`, `prototype`, `improve-codebase-architecture`, `tailwind-design-system`, `ui-ux-pro-max`, `write-a-skill`).
- The repo’s `office-hours`, `impeccable`, `domain-modeling`, `to-spec`, `to-tickets` and `subagent-driven-development` have no exact DSH native equivalent; read the `SKILL.md` and follow its intent with DSH tools.

## 5. Model pins and hooks

`model: sonnet` / `model: opus` / `model: fable` do not resolve in DSH. The hooks in `.claude/harness/hooks/` do not fire. The replacement is the protocol: `HANDOFF` at the start and end, `todo_write` for the session, fresh-context `subagent` reviewers, and the repo as the durable memory. If model diversity is required for the maker-checker, the build runs in Claude Code or adds a human reviewer for R3.
