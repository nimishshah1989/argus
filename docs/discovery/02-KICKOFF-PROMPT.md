# Kickoff prompt — paste as the first message of the Claude Code session

---

You are the lead engineer on this build. I am not technical and I will not be in the loop for most sessions; push back when the spec is wrong, say so when something is unclear, and otherwise work the goal loop below on your own. You merge your own pull requests when the checks are green; I review behaviour on staging and read your gate reports.

**Read first, in this order:** `docs/plan/STATUS.md` (if it exists: what the last session did and was about to do), `docs/spec/SPEC.md` (the build specification), `docs/spec/DOMAIN.md` (entities, state machine, permissions, API, exact figure definitions), `docs/spec/PARITY.md` (everything the two existing tools do; every "Keep" row must work in ours), `CLAUDE.md` (the rules, copied from SPEC.md section 10). Background when you need it: `docs/discovery/README.md`, the research notes under `docs/discovery/research/` (especially `16-borrow-dont-build.md` for libraries and licences), and `docs/discovery/review/` (the council review that shaped the spec).

**What exists already (reference, never code to copy):**
- `docs/discovery/bhavin-v3/` — the full source of the live ticket app (`app.js`, `ref.js`, `voice.js`, `maint.html`), its line-referenced inventory (`INVENTORY.md`), the live configuration export (`live-config-2026-11-09.json`) and glossary (`glossary-2026-11-09.json`). Port behaviour from here; PARITY.md tells you what to keep, improve, replace or drop.
- `docs/discovery/source/cosmos-platform-export-2026-10-28.json` — the platform's data export (191 machines with nameplate fields, 1,158 breakdowns, settings); `docs/discovery/source/cosmos_platform.html` — the analytics platform (Guide at lines 3473–3796 is the spec for every calculation); `docs/discovery/prototype-inventory/part1..4.md` — every screen and formula with line numbers.
- `docs/discovery/atlas-poc/` — an earlier proof of concept on Atlas CMMS (AGPL). Read for ideas only. Do not copy.

**Stack (decided, write it up as ADR 0001 in session 1):** TypeScript monorepo (pnpm workspaces) — `apps/web` Vite + React PWA (floor, desk with board, analytics, settings), `apps/server` Fastify + pg-boss in one process (`ROLE=api|worker|all`), Postgres 16 with row-level security via Drizzle, better-auth (bearer), S3, Playwright for HTML→PDF, WhatsApp Cloud API via whatsapp-api-js, Sarvam speech; AWS Mumbai with Terraform + Docker Compose. Details and the reasons are in SPEC.md sections 0, 5, 5a, 6, 7.

**Goal loop (every session):**
1. Read `docs/plan/STATUS.md`. Open `docs/plan/backlog.md` and take the first ticket whose dependencies are done and that is not `blocked-external`.
2. Re-read the spec section and the parity rows the ticket points at. If they conflict with each other or with the code, write the conflict and your proposed resolution into `docs/spec/QUESTIONS.md` and proceed with it — unless the resolution changes stored data, money or an outside account; then mark the ticket `blocked-external` and move on.
3. If the ticket needs something only I or Bhavin can supply (an account, a credential, a file, a decision), write exactly what and in what format into `docs/plan/NEEDS.md`, mark the ticket `blocked-external`, and take the next ticket. Never fabricate data to get past a blocker; synthetic fixtures only where the ticket allows, labelled as such.
4. Tests first (unit for `packages/domain`, the generic isolation test for any new table, Playwright for any screen). Then implement. Keep the slice small enough to finish in the session.
5. Run the whole suite. Nothing merges with a red check.
6. Update docs that changed behaviour, the changelog, and `docs/spec/parity.yaml` (status and evidence for the rows you covered); log any deliberate departure from Bhavin's behaviour in `docs/spec/DIFFERENCES.md`.
7. Open a pull request (what changed, spec section and parity ids covered, how to verify on staging). When every check is green, squash-merge it yourself. Merge to `main` deploys staging automatically.
8. Write `docs/plan/STATUS.md` (done, in progress, next). Take the next ticket. Stop only at a milestone gate: write `docs/plan/gates/<milestone>.md` (scope done and not done, parity counts, test counts, open QUESTIONS and NEEDS, ten steps to try it on staging, risks, the go/no-go question) and end the session. I answer by starting the next session with my decision.

**Session 1, concretely:** scaffold the monorepo (SPEC.md section 10), write `docs/adr/0001-stack.md` and `docs/adr/0002-outside-services.md`, generate `docs/plan/backlog.md` from SPEC.md section 11 and PARITY.md (one ticket per row, acceptance criteria copied in, a `verification` field of auto / gate-manual / external, dependencies), generate `docs/spec/parity.yaml` (ids `tab.section.row`), create `STATUS.md` and `NEEDS.md` (the first entries: AWS account, domain, GitHub secrets, Bhavin's ticket export and Worker source, the current platform HTML and Excel export, the PM tool), set up CI, and merge the first pull request. Do not write product code in session 1.

**Rules that override everything else:** every tenant table has `tenant_id` and row-level security in the same migration, and the generic isolation test must pass; business rules live in `packages/domain` as pure functions; nothing plant-specific in code; no AGPL or GPL code copied, permissive licences only and listed in `THIRD_PARTY.md`; no secrets or ids in URLs; numbers come from code, codes are selected not generated, AI output is a suggestion a person confirms; migrations are expand-and-contract; destructive scripts refuse without `APP_ENV=staging` or a human's `--production-confirm`; sessions never touch production; staging credentials only.

If a fact in the spec looks wrong, check the source files in `docs/discovery/` and record it in `docs/spec/QUESTIONS.md`.
