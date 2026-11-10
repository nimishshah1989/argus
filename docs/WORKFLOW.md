# Workflow — one way to work

This resolves the overlap between Athena v3 (`.claude/harness/CLAUDE.md`), the build specification (`docs/spec/SPEC.md`) and the working agreement (`docs/BUILD-PROTOCOL.md`). Where they disagree, this file says which one wins for this repo.

Precedence: **direct instruction → `CLAUDE.md` → `.claude/harness/CLAUDE.md` → this file → `docs/BUILD-PROTOCOL.md` → individual skill defaults.**

## 1. The one loop

1. Take the first unblocked ticket from `docs/plan/backlog.md`.
2. Re-read its spec section and parity rows.
3. Write `docs/slices/<ticket>.md`: files, interfaces, fields, Given/When/Then tests, out of scope.
4. A fresh-context plan reviewer checks it. **R2/R3 tickets always need a plan; R1 tickets may use the ticket + parity row as the plan.** The threshold is in §4.
5. Write the failing test, then the code, then run the whole suite.
6. A fresh-context reviewer checks the diff against the plan, `docs/REVIEW-MECHANISMS.md` and the lean pass in `docs/LEAN.md`.
7. Merge only when CI is green and the reviewer says PASS. `main` deploys staging.
8. Update `parity.yaml`, `CHANGELOG.md`, `docs/HANDOFF.md`, `wiki/log.md`, and any `QUESTIONS.md`/`DIFFERENCES.md` entry.
9. At the milestone gate, write `docs/plan/gates/M<n>.md`, stop, and ask Nimish for go/no-go.

No product code before a plan; no merge before tests and review; no production from a session.

## 2. The single memory system

| Artifact                    | Holds                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `docs/HANDOFF.md`           | Live, in flight, next, blocked. Read first, written last. The only status file.            |
| `docs/plan/backlog.md`      | Every ticket, dependencies, verification, status                                           |
| `docs/plan/NEEDS.md`        | Inputs only Nimish or Bhavin can supply                                                    |
| `docs/plan/gates/M<n>.md`   | Gate evidence and the go/no-go question                                                    |
| `docs/spec/parity.yaml`     | One row per parity feature, with test/PR evidence                                          |
| `docs/spec/QUESTIONS.md`    | Conflicts and the resolution followed                                                      |
| `docs/spec/DIFFERENCES.md`  | Deliberate departures from Bhavin’s behaviour                                              |
| `docs/adr/`                 | Irreversible decisions, with what was rejected                                             |
| `docs/slices/`              | One plan per ticket                                                                        |
| `docs/REVIEW-MECHANISMS.md` | The review ladder, risk tiers and CI gates                                                 |
| `docs/LEAN.md`              | The anti-bloat ladder, hard size/complexity/dependency budgets, lean review and gate audit |
| `docs/QUALITY-BAR.md`       | The 9/10 senior-engineer scorecard used at M1b/M5 and R3 gates                             |
| `docs/ORCHESTRATION.md`     | Goal loop, graph loop, parallel workers                                                    |
| `docs/INFRASTRUCTURE.md`    | AWS-only, low-cost infrastructure                                                          |
| `docs/FRONTEND-STRATEGY.md` | Role-first frontend and design system                                                      |
| `wiki/` + `wiki/log.md`     | Why, not what; append-only session log                                                     |

`docs/plan/STATUS.md` is a short session log, not a second handoff: one line per session, then it points at `HANDOFF`. Do not duplicate state across both.

## 3. Planning: Athena vs SPEC

Athena says every slice has a plan with every file, interface, field and test, and a fresh plan reviewer. SPEC says a session takes a backlog ticket and writes tests. They are compatible if the plan is the **test contract**:

- **R3** (schema, auth, tenancy, money, cutover) and **R2** (domain/API/jobs): full slice plan + plan review. No code until the review passes.
- **R1** (UI only): the ticket + parity row + the screen spec is the plan; a light plan review checks the four states (empty/loading/error/offline) and the role’s task. This avoids a planner tax on every small screen.
- **R0** (docs/copy): no plan; self-check.

The plan-reviewer checklist is in `.claude/agents/plan-reviewer.md`. The “files/interfaces/fields/tests” requirement is not weakened; it is scoped to the risk.

## 4. Decisions: one folder

