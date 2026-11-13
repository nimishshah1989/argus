# D23 — Build process: pstack replaces Athena v3

Date: 13 November 2026 · Status: accepted (Nimish) · Supersedes: D18

## Decision

pstack (Lauren Tan's plugin in `cursor/plugins`, installed for Claude Code through `.claude/settings.json`)
runs every build. `CLAUDE.md` holds the loop and the rules; `docs/plan/ORCHESTRATOR.md` holds the ticket loop
and the model table; `.claude/rules/pstack-models.md` pins the model per role. Matt Pocock's `grill-with-docs`,
`to-spec` and `to-tickets` shape new work; `impeccable` designs; Ponytail reviews (`ponytail-review` per PR,
`ponytail-audit` per milestone). The Athena v3 harness, its six agents and its process documents move to
`docs/archive/athena-v3/`. The hooks, CI guards, memory files and backlog stay.

## Why

Athena v3 slowed delivery and repeated the bloat pattern found in the Cornerstone review: rules that made
adding cheap and changing expensive, a plan reviewer and three more Opus reviewers per ticket, and instructions
spread over ten documents. pstack's principles push the other way (subtract before adding, redesign from first
principles, test behaviour not implementation), settle technical forks by experiment instead of asking, and
turn a repeated mistake into a check (`/pstack:correct`).

## Rejected

- Keeping Athena v3 and trimming it: the cost is in its shape, not one rule.
- Ponytail always on while coding: it duplicates pstack's Laziness Protocol; two voices on one diff conflict.
- pstack's default models (Grok for code, Opus xhigh elsewhere): Grok is not available in Claude Code and
  xhigh everywhere costs more than the plan allows.
- Ten live verification lanes per PR (pstack's multi-phase plan): too expensive for one ticket at a time.

Revisit after the first milestone gate run under pstack, on two numbers: tickets merged per week and fix
rounds per ticket.
