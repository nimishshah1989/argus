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
