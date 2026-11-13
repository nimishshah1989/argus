# Orchestrator — how the build runs

The goal post is `docs/plan/MILESTONES.md`: 7 milestones, 47 tickets, each with 2–3 goals and its blocking
edges. Completeness is proven in `docs/plan/COVERAGE.md`. This file says how one orchestrator session turns
that graph into merged, tested, previewed software under pstack.

## 1. The graph

- **Nodes** = the 47 tickets. Each node's **exit condition** is its 2–3 goals, written as Given/When/Then
  tests at the seams in MILESTONES.md (API on real data, one browser journey, the engine against the answer key).
- **Edges** = "Blocked by". A ticket is **ready** when every blocker is merged to `main`.
- **Frontier** = all ready tickets not yet started. The orchestrator always works the frontier.
- **Milestone gate** = all tickets of a milestone merged + the gate check in MILESTONES.md + Nimish's go.
  The next milestone's tickets become ready only after that gate.

## 2. Roles and models (pstack, D23)

| Step                  | Who                                                            | Model                 |
| --------------------- | -------------------------------------------------------------- | --------------------- |
| Orchestrator          | the main session, running `/pstack:poteto-mode`                | Opus                  |
| Understand and design | pstack `how` and `architect` inside the Feature playbook       | Opus                  |
| Code                  | pstack code delegate, one per ticket                           | Sonnet                |
| Hardest changes       | schema, migrations, tenancy, concurrency                       | Fable                 |
| Verify                | the ticket's goal tests + a run on the real surface (browser)  | Sonnet                |
| PR review             | `ponytail-review`; `/pstack:interrogate` for high-risk tickets | Opus (+ Sonnet panel) |
| Milestone audit       | `ponytail-audit` on the whole repo                             | Opus                  |
| Product check         | Nimish                                                         | —                     |

The per-role model lines live in `.claude/rules/pstack-models.md`.

## 3. The loop for one ticket

```
UNDERSTAND  ticket goals (MILESTONES.md) + DATA-MAP.md → pstack `how` over the touched modules
DESIGN      name the data shape first; reuse an existing table or module unless the PR says why it cannot
CODE        ticket worktree + branch → goal tests written first (behaviour, not table names) → smallest code
VERIFY      fast tests on every stop; the ticket's seam tests; drive the real surface for a user-visible change
REVIEW      PR → CI green (lint, typecheck, boundaries, isolation, smoke) + ponytail-review with no blocking
            finding; high-risk tickets (schema, auth, tenancy, data rewrite) also get /pstack:interrogate
MERGE       the agent merges → staging deploys → Nimish previews if user-visible → ledger and HANDOFF updated
EXIT        every goal of the ticket has a passing test on main
```

- **Tests per ticket = the ticket's goals.** Each goal is one test (or a few) at its seam, written first.
- **Comprehensive testing once per milestone:** the full API suite, every browser journey, and `ponytail-audit`.
- **Timebox:** a ticket should reach its PR in about an hour; past two, the orchestrator cuts scope.
- **Stop for a person only** before something irreversible (production deploy, data deletion, an outside
  account) or a product call no experiment can settle. Everything else is a ruling the orchestrator records in
  the ledger (`Ruling: what — why — cost if wrong`) and keeps going.

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
