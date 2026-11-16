# D31 — Third regime: model routing, budgets and quality rails

Date: 16 November 2026 · Status: accepted (Nimish) · Owner: orchestrator · Supersedes: the model table in
D23 for sessions run in DeepSeek Harness; the pstack process, ticket plan, checks and guards stay.

## Decision

Work is split across two model families by _job_, with two hard budgets:

| Job                                                                         | Route                                     | Model                                                                      | Why                                                                         |
| --------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Core development and testing (builder)                                      | Isoquant (`https://api.isoquant.ai/v1`)   | `deepseek-v4.1-flash-1017-fast` (default), `glm-5.3-flash` (second family) | Cheap, fast, tool-calling and prefix caching verified; one writer at a time |
| Goal drafting, plan/slice authoring, final and R3 review, compliance checks | DeepSeek API (`https://api.deepseek.com`) | `deepseek-v4-pro`                                                          | Judgment job with low token volume; stronger reasoning                      |
| Routine PR review, precheck triage, small summaries                         | DeepSeek API or Isoquant                  | `deepseek-flash` (or `glm-5.3-flash`)                                      | Keep the expensive reviewer for decisions that matter                       |
| Second adversarial reviewer for R3 (schema, auth, tenancy, deletes)         | Isoquant                                  | `glm-5.3-flash`                                                            | Different family from both the writer and the Pro reviewer                  |

**Budgets (hard stops):** **USD 5** of hosted-coder credit (Isoquant) and **USD 10** of reasoning credit
(DeepSeek). When either is exhausted the session stops, reports the remaining work and asks for a top-up.
Every session writes one ledger line with spend and remaining. A 429 or a credit error is a stop, not a retry.

**Route gate:** before the first builder packet of a session, dispatch one word to the coder route and require
a response. `list_subagent_models` is an allowlist read, not a route check. The provider registry is built when
the app boots, so a profile change needs a full restart; the session allowlist is captured at session creation.

## Quality rails (reinstated after the 13–14 Nov regime)

1. **The writer never reviews its own work.** A fresh reviewer gets the plan, the diff and the test output —
   never the coder's reasoning — and returns PASS/FAIL with numbered `file:line` findings. Self-review is a
   failed review, even when the change looks right.
2. **Risk tiers.** R0–R1: routine tests/docs/screens — one fresh reviewer. R2: server behaviour — reviewer plus
   the covering suite. R3: schema, auth, permissions, tenancy, deletes, money, cutover — Pro review plus a
   different-family adversarial reviewer who must prove findings by running something; a human signs off before
   production.
3. **Evidence per work unit.** A packet names one acceptance assertion, the write scope, the red command and
   the expected failure, and the green command. The builder reports both outputs. A test that cannot fail, a
   deleted/skipped/weakened test, or a "temporary" bypass is a failed packet.
4. **Work unit vs merge unit.** The ticket is the merge unit (branch, PR, review, merge). The microtask packet is
   the work unit (1 assertion, ≤3 files, ≤150 lines, ≤20k prompt, 3 attempts, 0 open decisions). On the third
   identical failure the packet is wrong: stop and re-plan.
5. **Guards before reviewers.** `pnpm precheck` before every push; the covering suite locally; CI runs once when
   a PR is marked ready. Draft PRs run nothing. A new guard ships with a planted violation that turns its job red.
6. **Merge discipline.** One merge queue; one PR at a time; rebase and rerun any green that predates the current
   `main`. Tests green before review, review PASS before merge, never merge a stale or red run.
7. **Plan first for anything non-trivial.** Slice plan in `docs/slices/<ticket>.md` with named files, interfaces,
   fields and tests; a fresh plan review precedes code. If the plan is silent, the builder stops and returns the
   question to the planner instead of guessing.
8. **Memory.** One ledger line per dispatch, ruling or merge (`docs/plan/ledger.md`); a decision file for
   irreversible choices; the handoff under 50 lines; change fragments under `changes/`.

### Vendored pstack playbooks in DSH

The repo vendors the pstack plugin (D23): 167 playbook/reference files under `.claude/skills/` and two agent
briefs under `.claude/agents/`. DSH does not load Claude plugins, so the machine exposes the useful playbooks as
native DSH skills through thin shims in `~/.agents/skills/`; each shim says "read the real SKILL.md and follow
it", and the source of truth stays in the repo.

Available in the session catalog: `poteto-mode` (build loop), `ponytail-review` (every PR), `ponytail-audit`
(milestone), `interrogate` (R3 adversarial), `architect`, `pstack-how`, `pstack-why`, `correct`, `to-spec`,
`to-tickets`, `impeccable`, `blast-radius`, `domain-modeling`, `pstack-principles`, `recall`, `ketchup`,
`typescript-best-practices`.

Claude-only machinery does not run: the four hooks (`session_start`, `pre_tool`, `post_edit`, `stop`) and slash
commands are followed as intent. The two agent briefs (`poteto-agent`, `comment-sicko`) are pasted into a
subagent prompt. On a machine without the shims, recreate them from `.claude/skills/<name>/SKILL.md`.

## Goal loop (engineering protocol)

One milestone goal at a time, persisted with the DSH goal service (`create_goal`; `update_goal` only on a
human word, or to mark complete/blocked). Objective = the milestone's gate, never "keep coding". Rounds are
capped (`max_goal_rounds`), and the loop is the only path from goal to merged code:

