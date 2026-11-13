# 01 — Green, fast main

Issue: [#76](https://github.com/nimishshah1989/argus/issues/76) · Milestone M0 · Blocked by: none · Branch
`claude/t01-green-fast-main` (base `eb80a47`). One PR, labels `size:large` and `no-parity`, one commit series per
goal. The PR body must contain `Closes #76`.

## 1. Goal

Every PR gets a quick, honest answer. The SLA timer no longer jumps between time zones. Browser tests no
longer collide. CI runs in parallel shards of under 8 minutes each. CI also fails when an instruction file
describes another process, when a stack document names Drizzle, or when a real Cosmos name or phone number
gets into the repo.

## 2. Decisions (technical; each is a ruling the orchestrator records)

1. **Time-zone bug.** `SlaTimerSummary` formats the `Due` and `Stopped at` times with `config?.timeZone`. That
   value is `undefined` until `/api/v1/config` answers, so the times render in the browser zone and then
   jump. Fix: render neither time until `timeZone` is known. `TicketCard` renders the compact summary, which
   never shows times.
2. **Serial-retry collision.** The first SLA test raises a ticket on `MACHINES[8]`/`[9]` without cancelling,
   so a retry or a repeat gets 409. Fix: use the existing `prepareStoppedTicket`, which cancels first. The
   offline test snapshots the timers before config loads. Fix: wait for the `<time>` element first.
3. **One seeded tenant per Playwright worker, with no new table.** This is required by the goal.
   - The server already takes the tenant from the `Host` label before the first dot (`apps/server/src/tenant.ts`).
   - Each worker process seeds `e2e-w<TEST_WORKER_INDEX>` into the run's one Testcontainer. Its ids are the
     fixture ids with the first 8 hex digits replaced by `(0x20000000 + workerIndex)`.
   - The browser opens `http://e2e-w<n>.localhost:3000`. Measured: Chromium resolves it to the 127.0.0.1-bound
     server and keeps the Host header, and Vite 8.3.7 allows `*.localhost` by default. So no config flag is
     needed for either.
   - Node's `fetch` drops a `Host` override (measured), so helper API calls use one `node:http` helper, `apiFetch`.
   - A worker restarted after a failure gets a new index, so it starts on a fresh tenant.
   - The stack's IP-host default becomes the non-existent `e2e-unscoped`. A spec that forgets the per-worker
     `test` fails with 404 "Unknown company"; it cannot share state unnoticed.
4. **CI shape.** Today one job takes about 6.5 min (vitest 3m42s, Playwright 1m52s; run 43379580801). The new
   jobs are `static`, `api` (3 vitest shards), `browser` (2 Playwright shards) and the unchanged `secrets`, each
   with `timeout-minutes: 8`. CI itself therefore enforces "each shard under 8 minutes". There is no branch
   protection on this repo (the API answers 403).
5. **"Touched-module API tests" and "browser smoke".** Modules arrive in tickets 02 and 03, staging in 13.
   Until then the `api` shards run the whole vitest suite: a superset of any module and of
   `packages/db/test/isolation.test.ts`. The `browser` shards run the whole Playwright suite: a superset of a
   smoke. Both fit the 8-minute budget.
6. **"Another process" means the DeepSeek-Harness route (DSH) with the hosted free coder** (BRIEF scope 1,
   ROADMAP H1; Q3 confirmed by the orchestrator). Markers: `DeepSeek`, `OpenRouter`, `nemotron`, `TwIL`,
   `ollama`, `free coder` (case-insensitive) and `DSH` (case-sensitive). `.claude/harness/` is read by the
   check but never edited; it is already clean.
7. **The parity rule goes into the existing `tools/parity.ts`** (run by `pnpm parity`). Today all 34
   `in-progress` rows carry evidence. `parity.yaml` and `tools/sync-parity.ts` are not touched.
8. **Drizzle.** D02 says ADR 0001, SPEC and `THIRD_PARTY.md` "are corrected"; they are not. This slice
   corrects them. `tools/check-deps.ts` only checks that installed dependencies are listed, and Drizzle is not
   installed, so deleting its row is safe.
9. **PII deny-list derived at run time from the tracked source files**
   (`docs/discovery/real-2026-11-13/`: in git, about 3 MB).
   - Names come from named fields. Phones are every phone-shaped value anywhere in the three files (Q2 ruling;
     no real phone list exists).
   - No real value is ever written to code, tests, fixtures or logs. Errors give the file, line and kind,
     never the value.
   - Measured with the exact rules below: 60 names, 1 phone-shaped value, 492 files scanned, 0 hits, 160 ms.

**Cuts from the first draft (LEAN).**

- Dropped:
  - the `parity.yaml` header and `sync-parity.ts` edits (the PR takes `no-parity` instead);
  - the ticket-format rule;
  - the zip parser (the frozen workbook stores its sheets uncompressed, so the sheet XML is read straight
    from the file text, with a loud guard);
  - the JSON phone-key walk (replaced by one phone regex over the raw source text);
  - Vite `allowedHosts` and the Chromium resolver flag (both measured unnecessary);
  - `changes/README.md` (the CHANGELOG note documents the format);
  - the ledger edit (ruling);
  - the temporary CI job (Docker is now local).
- Tests: 28 → 21.

## 3. Files

### Browser goal

| File                                                                           | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/SlaTimerSummary.tsx`                                  | In `TimerDetails`, prefix both the `timer?.dueAt && timer.state !== 'stopped'` condition and the `timer?.stoppedAt` condition with `timeZone &&`. Nothing else changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/web/e2e/sla-timers.spec.ts`                                              | Add T1. In "configures policies…", delete line 48 (`const token = …`) and replace line 49 with `const ticket = await prepareStoppedTicket(machine, await apiLogin('admin'));`. In "freezes cached Settings…", before `const before = …`, add `await expect(timerRow(timers, 'Acknowledge').locator('time')).toBeVisible();`. Line 145: `fetch(\`${API_URL}/api/v1/settings/sla-policies\`, …)`becomes`apiFetch('/api/v1/settings/sla-policies', …)`. Imports: see the import table below.                                                                                                                                                                           |
| `apps/web/e2e/sla-test-helpers.ts`                                             | `apiJson`: `fetch(\`${API_URL}${path}\`, {…})`becomes`apiFetch(path, {…})`, and the `init`parameter type becomes`ApiInit`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/web/e2e/fixtures.ts`                                                     | Add `WORKER`, `scopedId`, `TENANT_WEB_URL`, `API_HOST`, `ApiInit` and `apiFetch` (§4). `TENANT.id`, `SEGMENT.id`, every `MACHINES[].id`, every `PEOPLE[].id`, every `LOGINS[].id` and the shift id `…015` are wrapped in `scopedId('<same literal>')`. `TENANT.slug` becomes `` `e2e-w${WORKER}` ``. The private `apiJson` calls `apiFetch(path, init)` with `init: ApiInit`. `API_URL` and `WEB_URL` stay as they are: they are the stack's own origins, used by `stack.ts`. Update the header comment: "ids are scoped per Playwright worker".                                                                                                                    |
| `apps/web/e2e/test.ts` (new)                                                   | Exports `test` (worker-scoped auto fixture `workerTenant`, plus a `baseURL` override) and `expect` (§4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `apps/web/e2e/tenant.spec.ts` (new)                                            | T5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/web/e2e/stack.ts`                                                        | In `startDatabase`, delete the `seedStatements` loop. After the `ALTER ROLE` line, add `process.env.E2E_ADMIN_DATABASE_URL = container.getConnectionUri();` and `process.env.E2E_PASSWORD_HASH = await hashPassword();` (the existing `const passwordHash` line goes). `startApi` passes `DEFAULT_TENANT_SLUG: 'e2e-unscoped'`. Remove `seedStatements` and `TENANT` from the `./fixtures.js` import. Doc comment lines 20–21 become exactly: ` * Boots the real stack for the e2e run: a postgres:16-alpine Testcontainer, migrated (each Playwright` and ` * worker seeds its own tenant in test.ts), the Fastify API on :3001 and the Vite dev server on :3000.` |
| `playwright.config.ts`                                                         | Header comment only: "each worker's tenant comes from its host `e2e-w<n>.localhost` (apps/web/e2e/test.ts); the IP base URL maps to no tenant."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web/e2e/vite.e2e.config.ts`                                              | Comment only. Line 10 (`* every sign-in 404s; "127.0.0.1:3001" maps to DEFAULT_TENANT_SLUG (cosmos) in tenant.ts.`) becomes ` * every sign-in 404s. IP hosts map to e2e-unscoped; each worker seeds e2e-w<n> (test.ts) and browses e2e-w<n>.localhost.` No config change.                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/web/e2e/{admin,board,desk,floor,offline,settings-severity,tags}.spec.ts` | Imports exactly as in the table below. Every `fetch(\`${API_URL}<path>\`, init)`becomes`apiFetch('<path>', init)`; `admin.spec.ts` `apiJson`takes`init: ApiInit = {}`. `desk.spec.ts:39`uses`browser.newContext({ baseURL: TENANT_WEB_URL })`. In `offline.spec.ts`, line 14 becomes `const ASHA_PERSON_ID = scopedId('10000000-0000-0000-0000-000000000009');`, and the comment at lines 9–11 drops "and fixtures.ts is not in this slice's write scope". No assertion changes.                                                                                                                                                                                    |
| `.github/workflows/ci.yml`                                                     | Replace the `checks` job with `static`, `api` and `browser` (§4). `secrets` is unchanged.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

Import lines after the change (exactly these; all other imports unchanged):

| File                        | Imports                                                                                                                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin.spec.ts`             | `import { expect, test } from './test.js';` · `import { apiFetch, apiLogin, signIn, type ApiInit } from './fixtures.js';`                                                                                                                                            |
| `board.spec.ts`             | `import type { Page } from '@playwright/test';` · `import { expect, test } from './test.js';` · `import { MACHINES, apiFetch, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';`                                                                           |
| `desk.spec.ts`              | `import type { Browser, Page } from '@playwright/test';` · `import { expect, test } from './test.js';` · `import { TENANT_WEB_URL, apiLogin, machineFor, raiseTicketViaApi, signIn } from './fixtures.js';`                                                          |
| `floor.spec.ts`             | `import { expect, test } from './test.js';` · `import { machineFor, signIn } from './fixtures.js';`                                                                                                                                                                  |
| `offline.spec.ts`           | `import type { Page } from '@playwright/test';` · `import { expect, test } from './test.js';` · `import { apiFetch, apiLogin, scopedId, signIn } from './fixtures.js';`                                                                                              |
| `settings-severity.spec.ts` | `import type { Locator, Page, Response } from '@playwright/test';` · `import { expect, test } from './test.js';` · `import { MACHINES, apiFetch, apiLogin, signIn } from './fixtures.js';`                                                                           |
| `sla-timers.spec.ts`        | `import { expect, test } from './test.js';` · `import { MACHINES, apiFetch, apiLogin, signIn } from './fixtures.js';` (the helpers import also gains nothing: `prepareStoppedTicket`, `raiseWorkRequest`, `ensureSlaConfiguration`, `timerRow` are already imported) |
| `tags.spec.ts`              | `import type { Page } from '@playwright/test';` · `import { expect, test } from './test.js';` · `import { apiFetch, apiLogin, raiseTicketViaApi, signIn } from './fixtures.js';`                                                                                     |
| `sla-test-helpers.ts`       | line 3: `import { apiFetch, apiLogin, raiseTicketViaApi, type ApiInit, type MachineFixture } from './fixtures.js';` (line 2 unchanged)                                                                                                                               |
| `tenant.spec.ts`            | `import { expect, test } from './test.js';` · `import { API_URL, E2E_PASSWORD, TENANT, apiLogin } from './fixtures.js';`                                                                                                                                             |

### Process goal 2

| File                                      | Change                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/check-docs.ts` (new)               | The process check and the Drizzle check (§4).                                                                                                                                                                                                                                                                         |
| `tools/docs.test.ts` (new)                | T8–T10.                                                                                                                                                                                                                                                                                                               |
| `tools/parity.ts`                         | `ParityRow.ticket?: string`. One new rule in `evidenceErrors` (§4).                                                                                                                                                                                                                                                   |
| `tools/parity.test.ts`                    | T11–T12.                                                                                                                                                                                                                                                                                                              |
| `docs/adr/0001-stack.md`                  | Line 18 becomes `\| Database \| PostgreSQL 16+ on RDS; raw SQL through \`pg\` (D02); SQL migrations with RLS \|` (prettier realigns the table).                                                                                                                                                                       |
| `docs/spec/SPEC.md`                       | Replace these whole lines (see §3a).                                                                                                                                                                                                                                                                                  |
| `THIRD_PARTY.md`                          | Delete the `\| Drizzle ORM …` row (line 17).                                                                                                                                                                                                                                                                          |
| `CLAUDE.md` (repo)                        | Line 5 becomes: ``Execution routing: `docs/plan/ORCHESTRATOR.md` (the Athena v3 model table in `.claude/harness/CLAUDE.md`).``                                                                                                                                                                                        |
| `AGENTS.md`                               | Replace lines 14–24 (from `## Model routing and the build loop` to the end of the file) with `## The build loop`, a blank line, and: ``Roles, models and the loop are `.claude/harness/CLAUDE.md` and `docs/plan/ORCHESTRATOR.md`; agents without Claude Code follow their intent.``                                  |
| `docs/ORCHESTRATION.md`                   | Edits listed in §3b.                                                                                                                                                                                                                                                                                                  |
| `docs/BUILD-PROTOCOL.md`                  | Edits listed in §3b.                                                                                                                                                                                                                                                                                                  |
| `docs/SKILLS.md`                          | Edits listed in §3b.                                                                                                                                                                                                                                                                                                  |
| `docs/REVIEW-MECHANISMS.md`               | Line 113 becomes: `- The coder (Sonnet) and the reviewers (Opus, fresh context) are different models, so a fresh context is a real independence boundary. It is still not a senior human: fixed checklists, file:line evidence, the risk tiers, static analysis and a human security review remain mandatory for R3.` |
| `docs/WORKFLOW.md`                        | Delete line 38 (the `docs/orchestration.yaml` table row).                                                                                                                                                                                                                                                             |
| `docs/HANDOFF.md`                         | Rewrite in task 15 (§6).                                                                                                                                                                                                                                                                                              |
| `docs/decisions/D18-one-process.md` (new) | In D02's shape (§3c).                                                                                                                                                                                                                                                                                                 |
| `docs/orchestration.yaml`                 | Delete.                                                                                                                                                                                                                                                                                                               |
| `tools/check-orchestration.ts`            | Delete.                                                                                                                                                                                                                                                                                                               |
| `tools/check-changelog.ts` (new)          | The fragment check (§4).                                                                                                                                                                                                                                                                                              |
| `tools/changelog.test.ts` (new)           | T13.                                                                                                                                                                                                                                                                                                                  |
| `changes/76-green-fast-main.md` (new)     | This PR's fragment (task 15).                                                                                                                                                                                                                                                                                         |
| `CHANGELOG.md`                            | After line 4, add a blank line, then: ``From #76 on, each PR adds one fragment `changes/<issue>-<slug>.md` (1–5 bullet lines in this file's style) and does not edit this file; fragments are folded in here at a release.``                                                                                          |
| `.gitattributes` (new)                    | One line: `wiki/log.md merge=union`                                                                                                                                                                                                                                                                                   |
| `tools/union-merge.test.ts` (new)         | T14.                                                                                                                                                                                                                                                                                                                  |
| `package.json`                            | Add scripts `"docs:check": "tsx tools/check-docs.ts"`, `"pii:scan": "tsx tools/check-pii.ts"` and `"changelog:check": "tsx tools/check-changelog.ts"`. Delete `"orchestration:check"`. In `verify`, replace `pnpm orchestration:check` with `pnpm docs:check && pnpm pii:scan`.                                       |

**§3a SPEC.md: whole replacement lines**

- 158: ``| `packages/db` | SQL migrations with RLS policies, raw SQL on `pg` (D02), seed and import scripts, isolation test | node-postgres (`pg`) | Every table has `tenant_id`; policies in the same migration as the table |``
- 164: `**Verify before relying on:** library names here are ones I am confident exist (Vite, React, Fastify, pg-boss, our sessions (ADR 0003), Zod, ECharts, web-push, vite-plugin-pwa); the Claude Code session must still check current versions and APIs in the official docs rather than from memory.`
- 174: `| Escalation | GoAlert's model (Apache-2.0): policy, steps, delay, repeat, re-implemented in SQL | Keep's YAML workflow pattern | Data model |`
- 176: ``| Multi-tenancy | Postgres RLS with `set_config('app.tenant_id', ..., true)` inside our `withTenant` transaction wrapper (`packages/db/src/tenant.ts`); policies in plain SQL in the migrations | Tenant-id discipline without RLS (not recommended) | Code |``
- 190: ``| Admin UI and forms | shadcn/ui, react-hook-form, Zod; AutoForm for master-data screens | react-admin `ra-core` (MIT) | Libraries |``
- 205: ``| Database | Postgres 16 (RDS), raw SQL on `pg` (D02), SQL migrations in `packages/db`, policies written in plain SQL | RLS policies live next to the tables |``
- 305: `  packages/db         SQL migrations with RLS, seeds, import scripts, isolation test`

**§3b Instruction files: exact edits.** When done, `pnpm docs:check` exits 0.

`docs/ORCHESTRATION.md`:

- Delete §10, from the line `## 10. Model routing: DeepSeek plans…` through the line before `## 11.`.
- Renumber `## 11.` to `## 10.`.
- Line 28: delete `, and in DSH as a persisted goal when the milestone starts`.
- Delete the block from `**DSH tools it uses:**` (line 120) through the table row starting `` | `web_fetch` `` (line 131), and the blank line after it.
- Line 185: ``alongside DSH’s `workflow`/`subagent` and the repo’s backlog`` becomes `alongside Claude Code subagents and the repo’s tickets`.

`docs/BUILD-PROTOCOL.md`:

- Delete lines 272–279 (`### DeepSeek Harness specifics` and its five bullets) and the blank line after them.
- Line 284: delete the two sentences `DSH also has its own native skills with overlapping intent. I use the native one when it matches, and read the repo’s pinned `SKILL.md` when it does not.`
- Header line 286: `Source / DSH use` becomes `Source`.
- Last cell on lines 289, 290, 293, 294: `both` becomes `Repo`.
- Line 291: `Repo agents; emulated with fresh-context subagents` becomes `Repo agents`.
- Line 292: `Repo agents; emulated` becomes `Repo agents`.
- Line 295: `Repo + native design skills` becomes `Repo`.
- Delete line 297 (the `handoff` / `native` row) and line 298 (the `improve-codebase-architecture` / `later` row).
- Prettier realigns the table.

`docs/SKILLS.md`:

- Line 3: delete the sentence `DeepSeek Harness has native skills with the same intent; use the native one when it exists, read the pinned `SKILL.md` when it does not.`
- Line 5: delete `In DSH the pins and hooks do not apply; follow the **intent**, not the frontmatter.`
- Delete table rows 22 (`Design system`), 23 (`Prototype`), 24 (`Memory`) and 26 (`Audit`).
- Line 30: `In DSH it is not a native skill, so the lead applies it manually and the code-reviewer checks it.` becomes `The code-reviewer checks it.`
- Delete the bullets at lines 53 (`- DSH native: …`) and 54 (``- The repo’s `office-hours` …``).
- Replace the §5 paragraph (line 58) with: `` `model:` pins in `.claude/agents/` and the hooks in `.claude/harness/hooks/` apply as written (Athena v3); R3 still adds a human reviewer. ``

**§3c `docs/decisions/D18-one-process.md`**

- Title: `# D18 — One build process: Athena v3`
- Byline: `Date: 13 November 2026 · Status: accepted (orchestrator, ticket 01)`
- **Decision:** Athena v3 (`.claude/harness/CLAUDE.md`, `docs/plan/ORCHESTRATOR.md`) is the only build process. The DeepSeek-Harness routing with the hosted free coder (PR #73) is retired. `docs/orchestration.yaml` and `tools/check-orchestration.ts` are deleted. `tools/check-docs.ts` fails CI if an instruction file names that route again.
- **Why:** BRIEF scope 1 ("one process (Athena v3)") and ROADMAP finding 5 (two contradictory harnesses; the last stretch went into model routing, not product).
- **Rejected:**
  - Keeping both routes: agents follow whichever file they read first.
  - Keeping `orchestration.yaml` as a record: git history keeps it.
  - A softer check that only warns: the drift returned within days.
- **Revisit:** only through a new decision and a harness change.

### Process goal 3

| File                         | Change                     |
| ---------------------------- | -------------------------- |
| `tools/pii-sources.ts` (new) | Builds the deny-list (§4). |
| `tools/check-pii.ts` (new)   | Scan plus CLI (§4).        |
| `tools/pii.test.ts` (new)    | T15–T21.                   |

### Bookkeeping (same PR)

- `docs/plan/MILESTONES.md`: row 01 becomes `done` with PR `#<n>`.
- `wiki/log.md`: append one line.
- `changes/76-green-fast-main.md`.
- §8 Evidence in this plan.
- Not `docs/plan/ledger.md` (ruling).

## 4. Interfaces

```ts
// apps/web/e2e/fixtures.ts
export const WORKER: number; // Number(process.env.TEST_WORKER_INDEX ?? '0')
export function scopedId(base: string): string; // (0x20000000 + WORKER).toString(16) + base.slice(8)
export const TENANT: { id: string; slug: string; name: 'Cosmos' }; // slug `e2e-w${WORKER}`
export const TENANT_WEB_URL: string; // `http://${TENANT.slug}.localhost:${WEB_PORT}`
export const API_HOST: string; // `${TENANT.slug}.localhost`
export interface ApiInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}
/** node:http request to new URL(path, API_URL) with headers {...init.headers, host: API_HOST}; resolves
 *  new Response(status 204/304 ? null : body, { status, headers: { 'content-type': <reply content-type or ''> } });
 *  rejects on a request or response error. */
export function apiFetch(path: string, init?: ApiInit): Promise<Response>;

// apps/web/e2e/test.ts
export const test; // base.extend<object, { workerTenant: void }>({
//   workerTenant: [async ({}, use) => { await seedWorkerTenant(); await use(); }, { scope: 'worker', auto: true }],
//   baseURL: async ({}, use) => { await use(TENANT_WEB_URL); } })
//   `{}` args carry `// eslint-disable-next-line no-empty-pattern`.
//   seedWorkerTenant(): reads E2E_ADMIN_DATABASE_URL and E2E_PASSWORD_HASH (throws
//   'e2e: global setup did not publish the database' if either is missing), runs each seedStatements(hash)
//   statement on new Pool({connectionString, max: 1}), and ends the pool in finally.
export { expect } from '@playwright/test';
```

```ts
// tools/check-docs.ts
export interface DocFile {
  path: string;
  text: string;
}
export const INSTRUCTION_FILES: readonly string[]; // 'CLAUDE.md', 'AGENTS.md', '.claude/harness/CLAUDE.md',
//   'docs/BUILD-PROTOCOL.md', 'docs/WORKFLOW.md', 'docs/ORCHESTRATION.md', 'docs/SKILLS.md',
//   'docs/REVIEW-MECHANISMS.md', 'docs/LEAN.md', 'docs/TESTING.md', 'docs/HANDOFF.md', 'docs/plan/ORCHESTRATOR.md'
export const STACK_FILES: readonly string[]; // 'docs/adr/0001-stack.md', 'docs/spec/SPEC.md', 'THIRD_PARTY.md'
export const PROCESS_MARKERS: readonly { label: string; pattern: RegExp }[];
//   ['DeepSeek', /\bdeepseek\b/i], ['OpenRouter', /\bopenrouter\b/i], ['nemotron', /\bnemotron\b/i],
//   ['TwIL', /\btwil\b/i], ['ollama', /\bollama\b/i], ['free coder', /\bfree coder\b/i], ['DSH', /\bDSH\b/]
// Default root = process.cwd() for instructionPaths, readDocs and loadDenyList; every relative path is
// joined onto root (path.join) for reading; returned/printed paths stay repo-relative.
export function instructionPaths(root?: string): string[]; // INSTRUCTION_FILES + .claude/agents/*.md (sorted)
export function readDocs(paths: string[], root?: string): DocFile[]; // throws `docs: missing <path>`
export function processErrors(files: DocFile[]): string[]; // `${path}:${line}: names a process other than Athena v3 (${label})`
export function drizzleErrors(files: DocFile[]): string[]; // /drizzle/i → `${path}:${line}: names Drizzle; the repo uses raw SQL on pg (D02)`
// Line rule (both): split text on '\n'; test each line; line numbers start at 1; one error per marker per line.
// main(): prints `docs: <n> instruction files, <m> stack files, <e> problem(s)`, errors to stderr, exitCode 1 on any.

// tools/parity.ts: ParityRow gains `ticket?: string`; in evidenceErrors:
//   row.status === 'in-progress' && !row.evidence?.length && !row.ticket?.trim()
//     → `${row.id}: in-progress without evidence or a ticket`

// tools/check-changelog.ts
export interface ChangedFile {
  status: string;
  path: string;
} // lines of `git diff --name-status --no-renames`
export const FRAGMENT: RegExp; // /^changes\/\d+-[a-z0-9-]+\.md$/
export function changelogErrors(files: ChangedFile[]): string[];
//   added = files.filter(f => f.status === 'A' && f.path.startsWith('changes/'))
//   for each added path failing FRAGMENT: `${path}: name a fragment changes/<issue>-<slug>.md`
//   added.length !== 1: `add exactly one changelog fragment under changes/ (found ${added.length})`
// main(): runs `git diff --name-status --no-renames <range>` for range origin/main...HEAD, else HEAD~1...HEAD;
//   if both throw: console.log('changelog: no diff base yet, skipping') and return (check-parity-update.ts pattern).
//   Parse: split output on '\n', drop empty lines, split each line on '\t' → [status, path].
//   console.log(`changelog: ${files.length} changed files, ${errors.length} problem(s)`);
//   each error → console.error(`changelog: ${error}`); exitCode 1 if any error.

// tools/pii-sources.ts
export const SOURCES: { users: string; tickets: string; workbook: string };
//   'docs/discovery/real-2026-11-13/live/users.json', '…/live/tickets-export.json', '…/cosmos-export-2026-11-11.xlsx'
export interface DenyList {
  names: string[];
  phones: string[];
}
export interface SourceTexts {
  users?: string;
  tickets?: string;
  workbook?: string;
} // workbook read as utf8 text
export const PHONE: RegExp; // /(?<![\w.+])(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}(?![\w.])/g
export function normalisePhone(value: string): string; // digits only, last 10
export function workbookCells(
  text: string,
): { sheet: number; col: string; row: number; value: string }[];
export function denyListFromSources(texts: SourceTexts): DenyList;
export function loadDenyList(root?: string): DenyList; // throws `pii: source list missing: <path>`

// tools/check-pii.ts
export function scannedPaths(paths: string[]): string[]; // drops paths starting 'docs/discovery/' and 'pnpm-lock.yaml'
export function scanText(path: string, text: string, deny: DenyList): string[];
export function scanFiles(root: string, paths: string[], deny: DenyList): string[]; // skips a file with a NUL byte in its first 8000 bytes
// main(): deny = loadDenyList(); paths = scannedPaths(git ls-files -z); prints
//   `pii: <n> names and <m> phones from the source lists; <f> files scanned; <e> problem(s)`; exitCode 1 on any.
```

**Deny-list rules (`denyListFromSources`).**

- **Name candidates.**
  - `JSON.parse(users).users[].name`.
  - For each `JSON.parse(tickets).tickets[]`: `reportedBy`, `startedBy`, `closedBy`, `assignedTo`, `transferTo`, `pausedBy`, and each `crew[].name`. Non-strings are skipped.
  - From `workbookCells(workbook)`: every cell below a header cell (same `sheet`, same `col`, higher `row`) whose `value.trim().toLowerCase()` is `name`, `done by` or `supported by`.
- **Name filter.** Split each candidate on `/[,&/+]|\band\b/i`. Trim and collapse whitespace. Drop a part with fewer than 3 `\p{L}` letters, or one matching `/^(?:operator|engineer|supervisor|admin|store|technician|maintenance|maint\.?|vendor|production|none|n\/?a)$|\bteam\b|^cell\s*\d+$/i`. The result is lower-case and unique.
- **Phones.** Every `PHONE` match in the raw `users`, `tickets` and `workbook` texts, normalised with `normalisePhone`, unique.

**`workbookCells(text)`.**

- Split `text` on `<worksheet`. Each part after the first is one sheet (index from 1). If there are none, throw `pii: workbook has no readable worksheets`. The frozen file stores its sheets uncompressed; a compressed workbook must fail loudly, not silently.
- Read each sheet with `/<c r="([A-Z]+)(\d+)"[^>]*>(?:<f>[^<]*<\/f>)?(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)/g`.
- Unescape `&amp; &lt; &gt; &quot; &apos;`, `&#<dec>;` and `&#x<hex>;`.

**`scanText` (exact).**

- Split `text` on `'\n'`. Apply both checks to each line. Line numbers start at 1.
- Names: one regex `(?<![\p{L}\p{N}_])(?:n1|n2|…)(?![\p{L}\p{N}_])` with flags `iu`. Names are sorted longest first and regex-escaped, and each space becomes `\s+`. An empty list matches nothing.
- Phones: each `PHONE` match whose `normalisePhone` is in `deny.phones`.
- Output: at most one `${path}:${line}: real name from the source lists` and one `${path}:${line}: real phone from the source lists` per line. The value is never printed.

**CI (`.github/workflows/ci.yml`).** Each job starts with the existing setup steps: `checkout@v4` with `fetch-depth: 0`, `pnpm/action-setup@v4` 10.30.3, `setup-node@v4` 24 with the pnpm cache, and `pnpm install --frozen-lockfile`. Each job has `timeout-minutes: 8`; matrices have `fail-fast: false`.

- `static`:
  - always: `format:check`, `lint`, `typecheck`, `build`, `parity`, `docs:check`, `pii:scan`, `licences`, `migrations:check`, `audit:lean`;
  - `if: github.event_name == 'pull_request'`: `parity:update` (keeps its `PARITY_ALLOW_SKIP` env), `changelog:check`, `migrations:immutable`, `pr:size` (keeps its `LEAN_ALLOW_LARGE` env).
- `api` (`matrix.shard: [1, 2, 3]`): `pnpm exec playwright install --with-deps chromium` (the PDF tests need it), then `pnpm exec vitest run --shard=${{ matrix.shard }}/3`.
- `browser` (`matrix.shard: [1, 2]`): the same Chromium install, then `pnpm exec playwright test --shard=${{ matrix.shard }}/2`.

## 5. Data

| Field                                                                                                                                         | Type                                   | Where                                | Use                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------------------------ | ----------------------------------------------- |
| `tenant.time_zone` → `Config.timeZone`                                                                                                        | `string`, IANA, default `Asia/Kolkata` | Postgres / `GET /api/v1/config`      | read; gates the times                           |
| `SlaTimer.dueAt`, `SlaTimer.stoppedAt`                                                                                                        | `string \| null` (ISO)                 | ticket `sla` reply part              | read                                            |
| Per-worker seed rows (the `seedStatements` columns of `tenant`, `segment`, `shift`, `machine`, `person`, `login`, `list_item`, `ref_counter`) | existing                               | the run's throwaway Testcontainer    | written once per worker                         |
| `E2E_ADMIN_DATABASE_URL`, `E2E_PASSWORD_HASH`                                                                                                 | env `string`                           | set in global setup, read by workers | test-only; the hash is of the fake e2e password |
| `parity.yaml rows[].ticket`                                                                                                                   | optional `string`                      | `docs/spec/parity.yaml`              | read by the check; no row sets it               |
| The three source files                                                                                                                        | JSON, xlsx                             | `docs/discovery/real-2026-11-13/`    | read in memory only, never echoed               |

No schema change, no migration, no new table, no new dependency (`pg` is already a root devDependency).

## 6. Test cases and tasks

Docker is running in this container, so the browser and API suites and the 20-run evidence run locally and
in CI. Every `tools/` test is database-free and runs in the stop hook's fast tests.

### Browser (`apps/web/e2e/`, both projects)

1. **T1 — reproduces the bug; written first.**
   - Location: `sla-timers.spec.ts`, a new block appended after the last test ("reprojects overdue, cancelled, and restored timer states") › `test.describe('plant time zone', …)` with `test.use({ timezoneId: 'America/New_York' })` › "shows no SLA due time until the plant time zone loads".
   - **Given:** `await ensureSlaConfiguration()`; `ticket = await raiseWorkRequest(await apiLogin('asha'), 'SLA time zone')`; `signIn(page, 'admin')`; then `/\/api\/v1\/config(?:\?.*)?$/` is held by `page.route` (the pattern of "keeps SLA drafts…").
   - **When:** `page.goto(\`/desk/${ticket.id}\`)`.
   - **Then:** the "SLA timers" region contains `min left`, has 0 `time` elements and does not contain `Due`.
   - **When:** the route is released (in `finally`).
   - **Then:** `timerRow(timers, 'Acknowledge').locator('time')` is visible, and its `innerText()` equals `new Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Kolkata'}).format(new Date(<datetime attribute>))`.
   - Red before the `SlaTimerSummary` change: a `<time>` renders while config is held.
2. **T2 — offline snapshot.** "freezes cached Settings and ticket timers while offline", with the added wait.
   - **Given:** the Acknowledge `<time>` is visible.
   - **When:** the page goes offline and the clock moves 2 minutes.
   - **Then:** the timers text is unchanged.
   - The race (config arriving after the snapshot) is not made red separately. **T1 is accepted as its reproduction:** the same root cause, and T2's wait only becomes meaningful once `<time>` means "config loaded".
3. **T3 — repeat collision.**
   - **Red first (before the edit):** `pnpm exec playwright test apps/web/e2e/sla-timers.spec.ts -g "configures policies" --repeat-each=2 --retries=0 --project=chromium` fails on the second run with `POST /api/v1/tickets failed: 409`. Record it in §8.
   - **After the edit:** the same command passes.
4. **T4 — 20 in a row.**
   - **Given:** the 7 tests of `sla-timers.spec.ts`.
   - **When:** `pnpm exec playwright test apps/web/e2e/sla-timers.spec.ts --repeat-each=20 --retries=0 --global-timeout=2400000`.
   - **Then:** 280 passed, 0 failed, 0 flaky.
5. **T5.** `tenant.spec.ts` › "signs in to this worker's own tenant and nowhere else".
   - `TENANT.slug` is `` `e2e-w${test.info().workerIndex}` ``.
   - `await apiLogin('asha')` returns a non-empty token.
   - `fetch(\`${API_URL}/api/v1/auth/login\`, {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({username:'asha', password:E2E_PASSWORD})})`answers 404: an IP host maps to`e2e-unscoped`.
   - Red until task 4 (`stack.ts`).
6. **T6 — regression.** `pnpm test:e2e` is green on both projects; no assertion changed.
7. **T7 — CI.** On the PR, `static`, `api (1/2/3)`, `browser (1/2)` and `secrets` are green, each under 8 minutes.

### Docs (`tools/docs.test.ts`)

8. **T8.** "flags another process in an instruction file" (`it.each`), on `processErrors([{path:'AGENTS.md', text:'intro\n' + line}])`:
   - each of `route to DeepSeek Flash`, `the OpenRouter provider`, `nemotron-3`, `local TwIL`, `ollama/x`, `the hosted free coder`, `in DSH` gives exactly `['AGENTS.md:2: names a process other than Athena v3 (<label>)']`;
   - `the dsh profile` (lower case) and `Athena v3: Opus plans and reviews, Sonnet builds` give `[]`.
9. **T9.** "fails a stack document that names Drizzle": `drizzleErrors([{path:'THIRD_PARTY.md', text:'| Drizzle ORM | database |'}])` gives `['THIRD_PARTY.md:1: names Drizzle; the repo uses raw SQL on pg (D02)']`.
10. **T10.** "the repository's instruction and stack files pass": `processErrors(readDocs(instructionPaths()))` and `drizzleErrors(readDocs([...STACK_FILES]))` are both `[]`. Red until tasks 10–12.

### Parity (`tools/parity.test.ts`)

11. **T11.** "rejects an in-progress row with neither evidence nor a ticket":
    - row `{id:'v3.test.04', feature:'x', disposition:'keep', milestone:'M1', status:'in-progress', evidence:[]}`;
    - `validateParity({version:1, rows:[row]})` contains `'v3.test.04: in-progress without evidence or a ticket'`.
12. **T12 — over-rejection guard, green before and after (stated).** "accepts an in-progress row with a ticket": the same row with `ticket:'#91'` gives an error list without any `v3.test.04` entry. It passes today because there is no in-progress rule yet; it exists to stop T11's fix from rejecting ticketed rows.

### Changelog and merge

13. **T13.** `tools/changelog.test.ts` › "allows exactly one well-named fragment" (`it.each` on `changelogErrors`):
    - `[A changes/76-green-fast-main.md, M apps/x.ts]` gives `[]`;
    - `[M changes/70-old.md]` gives `['add exactly one changelog fragment under changes/ (found 0)']`;
    - `[A changes/1-a.md, A changes/2-b.md]` gives `['add exactly one changelog fragment under changes/ (found 2)']`;
    - `[A changes/notes.md]` gives `['changes/notes.md: name a fragment changes/<issue>-<slug>.md']`.
14. **T14.** `tools/union-merge.test.ts` › "merges two appended wiki/log.md lines without a conflict".
    - **Given:** in `mkdtemp`, `git init -q -b main`; the repo's `.gitattributes` copied in; `wiki/log.md` = `base\n`; both committed **in one base commit**; branch `a` appends `line a\n` and commits; `main` appends `line b\n` and commits. Every git call uses `-c user.name=Test -c user.email=test@example.invalid`.
    - **When:** `git merge a --no-edit`.
    - **Then:** exit 0, and the file contains `base`, `line a` and `line b`.
    - Red without `.gitattributes` (conflict).

### PII (`tools/pii.test.ts`)

No real value goes into an assertion message, and nothing real is written outside a `mkdtemp` dir.

15. **T15.** "fails on a planted real name from the source lists, passes without it".
    - **Given:** `deny = loadDenyList()`, `name = deny.names[0]`.
    - **Then:**
      - `scanText('planted.md', 'intro\nReported by ' + titleCase(name), deny)` equals `['planted.md:2: real name from the source lists']`;
      - `errors.join()` does not contain `name`;
      - `scanText('planted.md', 'Reported by a fake person', deny)` is `[]`.
    - `titleCase` is a local one-line helper; it proves case-insensitivity.
16. **T16.** "fails on a generated Indian mobile number in every written form".
    - **Given:** `n = String(6 + Math.floor(Math.random() * 4)) + String(Math.floor(Math.random() * 1e9)).padStart(9, '0')`; `deny = denyListFromSources({ users: JSON.stringify({ users: [{ name: 'Fake Person', note: 'call +91' + n }] }) })`. The `note` key proves that phone-shaped values are taken from anywhere.
    - **When:** `scanText('p.md', ['+91' + n, '+91 ' + n.slice(0, 5) + ' ' + n.slice(5), '0' + n, n, other].join('\n'), deny)`, where `other` is `n` with its last digit changed (`(d + 1) % 10`).
    - **Then:** exactly `['p.md:1: …', 'p.md:2: …', 'p.md:3: …', 'p.md:4: …']`, each `real phone from the source lists`.
17. **T17.** "ignores generic labels": `denyListFromSources({ users: JSON.stringify({ users: ['Operator', 'Maint. Team', 'Cell1', 'AB', 'Fake Person'].map((name) => ({ name })) }) }).names` equals `['fake person']`.
18. **T18.** "reads names from the workbook": `denyListFromSources` of the three real texts has more names than the JSON-only call (compared as counts only); `workbookCells('no sheets')` throws `/no readable worksheets/`.
19. **T19.** "fails loudly when a source list is missing": `loadDenyList(<empty mkdtemp>)` throws `/pii: source list missing/`.
20. **T20.** "never scans the source lists or the lockfile": `scannedPaths(['docs/discovery/real-2026-11-13/live/users.json', 'pnpm-lock.yaml', 'apps/x.ts'])` equals `['apps/x.ts']`.
21. **T21.** "the repository holds no real name or phone outside docs/discovery": `scanFiles(root, scannedPaths(gitLsFiles), loadDenyList())` is `[]`, where `gitLsFiles` is `git ls-files -z` split on NUL.

### Tasks (in order; one acceptance assertion each)

| #   | Files                                                                                                                                                                    | Red → green                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| 1   | `sla-timers.spec.ts` (T1), `SlaTimerSummary.tsx`                                                                                                                         | T1 red, then the fix; `pnpm exec playwright test apps/web/e2e/sla-timers.spec.ts -g "time zone"` green |
| 2   | `sla-timers.spec.ts` (T3 edit, then the T2 wait)                                                                                                                         | T3 red command recorded, then green; T2 green                                                          |
| 3   | `fixtures.ts`, `test.ts` (new), `tenant.spec.ts` (new)                                                                                                                   | T5 red (global setup does not publish the database yet)                                                |
| 4   | `stack.ts`, `playwright.config.ts` (comment), `vite.e2e.config.ts` (comment)                                                                                             | T5 green: `pnpm exec playwright test apps/web/e2e/tenant.spec.ts`                                      |
| 5   | `admin`, `board`, `desk` specs                                                                                                                                           | those files green                                                                                      |
| 6   | `floor`, `offline`, `settings-severity` specs                                                                                                                            | those files green                                                                                      |
| 7   | `sla-timers.spec.ts` (imports, `apiFetch`), `tags.spec.ts`, `sla-test-helpers.ts`                                                                                        | T6 `pnpm test:e2e` green; then T4, recorded in §8                                                      |
| 8   | `tools/parity.ts`, `tools/parity.test.ts`                                                                                                                                | T11 red → green; T12 green                                                                             |
| 9   | `tools/check-docs.ts`, `tools/docs.test.ts`, `package.json` (`docs:check`)                                                                                               | T8, T9 green; T10 red                                                                                  |
| 10  | `docs/adr/0001-stack.md`, `docs/spec/SPEC.md`, `THIRD_PARTY.md`                                                                                                          | Drizzle half of T10 green                                                                              |
| 11  | Delete `docs/orchestration.yaml` and `tools/check-orchestration.ts`; `package.json` scripts/verify; `D18`                                                                | `pnpm verify` no longer calls `orchestration:check`                                                    |
| 12  | (a) `CLAUDE.md`, `AGENTS.md`, `docs/WORKFLOW.md`; (b) `ORCHESTRATION.md`, `BUILD-PROTOCOL.md`, `REVIEW-MECHANISMS.md`; (c) `SKILLS.md`, `docs/HANDOFF.md` (task-15 text) | T10 green; `pnpm docs:check` exit 0                                                                    |
| 13  | `tools/check-changelog.ts`, `tools/changelog.test.ts`, `package.json` (`changelog:check`)                                                                                | T13 red → green                                                                                        |
| 14  | `.gitattributes`, `tools/union-merge.test.ts`                                                                                                                            | T14 red → green                                                                                        |
| 14a | `tools/pii-sources.ts`, `tools/pii.test.ts` (T16–T19)                                                                                                                    | red → green: `pnpm exec vitest run tools/pii.test.ts`                                                  |
| 14b | `tools/check-pii.ts`, `tools/pii.test.ts` (T15, T20, T21), `package.json` (`pii:scan`)                                                                                   | red → green; `pnpm pii:scan` exit 0                                                                    |
| 15  | `.github/workflows/ci.yml`, then the bookkeeping docs                                                                                                                    | T7 green; shard times in §8; `pnpm verify` green                                                       |

**Task 15, bookkeeping text.**

- **`changes/76-green-fast-main.md`**, five bullets:
  - SLA due and stopped times wait for the plant time zone.
  - Browser tests seed one tenant per Playwright worker.
  - CI runs as `static`, `api` ×3, `browser` ×2, each under 8 minutes.
  - Docs, parity, changelog and PII guards.
  - One build process, Athena v3 (D18).
- **`docs/plan/MILESTONES.md`** row 01: `| 01 | Green, fast main | M0 | done | #<n> |`.
- **`wiki/log.md`**, append: `2026-11-13 — Ticket 01 Green, fast main (#<n>): SLA times wait for the plant zone; one seeded tenant per Playwright worker; CI static/api×3/browser×2, each < 8 min; docs, parity, changelog and PII guards; one process, Athena v3 (D18). SLA ×20: <passed>/280.`
- **`docs/HANDOFF.md`**: replace lines 5–42 (from `## RESUME HERE` through the end of `## Next`) with:

```
## RESUME HERE

**State**: `main` has M2-2.2 SLA timers (#74), the milestone plan (#75) and ticket 01 (#<n>). The only build
process is Athena v3 (`.claude/harness/CLAUDE.md`, `docs/plan/ORCHESTRATOR.md`; D18). The progress tracker
in `docs/plan/MILESTONES.md` is the queue.

- CI: `static`, `api` ×3, `browser` ×2 and `secrets`, each under 8 minutes. Browser tests seed one tenant per
  Playwright worker (`apps/web/e2e/test.ts`).
- Guards: `pnpm docs:check`, `pnpm pii:scan`, `pnpm changelog:check` (one `changes/` fragment per PR).

## Live on main

- M0 foundation: schema v1 with forced RLS and `app_api`, auth, settings/config, Cosmos seed, walking skeleton.
- M1a ticket core: domain state/figures/permissions, tickets API, floor/desk, lists and real E2E harness.
- M1b: report/PDF, live board, PWA/WhatsApp, offline outbox, push, needs-report, day-report, admin, Desk
  Views, exact cancel time and per-person minutes, synthetic importer with undo.
- M2: configurable tags (#71), severity matrix (#72), SLA policies and timers (#74).

## Next

- The M0 frontier after 01: tickets 02, 08, 10, 13 (MILESTONES "What can run at the same time").
```

## 7. Out of scope and regression risk

**Out of scope:**

- `Timeline` and `PeopleSection` in `TicketDetail.tsx` (lines 150–161) share the time-zone bug, but the ticket names only the SLA timer. Proposed follow-up issue.
- Selecting tests by touched module (ticket 03); full journeys on staging (13); pseudonymised fixtures (08).
- `docs/plan/ledger.md` (ruling); `parity.yaml` and `sync-parity.ts`; anything in `.claude/harness/` or `.claude/skills/`.
- Releasing `changes/`; old `wiki/log.md` lines (append-only); ROADMAP and spike docs (history, not instruction files).
- Any server, schema or API change.

**Regression risk, with how it is caught:**

- Every e2e spec changes, and the stack no longer seeds `cosmos`: T6 on both projects.
- `SlaTimerSummary` has no unit test (no component-test setup exists); only T1 and T6 cover it.
- `verify` loses `orchestration:check`, and its file is deleted. Check with `grep -rn orchestration package.json .github`.
- The CI split must keep every old step: review compares the old step list with `static` + `api` + `browser`.
- `api` shards now also run `tools/**`, `packages/**` and `apps/**` unit tests (`vitest.config.ts:13` includes them all). That is intended.
- `tools/check-deps.ts` reads `THIRD_PARTY.md`. Drizzle is not installed, so deleting its row cannot fail it; `pnpm deps` stays green.
- Fast tests (the stop hook) now read the three source files about 4 times. Measured baseline: 1.8 s. The deny-list build plus the repo scan measured 160 ms, so the expected total is under 3 s. Record the measured value in §8.

## 8. Evidence (filled by the builder)

- T2: no red run — stated exception. The snapshot race is not forced separately; T1 is its reproduction (same root cause), and T2's wait only means "config loaded" once T1's fix exists.
- T3 red (409) output and green: _paste_
- T1 red and green: _paste_
- T4 SLA ×20: _passed/failed/flaky_
- CI run URL and job times: static _m_, api 1/2/3 _m_, browser 1/2 _m_
- Fast tests before/after: 1.8 s / _s_

## 9. Questions for the orchestrator

None open. Rulings applied: Q1 (one PR, `size:large`; cuts in §2), Q2 (phones from any phone-shaped value in
the sources, proven with generated +91 numbers), Q3 (confirmed; `.claude/harness/` untouched), Q4 (no ledger edit).
`no-parity` is added because `apps/` changes but no parity row does.
