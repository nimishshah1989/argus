# Instructions for AI coding agents

For agents that read AGENTS.md (Codex, Cursor, OpenCode and others). The rules are the same for every agent:

1. `CLAUDE.md`: this repository's own rules.
2. `.claude/harness/CLAUDE.md`: how work is planned, built, reviewed and merged here (Athena v3).
3. `docs/BUILD-PROTOCOL.md`: the working agreement — roles, slice loop, reviews, cadence, architecture and memory.
4. `docs/LEAN.md`: the anti-bloat ladder, hard budgets and lean review; `docs/QUALITY-BAR.md`: the 9/10 senior scorecard.
5. `docs/DESIGN.md`: for anything a person looks at.
6. `docs/spec/SPEC.md`: the product source of truth; `docs/HANDOFF.md`: where things stand now.

Read 1–4 before changing anything. Where they name Claude-only tools (skills, hooks, agents), follow their intent with the tools you have.

## Model routing and the build loop

The build is a DeepSeek-Flash planner/reviewer directing a hosted free coder. The routing contract is `docs/orchestration.yaml`; the loop and microtask rules are `docs/ORCHESTRATION.md` §10. These rules are not optional:

- **DeepSeek Flash plans, decomposes, reviews and integrates. It does not write product code, tests or bug fixes.**
- **Product code, tests and bug fixes run on the hosted coder route** (`openrouter/nvidia/nemotron-3-ultra-550b-a55b:free`, free tier) through a fresh `subagent` child with an explicit `provider` and `model`. `spawn_teammate` cannot select a model, so it is not the coding route. Local TwIL (`ollama/twil-coder:24k`) is a development-only fallback, never a shipping coder.
- Probe the route before the first dispatch of a session: one 1-word request to `openrouter/cohere/north-mini-code:free` (~2 s). `list_subagent_models` is not a route check — it reads the allowlist and false-positives on a stale harness. If the probe fails, fix the credential record or start a new session; do not silently fall back to DeepSeek for code.
- One coder packet: one acceptance assertion, at most 3 files / 150 changed lines, a named red test and green command, no open design decision, and any cross-test isolation the suite needs. If the slice plan is silent, stop and return the question to the planner.
- Tests must be green before DeepSeek review. Review is a fresh context that gets the plan, the diff and the test output, never the coder's reasoning. PASS or FAIL with numbered file:line findings.
- One coder at a time; one merge queue. Parallelism only across disjoint tickets after contracts are frozen.
- A milestone is a persisted goal (`/goal` or `create_goal`), not an open-ended chat. Stop at the gate, at the budget hard stop, or after three repeated attempts on the same finding.