| Step            | What happens                                                                    | Artifact / evidence                        |
| --------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| 1. Goal         | Milestone objective, success criteria, constraints, budget, stop conditions     | Goal + `docs/HANDOFF.md`                   |
| 2. Frontier     | Smallest unblocked ticket from `docs/plan/MILESTONES.md` (blockers merged)      | Ledger dispatch line                       |
| 3. Slice plan   | Files, interfaces, fields, tests, write scope; fresh plan review                | `docs/slices/<ticket>.md` + review verdict |
| 4. Decompose    | Microtask ledger: one assertion each, red command, green command, write scope   | Ledger / packet list                       |
| 5. Execute      | One builder packet at a time; red report, then green; max 3 attempts            | Red output + green output                  |
| 6. Verify       | Covering suite + `pnpm precheck` locally; no skipped/weakened test              | Command output                             |
| 7. Review       | Fresh reviewer: plan + diff + test output only; PASS/FAIL, numbered `file:line` | Review verdict                             |
| 8. Integrate    | One PR, rebase on current main, green covering checks, one merge                | PR URL + CI green                          |
| 9. Record       | Ledger line, changelog fragment, HANDOFF if state changed                       | `docs/plan/ledger.md`, `changes/`          |
| 10. Re-evaluate | Next frontier; or stop at the gate / budget / repeated finding                  | Gate report                                |

**Stop conditions (all of them stop the loop):** the milestone gate is green and the owner says go; either
budget is exhausted; the same finding fails three times (plan defect, re-plan); the plan is silent (return the
question, do not guess); a product decision is needed; an irreversible action (production, deletion, outbound
message) lacks the owner's word.

**Roles:** the orchestrator plans, reviews, keeps the budget and merges; builders only write code to a frozen
packet; R3 changes get a second, different-family reviewer. **No self-review, ever.** **Evidence map:** at the
gate, every success criterion maps to a ticket, a test and a link — a hole means the milestone is not done.

## Skills by phase

The repo's `.claude/skills` pack is Claude-specific; in DSH, use the equivalent available skill with the same
intent (AGENTS.md says this explicitly). Claude-only review skills (`ponytail-review`, `/interrogate`) become
the fresh-reviewer and adversarial-reviewer prompts below.

| Phase                           | Skill (DSH)                                                              | Use                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Product shaping, open questions | `grill-me`, `grill-with-docs`                                            | Interview the owner; settle product decisions, never technical ones |
| Plan → tickets                  | `to-prd`, `to-issues`                                                    | Turn a shaped feature into vertical tickets; update the one plan    |
| Codebase orientation            | `graphify`                                                               | Query/impact before editing; refresh the graph after merged changes |
| Design / frontend               | `ui-ux-pro-max`, `tailwind-design-system`, `vercel-react-best-practices` | Screens from approved mockups, design tokens, performance           |
| Implementation                  | `tdd`                                                                    | Red → green → refactor, one assertion at a time                     |
| Bug diagnosis                   | `diagnose`                                                               | Reproduce → minimise → instrument → fix → regression test           |
| Risky design fork               | `prototype`                                                              | Run the fork instead of asking the owner a technical question       |
| Review (R0–R2)                  | fresh reviewer subagent (no skill)                                       | Plan + diff + test output → PASS/FAIL with `file:line`              |
| Review (R3)                     | fresh reviewer + adversarial reviewer (`diagnose` for proof-by-run)      | Schema/auth/tenancy/deletes/money/cutover                           |
| Multi-worker coordination       | `orchestration`, `handoff`                                               | Supervise builders, compact at 50–70% context                       |

## Priorities (Nimish, 16 November)

- **Frontend-first.** The screens are the visible product and the gap: finish the M1 screens, then the M2 screens.
  Backend work is limited to the fine-tuning those screens need; no new backend features that are not blocking a
  screen.
- **M4 is the advanced turn:** analytics and forecasting screens, then the manufacturing/AI integrations (M6).
  M3 and M5 stay parked.
- **Small team, simple words.** Report to Nimish in plain English: what changed for a user, what he can try, what
  he must decide. He answers product and business questions only; technical forks are settled by running something.

## DSH operational facts (for the next session)

- Profile: `~/.dsh/profiles/desktop/cordis.patch.yml` — providers `isoquant` (models above, 1M context, tool
  calling) and, when configured, `deepseek-api` (base `https://api.deepseek.com`, model `deepseek-v4-pro`).
- Credentials: `~/.dsh/.credentials.yaml`, refs `ISOQUANT_API_KEY` and `DEEPSEEK_API_KEY` (never in the repo or
  in profile `headers`). The credential store hot-reloads; the provider registry does not.
- Dispatch: `subagent` with explicit `provider` and `model`; `spawn_teammate` has no model selector. One builder
  at a time per file area. The planner/reviewer session never writes product code.
- If the Pro route is not configured, use `deepseek-flash` for review and record the gap in the ledger; do not
  silently substitute a different family for a R3 review.
- Instruction files (`CLAUDE.md`, `AGENTS.md`, `docs/LEAN.md`, `docs/TESTING.md`, `docs/HANDOFF.md`,
  `.claude/agents/*`) must not name build processes other than pstack — `tools/check-docs.ts` fails CI. Point
  them at this decision instead of restating model names.

## Rejected

- One model for both jobs: loses the maker–checker separation and puts the expensive model on bulk typing.
- Coder and reviewer from the same family without a second reviewer: same-family self-agreement is not review.
- Raising budgets before the gate: measure spend per merged PR first.
- A second plan document: `docs/plan/MILESTONES.md` stays the one plan.
