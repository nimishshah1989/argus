# CLAUDE.md — this repo runs the loop

Personal rules (honesty, Karpathy, reuse, tokens) live in `~/.claude/CLAUDE.md`. This file is only how work happens here.

## 0. Start of every session

The SessionStart hook has already given you your role, HANDOFF.md, PROJECT.md §1–4, the current milestone and the wireframe approvals. Don't re-read them. State in 2 lines: the goal, and your first step. For code context, `graphify query "<question>"` before opening files.

## 1. Files (the whole memory system)

- `PROJECT.md` — locked blueprint: product, architecture, data model, screens, milestones with yes/no goals.
- `db/schema.sql` (or ORM schema) — the data model as runnable code. `GLOSSARY.md` — domain terms; use them exactly.
- `docs/adr/` — one file per decision and why. GitHub Issues — tickets from `to-tickets`.
- `design/` — `tokens.css` + `DESIGN.md` (global kit, never edited here), `brand.css` (this project's ~20%), `wireframes/`, `approved.json` (Nimish's approvals).
- `HANDOFF.md` — where the last session stopped. Overwritten and committed every session.
- `LESSONS.md` — every failure, the layer it came from, and the durable fix. Corrections live in files, never only in chat.

## 2. How work runs

Every session here is the loop. Nimish asks for something (or types `/loop:run`); the main session (Opus) follows the `loop-run` skill. He's needed only for product questions, `loop approve <screen>`, and escalations.

| Who                         | Model                | Does                                                                                                                          |
| --------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| main session (orchestrator) | Opus                 | PROJECT.md, schema, ADRs, wireframes, tickets, skeletons, visible + hidden tests, merge decisions. Never writes product code. |
| `builder` subagent          | Sonnet               | Builds one ticket in `.loop/wt/<N>/` until its tests pass                                                                     |
| `builder-small` subagent    | Haiku                | Same, for tickets labelled `size:small`                                                                                       |
| `reviewer` subagent         | Opus (fresh context) | PASS/FAIL review of a ticket PR                                                                                               |
| `rescuer` subagent          | Fable                | One last try after 3 failed attempts, then escalate                                                                           |

Build folders have no `tests/holdout/` (hidden tests); CI runs them. Hooks keep each role in its lane.

## 3. Order (fixed)

1. **M0 = data model**: schema, migrations, invariant tests. Nothing else until it's merged.
2. **Wireframes** for a milestone's screens → Nimish approves each with `loop approve <id>`. No frontend code before that; editing a wireframe voids its approval.
3. Each milestone is a vertical slice (API → UI → tests) Nimish can click through.
4. After his approval, `loop-release`: staging → his go → production → live check. Merged isn't done; live is done.

## 4. Building rules

- One ticket = one seed branch `plan/t<N>` (skeleton + tests, by the orchestrator) → one build branch → one PR, opened by `loop finish` with the ticket's `Budget:` and `Screens:` lines. CI fails PRs >20% over budget.
- Never edit or delete a test to make it pass. 3 failed attempts → one Fable rescue → `escalated`, back to plan.
- UI uses design tokens only (`var(--…)` / the Tailwind preset). No raw hex, rgb, or arbitrary `[..px]` values; CI rejects them.
- Spec looks wrong mid-build → stop, write it under "Blocked" in `docs/loop/handoff/<N>.md`. Never quietly build something different.
- Review passes and CI is green → the orchestrator merges and ticks the goal in PROJECT.md.

## 5. Nothing important lives only in chat

- A decision made in conversation becomes an ADR in the same session. A new term goes in GLOSSARY.md. Progress goes in HANDOFF.md. If it isn't in a file, assume the next session won't know it.
- One task per session. At the context budget (default 150k) the hook stops you: write the handoff and end; the next session continues from it.

## 6. Proof, not opinion

Done means outside evidence: tests, CI, a working URL, a traced number. A model reviewing its own work is not a check. Anything you couldn't verify, list it as unverified.

## 7. End of every session

Overwrite HANDOFF.md from its template and commit it. New decisions → ADR. Update issue status. (Hooks won't let you stop with a stale handoff after committing; CI fails a PR without one.)

## Enforcement you can't switch off

Hooks + CI `loop-guard`: no commits to main, no `--no-verify`; protected files and existing tests are plan-only; approvals are Nimish-only; frontend needs approved wireframes; raw styles rejected; PROJECT.md/schema changes need an ADR; every PR leaves a handoff (HANDOFF.md, or `docs/loop/handoff/<N>.md` for ticket PRs). Blocked? Don't look for a way around it — write it down and stop.

## Project specifics

- **Stack:** TypeScript, pnpm 10.30.3 workspace, Node ≥24. `apps/server` Fastify 5 + raw SQL on `pg` + pg-boss jobs; `apps/web` React 19 + Vite, react-router, TanStack Query, ECharts, i18next (English + Gujarati); `packages/domain` (pure rules, analytics engine), `packages/shared` (contracts), `packages/db` (migrations + tenant helper).
- **Commands:** setup `pnpm install --frozen-lockfile` · fast tests `pnpm exec vitest run packages/domain packages/shared apps/web/src tools` · full suite `pnpm test` (needs Docker: Testcontainers Postgres) · e2e `pnpm test:e2e` · `pnpm typecheck` · `pnpm lint` · all repo guards `pnpm precheck`.
- **Folders:** schema truth `packages/db/migrations/*.sql`, applied in order by `pnpm migrate` (there is no `db/schema.sql`); server modules `apps/server/src/modules/<module>/`; v2 screens `apps/web/src/screens/v2/<screen>/{model.ts,View.tsx,fixture.ts}`; kit `apps/web/src/ui/` (tokens `apps/web/src/ui/tokens.css`); repo guards `tools/`; infra `infra/`; product docs `docs/` (spec `docs/spec/SPEC.md`, data `docs/DATA-MAP.md`, design `docs/DESIGN.md` + `docs/design/v2/`).
- **Design system:** the repo's own (`docs/DESIGN.md`, `apps/web/src/ui/tokens.css`, the v2 kit), not the global kit. `pnpm ui:check` enforces kit-only screens.
- **Data rules:** every table has `tenant_id` + row-level security in the same migration; never edit a merged migration (`pnpm migrations:immutable`); a migration that alters or deletes data needs a backup step first; modules talk only through published interfaces (`pnpm boundaries`); no secrets or real personal data anywhere (`pnpm pii:scan`, gitleaks).
- **Screen rules (Nimish, 20 Nov):** a redesign never reduces scope — every v2 screen PR carries a coverage table (`docs/design/v2/COVERAGE.md`), and "not built" needs Nimish's written yes. A v2 screen goes live in the PR that ships it and deletes its v1 page in that same PR.
- **Deploy:** merge to `main` deploys staging (`.github/workflows/deploy.yml`, AWS ap-south-1); health at `https://cosmos.3-108-95-203.sslip.io/api/v1/health`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
