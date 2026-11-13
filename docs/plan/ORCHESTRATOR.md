# Orchestrator — how the build runs

The goal post is `docs/plan/MILESTONES.md`: 7 milestones, 47 tickets, each with 2–3 goals and its blocking
edges. Completeness is proven in `docs/plan/COVERAGE.md`. This file says how one orchestrator session turns
that graph into merged, tested, previewed software under the Athena v3 harness.

## 1. The graph

- **Nodes** = the 47 tickets. Each node's **exit condition** is its 2–3 goals, written as Given/When/Then
  tests at the seams in MILESTONES.md (API on real data, one browser journey, the engine against the answer key).
- **Edges** = "Blocked by". A ticket is **ready** when every blocker is merged to `main`.
- **Frontier** = all ready tickets not yet started. The orchestrator always works the frontier.
- **Milestone gate** = all tickets of a milestone merged + the gate check in MILESTONES.md + Nimish's go.
  The next milestone's tickets become ready only after that gate.

## 2. Roles (Athena v3 model table)

| Step                                       | Who                                                                      | Model               | Output                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------ | ------------------- | -------------------------------------------------------------------- |
| Orchestrator                               | the main session                                                         | Opus                | picks the frontier, dispatches, rules, merges, keeps the ledger      |
| Define                                     | `slice-planner` agent                                                    | Opus                | `docs/slices/<issue>.md`: files, interfaces, fields, Given/When/Then |
| Check the plan                             | `plan-reviewer` agent, fresh context                                     | Opus                | PASS or FAIL with numbered findings                                  |
| Schema (only if the ticket changes tables) | `architect` + `schema-reviewer`                                          | Fable + Opus        | migration plan inside the D17 table budget                           |
| Code                                       | implementer subagents (`subagent-driven-development`, `tdd`, `ponytail`) | Sonnet              | commits on the ticket branch, tests first                            |
| Task review                                | fresh reviewer per task                                                  | Sonnet/Opus by risk | spec ✅ and quality ✅, or findings                                  |
| PR review                                  | `code-reviewer` agent, fresh context                                     | Opus                | PASS or FAIL against the slice plan                                  |
| Product check                              | Nimish                                                                   | —                   | tries the slice on staging; answers product questions only           |

## 3. The loop for one ticket: Define → Code → Test → Build

```
DEFINE   issue (ready-for-agent) → slice-planner writes the plan → plan-reviewer PASS
         (FAIL → planner revises; silence in the plan = stop and ask, never guess)
CODE     ticket worktree + branch → for each task in the plan:
           implementer (Sonnet) writes the failing test, then the smallest code (ponytail) → commit
           task reviewer → fix rounds 1–3 resume the implementer, 4–5 a stronger model → breaker at 5
TEST     stop hook runs the fast tests (~2 s) on every agent stop
         the ticket's seam tests (API on real data, browser journey, engine vs answer key) all green
BUILD    PR → code-reviewer PASS + CI green (lint, typecheck, touched-module API tests, isolation, smoke)
         → the agent merges (Nimish, 13 Nov: agents merge on code-review PASS + green CI) → staging deploys → Nimish previews if user-visible → ledger, parity, HANDOFF updated
EXIT     every goal of the ticket has a passing test on main. Otherwise the loop continues.
```

### 3a. Lean rules (Nimish, 13 Nov — these override the loop above where they differ)

- **Plan:** the slice plan names files, interfaces and the ticket's goal tests only. One plan review;
  if it fails, the orchestrator rules on the findings and coding starts. No second round.
- **Tests per ticket = the ticket's goals.** Each goal is one test (or a few) at its seam, written first.
  No extra unit tests beyond what a goal or a bug fix needs.
- **While coding:** fast tests plus the touched files' tests only. No per-task reviews; one implementer
  works through the plan.
- **Before push:** the touched module's API tests and the browser smoke, once.
- **PR:** CI (lint, typecheck, touched-module API tests, tenant isolation, browser smoke) + one
  `code-reviewer` pass. Low-risk tickets merge on that. The orchestrator's own independent review runs
  only on high-risk tickets: schema or migration, auth or permissions, tenancy, deleting or rewriting data.
- **Comprehensive testing once per milestone:** the full API suite, every browser journey and any soak run
  at the milestone gate, before Nimish's check — not per ticket.
- **Timebox:** a ticket should reach its PR in about an hour; past two, the orchestrator cuts scope or rules.

Stop conditions (the only four from `subagent-driven-development`): an irreversible or destructive
operation, a security-sensitive action, a side effect outside the ticket's branch that needs a person (a
production deploy, an outside account), and a plan so broken every path is a guess. Everything else is a
**ruling** the orchestrator records in the ledger (`Ruling: what — why — cost if wrong`) and keeps going.

## 4. Parallel development

- **Within a ticket: one implementer at a time.** Tasks in one ticket share files; parallel writers conflict.
- **Across tickets: up to 3 at once**, each in its own git worktree, branch and PR, chosen from the frontier
  so their write areas don't overlap (MILESTONES "What can run at the same time").
- **Serialised on purpose:** tickets that change the schema (one milestone migration at a time), and merges
  (one merge queue: rebase on `main`, CI green, then merge).
- **How parallel agents stay in step.** They do not message each other; that is how agents drift. They share
  three things the orchestrator owns: the frozen contracts in each slice plan (an interface another ticket
  depends on is written there before either builds), `main` (every merge is the new truth; a running ticket
  rebases), and the ledger. When ticket A's plan changes an interface ticket B uses, the orchestrator
  pauses B, updates B's plan, and resumes it.

## 5. Memory that survives

Cloud containers are temporary, so everything durable is committed or on GitHub:

| What                                                               | Where                                                                                        |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Ticket state (todo, in progress, done, parked) and PR              | The progress tracker at the top of `docs/plan/MILESTONES.md` (wins); GitHub Issues mirror it |
| Orchestrator ledger (dispatches, fix rounds, rulings, completions) | `docs/plan/ledger.md`, one line per event, committed on each merge                           |
| Where things stand                                                 | `docs/HANDOFF.md` (< 50 lines), rewritten at every session end                               |
| Per-ticket plan and evidence                                       | `docs/slices/<issue>.md`                                                                     |

A fresh orchestrator session reads HANDOFF, the ledger and the open issues, and resumes at the frontier.
It never re-dispatches a ticket the ledger marks complete.

## 6. What Nimish sees

- A PR per ticket, each saying what changed for a user and how to try it on staging.
- A gate report per milestone (`docs/plan/gates/<M>.md`): goals → tests → evidence, and the go/no-go question.
- Product questions only, when a ticket's plan needs a product answer (e.g. the ranking method).

## 7. Running it

The orchestrator is one Claude Code session started with: "Orchestrate `docs/plan/MILESTONES.md` per
`docs/plan/ORCHESTRATOR.md`." It works the frontier wave by wave until the milestone gate, writes the gate
report, and stops for Nimish's go. Multi-ticket waves may run as a Workflow (deterministic fan-out with
worktree isolation per ticket); single tickets run as direct agent dispatches.