`docs/adr/` is the only decisions folder. The harness’s `docs/decisions/` is an alias: do not create it. An ADR is one page: context, decision, rejected options, consequences. Use an ADR for an irreversible or expensive-to-reverse choice, a new outside service, a schema change that alters data, or a deviation from the spec.

## 5. Merge authority and review

- The author never reviews their own work.
- The reviewer is a fresh context with the plan, the diff, the CI result and the checklist; it is read-only and returns `PASS` or `FAIL` with numbered findings.
- The agent merges when CI is green and the review passes. The harness’s `code-reviewer` is the gate; a human click is not.
- R3 changes also need the security review (human) before cutover and before plant two.
- A merge to `main` deploys staging. Production is a tagged release after a gate, between 05:00 and 08:00 IST.

## 6. GitHub

- The backlog is the source of truth; GitHub Issues mirror the frontier. Use the label `ready-for-agent` on a ticket an agent may build.
- One ticket per branch and PR. Branch `m0/0.3-schema-rls`; PR title `M0-0.3: schema v1 with RLS`.
- A PR body says what changed for a user, which parity rows and tests prove it, and how to try it on staging.
- Never push to `main`, never force-push, never `--no-verify`. The initial bootstrap commit is the only exception; it is already done.

## 7. Session start and end

**Start:** read `HANDOFF`, the ticket, its spec section, its parity rows, and the ADRs it touches. Open `backlog.md`; take the first unblocked ticket. If it needs an input, write `NEEDS.md`, mark it `blocked-external`, take the next.

**End:** update `HANDOFF` (live/in flight/next/blocked), `parity.yaml`, `CHANGELOG.md`, `wiki/log.md`, and any question/difference. If the context is two-thirds full, stop earlier and write the handoff; the next session must start from the repo alone.

## 7a. Context budget and token discipline

Context is a budget, not a bin. The goal is to leave room for thinking, not to fill the window.

| State  | Trigger                                    | Action                                                                                                      |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Green  | under 50%                                  | Normal work.                                                                                                |
| Yellow | 50–70%                                     | Finish the current step, write the handoff, and start fresh before new work.                                |
| Red    | over 70%, or a slice/milestone is complete | Stop. Write the handoff. No new work in this session.                                                       |
| Never  | 90–99%                                     | Not a plan. Waiting for 99% means compaction at the worst moment, lost detail and a more expensive session. |

A handoff costs a few hundred tokens; a lost context costs a re-read of the repo and a wrong turn. The handoff is `docs/HANDOFF.md` (under 50 lines), `docs/plan/STATUS.md` and `wiki/log.md`; the next session reads only those, the ticket, its spec section, its parity rows and the ADRs it touches.

Do not wait for a UI indicator. If the slice is done, or the conversation has become a long back-and-forth, hand off.

### Token discipline

- Read the named section, not the whole spec. Use `read` with offset/limit and `grep`; never dump a whole file into chat.
- Read `docs/discovery/` only when a fact is needed; it is reference, not a briefing.
- Run the smallest relevant test during the loop; run the full `pnpm verify` once at the end.
- Use a subagent for fresh-context review or genuinely independent work, not for a one-line edit. Close finished agents; do not leave duplicate checks running.
- Prefer `edit` over `write`; do not reformat or rewrite a file that did not change.
- No speculative code, options, abstractions or docs. The smallest complete change wins (`docs/LEAN.md`).
- If a decision is reversible, make it and record it; do not spend tokens asking.
- Keep the final report short: what changed, what is proven, what is next.

## 8. When the spec is wrong

Write the conflict and your proposed resolution in `docs/spec/QUESTIONS.md` and proceed — unless the change alters stored data, money or an outside account; then mark the ticket `blocked-external` and ask Nimish. Never guess silently.

## 9. Product vs technology

Nimish answers product and business questions: what users see, priorities, pricing, policy, consent, the plant’s rules. The agent decides technology: libraries, schema, architecture, test seams, orchestration. A technology question is never put to Nimish; it is decided and recorded in an ADR.

## 10. Definition of ready and done

**Ready:** a parity row or written addition; a named spec section; testable acceptance criteria; dependencies done or waived; external input present or `blocked-external`; the plan at the tier above.

**Done:** tests first and green; isolation test for any new table; strings in i18n; changelog; parity updated; lean pass (no unexplained file/function/dependency breach); reviewer PASS; merged; on staging.
