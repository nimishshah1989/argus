# Execution graph — current frontier

Updated 11 November 2026. This is the repo mirror of the live Agent Teams task board. The board owns
live ownership/status; this file preserves the graph, contracts and merge order across sessions.
The milestone goal is the DSH persisted goal `goal-37931532-6766-42d9-8777-937493a3ac39`.

## Goal loop

1. Finish the M1b importer safely and merge it through review + green CI.
2. Establish one coherent design language and reusable component foundation.
3. Let Nimish review clickable Floor and Desk prototypes before production frontend rebuilding.
4. Rebuild Floor and Desk from the approved system, then resume the actionable M1b frontier.
5. Stop at the M1b gate; begin M2 only after the required product-owner go decision.

The loop is objective → ready task → child execution → evidence → independent review → integration
→ recorded memory → re-evaluation. A red test/review returns to its owning task, not to the start.

## Current DAG

```mermaid
flowchart TD
  P[task-5 Approve importer correction plan] --> I[task-1 Correct importer]
  I --> M[task-6 Review + merge importer]

  A[task-2 D0.1 audit + role journeys] --> S[task-3 D0.2 design-system foundation]
  S --> R[task-3a Freeze component contracts]
  R --> FP[Floor prototype child]
  R --> DP[Desk prototype child]
  FP --> D[task-4 Integrate D0.3 prototypes]
  DP --> D
  D --> G{task-7 Nimish design alignment}
  G --> F[task-8 Rebuild production Floor]
  G --> K[task-9 Rebuild production Desk]
```

The two roots run in parallel. Floor and Desk production work remains blocked until the gate. Their
implementation may later fan out, but PRs still enter the merge queue one at a time.

## Ownership and write contracts

| Node               | Owner                           | Exclusive write scope                                                            |
| ------------------ | ------------------------------- | -------------------------------------------------------------------------------- |
| task-5             | lead + fresh planner child      | `docs/slices/M1b-import.md`                                                      |
| task-1             | importer implementation child   | `apps/server/src/import/`, `apps/server/test/import.test.ts`                     |
| task-6             | lead + fresh reviewers          | memory files listed on task-6; reviewers are read-only                           |
| task-2             | lead + fresh design-audit child | `docs/design/`, `docs/slices/D0-design-foundation.md`                            |
| task-3             | design-system child             | `apps/web/src/design-system/`, `apps/web/src/style.css`, `docs/DESIGN-SYSTEM.md` |
| task-4 floor child | floor-prototype child           | floor-only prototype and E2E files assigned at contract freeze                   |
| task-4 desk child  | desk-prototype child            | desk-only prototype and E2E files assigned at contract freeze                    |
| task-4 integration | lead                            | prototype shell/routes/shared fixtures and final integration                     |
| task-7             | Nimish (product gate)           | approval recorded in `docs/design/ALIGNMENT.md`                                  |
| task-8             | Floor implementation child      | Floor screens + Floor E2E only                                                   |
| task-9             | Desk implementation child       | Desk screens + Desk E2E only                                                     |

Shared package manifests, lockfiles, i18n catalogues, schema/migrations and prototype shared files
are lead-owned during each integration window. A child stops rather than editing outside its scope.
Every implementation task has its own branch/worktree and a fresh read-only reviewer.

## Merge queue

1. Importer correction plan is documentation within the existing importer branch.
2. task-1 + task-6: importer PR; merge only after fresh PASS and green CI.
3. task-2: D0.1 audit/role-journeys PR.
4. task-3: D0.2 tokens/components PR with rendered evidence.
5. task-4: one integrated D0.3 clickable-prototype PR.
6. task-7: explicit design-alignment decision; not a code merge.
7. task-8/task-9: separate production vertical-slice PRs, sequenced after their parallel build work.

Only one PR merges at a time. Rebase the next branch on the new `main` and rerun its required checks.
No batch merge, direct-to-main push, production deploy, or gate bypass.

## Memory and navigation

- `docs/HANDOFF.md`: current live/in-flight/next state, under 50 lines.
- `docs/plan/backlog.md`: milestone ticket dependencies and external blockers.
- `docs/plan/EXECUTION.md`: this active execution graph and child contracts.
- `docs/slices/`: deterministic file/interface/test contracts for each slice.
- `docs/spec/parity.yaml`: product parity evidence.
- `docs/adr/` and `docs/decisions/`: irreversible choices and rejected alternatives.
- `wiki/`: why that the code cannot express; `wiki/log.md` is append-only.
- DSH goal + Agent Teams board: live automatic continuation, owners, blockers and completion.

Obsidian/Graphify were not installed on 11 November 2026: no identified official bundle was
available, a second notes store would drift from the repo, and a code-visualisation graph would not
execute this build DAG. Reconsider a concrete navigation or viewing tool separately from execution.

## Orchestrator cadence

After every child report or task transition: inspect evidence, update the board, integrate only green
reviewed work, refresh this map when the graph changes, and update handoff/log at session end. Never
claim a milestone from activity; only its written gate and required human answer close it.
