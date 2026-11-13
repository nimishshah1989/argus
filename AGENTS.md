# Instructions for AI coding agents

For agents that read AGENTS.md (Codex, Cursor, OpenCode and others). The rules are the same for every agent:

1. `CLAUDE.md`: this repository's own rules.
2. `.claude/harness/CLAUDE.md`: how work is planned, built, reviewed and merged here (Athena v3).
3. `docs/BUILD-PROTOCOL.md`: the working agreement — roles, slice loop, reviews, cadence, architecture and memory.
4. `docs/LEAN.md`: the anti-bloat ladder, hard budgets and lean review; `docs/QUALITY-BAR.md`: the 9/10 senior scorecard.
5. `docs/DESIGN.md`: for anything a person looks at.
6. `docs/spec/SPEC.md`: the product source of truth; `docs/HANDOFF.md`: where things stand now.

Read 1–4 before changing anything. Where they name Claude-only tools (skills, hooks, agents), follow their intent with the tools you have.

## The build loop

Roles, models and the loop are `.claude/harness/CLAUDE.md` and `docs/plan/ORCHESTRATOR.md`; agents without Claude Code follow their intent.
