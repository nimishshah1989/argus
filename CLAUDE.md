# How work is done here (pstack)

Product spec: `docs/spec/SPEC.md`. Current state: `docs/HANDOFF.md` (read first). The one plan:
`docs/plan/MILESTONES.md` (68 tickets, their goals, blockers and live status). Anti-bloat: `docs/LEAN.md` (400-line file, 60-line function, no
new dependency without an ADR). Quality bar: `docs/QUALITY-BAR.md`. Data model: `docs/DATA-MAP.md`. Design:
`docs/DESIGN.md`. Discovery in `docs/discovery/` is reference only, never code to copy.

## Model routing and budgets

Development and testing run on the hosted coder; goal drafting, planning, final review and compliance run on
the reasoning model. The routes, the one-word route probe, the review tiers and the two hard budgets are fixed
in `docs/decisions/D31-third-regime-routing-and-quality.md`. Never switch a model silently, never exceed a
budget stop, and never let the writer review its own work.

## Who decides

- Nimish answers product and business questions only, and tests previews. Never ask him a technology question.
  Settle a technical fork by running something (pstack's Prototype playbook), then report the choice.
- Report to him in plain English: what changed for a user, what he can try, what you need him to decide.

## The loop

1. **Shape** (new feature or open product question): `grill-with-docs`, product questions only, then
   `to-spec` and `to-tickets`. The existing backlog in `docs/plan/MILESTONES.md` is already shaped.
2. **Build** one ticket: `/poteto-mode` with the ticket. It runs the Feature, Bug fix or Refactoring
   playbook: understand (`how`), design from the data shape (`architect`), delegate code, verify on the real
   surface, small ordered commits.
3. **Review** the PR: `ponytail-review` on the diff, plus `/interrogate` when the ticket touches the
   schema, auth or permissions, tenancy, or deletes or rewrites data. CI green + no blocking finding: merge.
4. **Gate** each milestone: one short gate report (under 30 lines), then Nimish's go. CI already runs the full
   suite on every PR; run `ponytail-audit` only when the milestone changed schema, auth or tenancy widely.

## Rules that are not negotiable

- Read `docs/DATA-MAP.md` before any design. A new table or module must say in the PR why an existing one does
  not fit. Reusing or changing a shared table is normal work, not scope creep. The table budget is D17.
- Tests check behaviour a user or caller can observe, never table or column names.
- Never delete, skip or weaken a test to go green. A bug gets a failing test first, then a root-cause fix.
- Modules talk only through their published interfaces (`pnpm boundaries`).
- No secrets and no real personal data anywhere: code, tests, fixtures, screenshots, logs.
- A migration that alters or deletes existing data needs a backup step run before it.
- One build at a time per file area; at most five builders in parallel (two orchestrator lanes), each in its own worktree.
- Pause for a person before anything irreversible: production deploys, data deletion, messages to customers.
- When you catch an agent repeating a mistake, run `/correct` so a check blocks it next time.

## Orchestrating the plan

- **Frontier:** a ticket is ready when every ticket it is "Blocked by" is merged to `main`. Work the frontier;
  at most three tickets at once, each in its own worktree, branch and PR, with write areas that do not overlap.
  Schema-changing tickets run one at a time. Merges go one at a time: CI green, then merge.
- **Parallel agents** do not message each other. They share the frozen interfaces in each slice plan
  (`docs/slices/<issue>.md`), `main`, and the ledger (`docs/plan/ledger.md`, one line per dispatch, ruling or merge).
- **Two lanes (Nimish, 14 Nov):** a frontend orchestrator (apps/web, infra, staging, MILESTONES, HANDOFF) with up
  to three builders and a backend orchestrator (apps/server, packages, scripts) with up to two. One migration in
  flight across both lanes: the backend lane asks the frontend lane for the lock. Backend work may run ahead of the
  milestone gates on configurable defaults. Screens are built only from mockups Nimish approved (`docs/design/LOCK.md`).
- **Gate:** when a milestone's tickets are merged, write `docs/plan/gates/<M>.md` (under 30 lines: goals met, the
  evidence links, what Nimish checks), then stop for his go.
- **Timebox:** a ticket reaches its PR in about an hour; past two, cut scope. Record every ruling in the ledger
  (`Ruling: what, why, cost if wrong`).
- **Resume:** read `docs/HANDOFF.md`, the ledger and `docs/plan/MILESTONES.md`; never re-dispatch a ticket the
  tracker marks done. Start an orchestrator with: "Orchestrate `docs/plan/MILESTONES.md` per `CLAUDE.md`."

## Git

Work on a branch. Never push to main, never force-push, never `--no-verify`. One ticket per PR, with one
`changes/<issue>-<slug>.md` fragment. The PR body says what changed for a user, which tests prove it, and how
to try the preview. Run `pnpm precheck` before every push.

## Memory

- `docs/HANDOFF.md`: where things stand, under 50 lines. Rewrite it when the state changes.
- `wiki/`: one page per topic the code cannot say for itself; `wiki/log.md` is append-only.
- Decisions: `docs/decisions/`, one short file each, with what was rejected and why.
- `/recall` to pick up a session; `/ketchup` to catch Nimish up.

## Hooks (`.claude/harness/hooks/`)

Session start loads the handoff. Before a tool runs, secrets, pushes to main, force-pushes, `--no-verify` and
test deletion are blocked. Edits are formatted. Stop runs the fast tests when source files changed.
