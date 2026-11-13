# 01 — Green, fast main

Issue: [#76](https://github.com/nimishshah1989/argus/issues/76) · Milestone M0 · Blocked by: none · Branch
`claude/t01-green-fast-main` (base `eb80a47`). The PR body must contain `Closes #76`.

## 1. Goal

Every PR gets a quick, honest answer: the SLA timer stops jumping between time zones, the browser tests stop
colliding, CI runs in parallel shards of under 8 minutes each, and CI fails when the instruction documents
describe another process, when the stack documents still name Drizzle, or when a real Cosmos name gets into the repo.

## 2. Decisions taken here (technical; record each as a ledger ruling)

1. **Time zone (bug root cause).** `SlaTimerSummary` renders the `Due` and `Stopped at` times with
   `config?.timeZone`, which is `undefined` until `/api/v1/config` answers. The browser zone is used in the
   meantime, then the text jumps. Fix: render neither time until `timeZone` is known. `TicketCard` renders the
   compact summary (`detailed` false), which never shows times, so it is unaffected.
2. **Serial-retry collision.** The first SLA test raises a ticket on `MACHINES[8]`/`[9]` without cancelling
   the open one, so a retry or a repeat gets 409. Fix: use the existing `prepareStoppedTicket` (cancel first).
   The offline test captures `timers.innerText()` before config loads. Fix: wait for the `<time>` element first.
3. **A seeded tenant per Playwright worker, with no new table.** The server already resolves the tenant from
   the `Host` header (`apps/server/src/tenant.ts`: the label before the first dot). Each worker process seeds
   its own tenant `e2e-w<TEST_WORKER_INDEX>` into the run's one Testcontainer. All its ids come from the fixed
   fixture ids, with the first 8 hex digits replaced by `(0x20000000 + workerIndex)`. The browser opens
   `http://e2e-w<n>.localhost:3000`. Chromium is pinned to resolve `*.localhost` to 127.0.0.1, and Vite proxies
   `/api` with `changeOrigin: false`, so the Host header is kept. Node's `fetch` drops a `Host` override
   (verified), so helper API calls go through one `node:http` helper, `apiFetch`. A worker restarted after a
   failure gets a new `workerIndex`, so it starts on a fresh tenant. The stack's IP-host default tenant
   becomes the non-existent `e2e-unscoped`. A spec that forgets the per-worker `test` therefore fails loudly
   with 404 "Unknown company" instead of sharing state without anyone noticing.
4. **CI shape.** Today one `checks` job takes about 6.5 min (vitest 3m42s, Playwright 1m52s, run 43379580801).
   New jobs: `static` (format, lint, typecheck, build, every guard tool), `api` (a vitest matrix of 3 shards),
   `browser` (a Playwright matrix of 2 shards), plus the existing `secrets` job. Every job has
   `timeout-minutes: 8`, so CI itself enforces "each shard under 8 minutes". There is no branch protection
   (private repo on the free plan: the API answers 403), so the old `checks` name needs no aggregator job.
5. **"Touched-module API tests" and "browser smoke".** Modules do not exist until tickets 02 and 03, and
   staging does not exist until 13. Until then the `api` shards run the whole vitest suite (a superset of the
   touched module plus `packages/db/test/isolation.test.ts`), and the `browser` shards run the whole Playwright
   suite (a superset of a smoke). Both fit the budget. Ticket 03 narrows the API selection once modules exist.
   Ticket 13 moves the full journeys to staging.
6. **"Another process" means the DeepSeek-Harness route (DSH) with the hosted free coder.** BRIEF scope item 1
   says "one process (Athena v3)", and ROADMAP H1 says "DSH routing retired in `docs/decisions/` with the
   reason". The markers are `DeepSeek`, `OpenRouter`, `nemotron`, `TwIL`, `ollama`, `DSH` (case-sensitive) and
   `free coder`. This slice removes them from every instruction file, deletes `docs/orchestration.yaml` and
   `tools/check-orchestration.ts`, and records decision D18.
7. **The parity rule lives in the existing parity check** (`tools/parity.ts`, run by `pnpm parity`), not in a
   second parser. Today all 34 `in-progress` rows carry evidence, so no row changes.
8. **Drizzle.** D02 already says ADR 0001, SPEC and `THIRD_PARTY.md` "are corrected"; they are not. This slice
   corrects them, and the check keeps them corrected.
9. **PII scan: deny-list derived at run time.** The scan reads its deny-list from the committed, tracked
   source files every time it runs. Those files are in git, about 3 MB, under `docs/discovery/real-2026-11-13/`.
   No real value is ever written into code, tests, fixtures or logs. Error messages name the file, the line and
   the kind, never the value. Verified on the current tree, without printing any value: the rules below yield
   60 names and 0 hits outside `docs/discovery/`. **The source files contain no phone numbers.** `users.json`
   has no phone field, and the export's `Phone` cells are a source label. The phone path is built and proven
   on a synthetic source list; see question 2.

## 3. Files

### Browser goal (bug, isolation, CI)

| File                                                                           | Change                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/SlaTimerSummary.tsx`                                  | `TimerDetails`: render the `Due` row and the `Stopped at` row only when `timeZone` is a non-empty string (add `timeZone &&` to both conditions). Nothing else changes.                                                                                                                                                                                                                                            |
| `apps/web/e2e/sla-timers.spec.ts`                                              | New test T1 (§5). Test "configures policies…": replace `raiseTicketViaApi(token, machine.id, …)` with `prepareStoppedTicket(machine, await apiLogin('admin'))`. Test "freezes cached Settings…": before `const before = …`, add `await expect(timerRow(timers, 'Acknowledge').locator('time')).toBeVisible();`. Import `test`/`expect` from `./test.js`; replace the `fetch(\`${API_URL}…\`)`call with`apiFetch`. |
| `apps/web/e2e/sla-test-helpers.ts`                                             | `apiJson` calls `apiFetch(path, …)` instead of `fetch(\`${API_URL}${path}\`, …)`; its `init`type becomes`ApiInit`.                                                                                                                                                                                                                                                                                                |
| `apps/web/e2e/fixtures.ts`                                                     | Add `WORKER`, `scopedId`, `TENANT_WEB_URL`, `API_HOST`, `ApiInit`, `apiFetch` (§4). `TENANT`, `SEGMENT`, `MACHINES`, `PEOPLE`, `LOGINS` and the shift id use `scopedId(...)`. `TENANT.slug` becomes `e2e-w${WORKER}`. The private `apiJson` calls `apiFetch`. Keep `API_URL` and `WEB_URL`: they are the stack's own origins, used by `stack.ts`.                                                                 |
| `apps/web/e2e/test.ts` (new)                                                   | Exports `test` (with the worker-scoped auto fixture `workerTenant` and a `baseURL` override) and `expect` (§4).                                                                                                                                                                                                                                                                                                   |
| `apps/web/e2e/tenant.spec.ts` (new)                                            | Test T5 (§5).                                                                                                                                                                                                                                                                                                                                                                                                     |
| `apps/web/e2e/stack.ts`                                                        | `startDatabase` no longer runs `seedStatements`. After migrations and the role password, it sets `process.env.E2E_ADMIN_DATABASE_URL = container.getConnectionUri()` and `process.env.E2E_PASSWORD_HASH = await hashPassword()`. `startApi` passes `DEFAULT_TENANT_SLUG: 'e2e-unscoped'`. Drop the now-unused `seedStatements`/`TENANT` imports.                                                                  |
| `apps/web/e2e/vite.e2e.config.ts`                                              | `server.allowedHosts: ['.localhost']`, with the comment updated.                                                                                                                                                                                                                                                                                                                                                  |
| `playwright.config.ts`                                                         | `use.launchOptions: { args: ['--host-resolver-rules=MAP *.localhost 127.0.0.1'] }`. Update the header comment: the tenant comes from the per-worker host.                                                                                                                                                                                                                                                         |
| `apps/web/e2e/{admin,board,desk,floor,offline,settings-severity,tags}.spec.ts` | Value imports `test`, `expect` from `./test.js` (type imports may stay on `@playwright/test`). Every `fetch(\`${API_URL}…\`, init)`becomes`apiFetch('…', init)`, and `RequestInit`becomes`ApiInit`. `desk.spec.ts`: `browser.newContext({ baseURL: TENANT_WEB_URL })`. `offline.spec.ts`: `ASHA_PERSON_ID = scopedId('10000000-0000-0000-0000-000000000009')` (and update its comment). No assertion changes.     |
| `.github/workflows/ci.yml`                                                     | Replace the `checks` job with `static`, `api` (matrix `shard: [1, 2, 3]`) and `browser` (matrix `shard: [1, 2]`), each with `timeout-minutes: 8` and `strategy.fail-fast: false` on the matrices; `secrets` stays unchanged (§4).                                                                                                                                                                                 |

### Process goal 2 (docs check, parity, changelog, union merge)

| File                                      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tools/check-docs.ts` (new)               | The instruction-file process check and the Drizzle check (§4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `tools/docs.test.ts` (new)                | T8–T12.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tools/parity.ts`                         | `ParityRow.ticket?: string`; two new rules in `evidenceErrors` (§4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `tools/parity.test.ts`                    | T13–T15.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `docs/spec/parity.yaml`                   | Header comment, line 3: "An in-progress row names evidence or a `ticket: '#<issue>'`." No row changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `docs/adr/0001-stack.md`                  | Database row: `PostgreSQL 16+ on RDS; raw SQL through \`pg\` (D02); SQL migrations with RLS`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `docs/spec/SPEC.md`                       | Line 158 `packages/db` row: "SQL migrations with RLS policies, raw SQL repos on `pg` (D02), seed and import scripts, isolation test", technology "node-postgres (`pg`)". Line 164: drop "Drizzle ORM, ". Line 174: "re-implemented on Drizzle" becomes "re-implemented in SQL". Line 176: the pick becomes "Postgres RLS with `set_config('app.tenant_id', ..., true)` inside our `withTenant` transaction wrapper; policies in plain SQL in the migrations". Line 190: drop ", drizzle-zod". Line 205: "Postgres 16 (RDS), raw SQL on `pg` (D02), SQL migrations in `packages/db`, …". Line 305: "packages/db SQL migrations with RLS, seeds, import scripts, isolation test". Afterwards `grep -i drizzle` on the file is empty. |
| `THIRD_PARTY.md`                          | Delete the `Drizzle ORM` row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `CLAUDE.md` (repo)                        | Replace the "Execution routing: … Do not fall back to DeepSeek for code." paragraph with: "Execution routing: `docs/plan/ORCHESTRATOR.md` (the Athena v3 model table in `.claude/harness/CLAUDE.md`)."                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `AGENTS.md`                               | Delete the section "## Model routing and the build loop" (lines 14–24). Replace it with "## The build loop" and one sentence: "Roles, models and the loop are `.claude/harness/CLAUDE.md` and `docs/plan/ORCHESTRATOR.md`; agents without Claude Code follow their intent."                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `docs/ORCHESTRATION.md`                   | Delete §10 (from the line "## 10. Model routing…" up to the line before "## 11."). Renumber "## 11." to "## 10.". Line 28: delete ", and in DSH as a persisted goal when the milestone starts". Delete "**DSH tools it uses:**" and its table (about lines 120–131). Line 185: "alongside DSH's `workflow`/`subagent`" becomes "alongside Claude Code subagents".                                                                                                                                                                                                                                                                                                                                                                  |
| `docs/BUILD-PROTOCOL.md`                  | Delete the subsection "### DeepSeek Harness specifics" (lines 272–280).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `docs/REVIEW-MECHANISMS.md`               | §7, second bullet: "The coder (Sonnet) and the reviewers (Opus, fresh context) are different models; a fresh context is a real independence boundary. It is still not a senior human: …" (keep the rest of the sentence).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/SKILLS.md`                          | Line 3: delete the sentence starting "DeepSeek Harness has native skills". Line 5: delete "In DSH the pins and hooks do not apply; follow the **intent**, not the frontmatter." Line 30: replace "In DSH it is not a native skill, …" with "The code-reviewer checks it." Delete the line-54 bullet ("… no exact DSH native equivalent …"). §5: replace the paragraph with "`model:` pins and the hooks in `.claude/harness/hooks/` apply as written (Athena v3); R3 still adds a human reviewer."                                                                                                                                                                                                                                 |
| `docs/WORKFLOW.md`                        | Delete the `docs/orchestration.yaml` table row (line 38).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/HANDOFF.md`                         | Rewrite the top part so it is true after this merge, under 50 lines, with no DSH marker (§7 task 14).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `docs/decisions/D18-one-process.md` (new) | In D02's format. Decision: Athena v3 is the only build process. The DSH route with the hosted free coder (PR #73) is retired, `docs/orchestration.yaml` and `tools/check-orchestration.ts` are deleted, and `tools/check-docs.ts` keeps it that way. Why: BRIEF scope 1, ROADMAP finding 5 (two contradictory harnesses). Rejected: keeping both (agents follow whichever they read first); keeping the yaml as a record (git history holds it). Revisit: only through a new decision and a harness change.                                                                                                                                                                                                                        |
| `docs/orchestration.yaml`                 | Delete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tools/check-orchestration.ts`            | Delete.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `tools/check-changelog.ts` (new)          | The one-fragment-per-PR check (§4).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `tools/changelog.test.ts` (new)           | T16–T19.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `changes/README.md` (new)                 | Three lines: one fragment per PR, named `changes/<issue>-<slug>.md`, holding 1–5 bullet lines in the CHANGELOG style; fragments are folded into `CHANGELOG.md` at a release.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `changes/76-green-fast-main.md` (new)     | This PR's fragment (§7 task 14).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `CHANGELOG.md`                            | Under the intro paragraph, add one line: "From #76 on, each PR adds one fragment under `changes/` (see `changes/README.md`) and does not edit this file; fragments are folded in at a release." The existing Unreleased block stays.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `.gitattributes` (new)                    | `wiki/log.md merge=union`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `tools/union-merge.test.ts` (new)         | T20.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `package.json`                            | Scripts: add `"docs:check": "tsx tools/check-docs.ts"`, `"pii:scan": "tsx tools/check-pii.ts"`, `"changelog:check": "tsx tools/check-changelog.ts"`; delete `orchestration:check`. In `verify`, replace `pnpm orchestration:check` with `pnpm docs:check && pnpm pii:scan`.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Process goal 3 (PII scan)

| File                         | Change                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| `tools/pii-sources.ts` (new) | Builds the deny-list from the three source files, with a standard-library xlsx reader (§4). |
| `tools/check-pii.ts` (new)   | Scans the tracked files against the deny-list; CLI (§4).                                    |
| `tools/pii.test.ts` (new)    | T21–T28.                                                                                    |

### Bookkeeping (same PR)

`docs/plan/MILESTONES.md` (row 01: `done`, PR `#<n>`), `docs/plan/ledger.md` (new on `main`, §7 task 14),
`wiki/log.md` (one appended line), and this plan's §9 Evidence.

## 4. Interfaces

```ts
// apps/web/e2e/fixtures.ts
export const WORKER: number; // Number(process.env.TEST_WORKER_INDEX ?? '0')
export function scopedId(base: string): string; // (0x20000000 + WORKER).toString(16) + base.slice(8); base must be a fixture uuid
export const TENANT: { id: string; slug: string; name: 'Cosmos' }; // slug `e2e-w${WORKER}`
export const TENANT_WEB_URL: string; // `http://${TENANT.slug}.localhost:${WEB_PORT}`
export const API_HOST: string; // `${TENANT.slug}.localhost`
export interface ApiInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}
/** node:http request to API_URL with header host: API_HOST; resolves a WHATWG Response
 *  (status from the reply; body null for 204/304; content-type header copied). Rejects on socket error. */
export function apiFetch(path: string, init?: ApiInit): Promise<Response>;
// unchanged signatures: apiLogin, raiseTicketViaApi, signIn, machineFor, seedStatements, MACHINES, API_URL, WEB_URL

// apps/web/e2e/test.ts
export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions & { workerTenant: void }
>;
//   workerTenant: worker scope, auto: true. Reads E2E_ADMIN_DATABASE_URL and E2E_PASSWORD_HASH (throws
//   'e2e: global setup did not publish the database' if either is missing), runs seedStatements(hash)
//   on a pg Pool (max 1), then ends the pool. `{}` fixture args carry `// eslint-disable-next-line no-empty-pattern`.
//   baseURL: overridden to TENANT_WEB_URL.
export { expect } from '@playwright/test';
```

```tsx
// apps/web/src/components/SlaTimerSummary.tsx — props unchanged; behaviour: no <time> until timeZone is known
function TimerDetails({
  timer,
  status,
  timeZone,
}: Omit<RowProps, 'label' | 'detailed'>): JSX.Element;
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
//   DeepSeek /\bdeepseek\b/i · OpenRouter /\bopenrouter\b/i · nemotron /\bnemotron\b/i · TwIL /\btwil\b/i
//   · ollama /\bollama\b/i · DSH /\bDSH\b/ · free coder /\bfree coder\b/i
export function instructionPaths(root?: string): string[]; // INSTRUCTION_FILES + every .claude/agents/*.md, sorted
export function readDocs(paths: string[], root?: string): DocFile[]; // throws `docs: missing <path>`
export function processErrors(files: DocFile[]): string[]; // `${path}:${line}: names a process other than Athena v3 (${label})`, one per marker per line
export function drizzleErrors(files: DocFile[]): string[]; // /drizzle/i → `${path}:${line}: names Drizzle; the repo uses raw SQL on pg (D02)`
// main(): prints `docs: <n> instruction files, <m> stack files, <e> problem(s)`, each error to stderr, exitCode 1 on any.

// tools/parity.ts
export interface ParityRow {
  /* existing fields */ ticket?: string;
}
//   new errors in evidenceErrors:
//   status 'in-progress' && !evidence?.length && !ticket?.trim() → `${id}: in-progress without evidence or a ticket`
//   ticket !== undefined && !/^#\d+$/.test(ticket)              → `${id}: ticket must be a GitHub issue like #91`

// tools/check-changelog.ts
export interface ChangedFile {
  status: string;
  path: string;
} // from `git diff --name-status --no-renames`
export const FRAGMENT: RegExp; // /^changes\/\d+-[a-z0-9-]+\.md$/
export function changelogErrors(files: ChangedFile[]): string[];
//   added = files with status 'A', path under 'changes/', path !== 'changes/README.md'
//   each added path failing FRAGMENT → `${path}: name a fragment changes/<issue>-<slug>.md`
//   added.length !== 1 → `add exactly one changelog fragment under changes/ (found ${n})`
// main(): diff origin/main...HEAD, else HEAD~1...HEAD, else print 'changelog: no diff base yet, skipping'
//   (same pattern as check-parity-update.ts). Prints a summary; exitCode 1 on errors.

// tools/pii-sources.ts
export const SOURCES: { users: string; tickets: string; workbook: string };
//   'docs/discovery/real-2026-11-13/live/users.json', '.../live/tickets-export.json',
//   '.../cosmos-export-2026-11-11.xlsx'
export interface DenyList {
  names: string[];
  phones: string[];
} // names lower-case, whitespace collapsed; phones = last 10 digits
export interface SourceInput {
  users?: unknown;
  tickets?: unknown;
  workbook?: Buffer;
}
export function denyListFromSources(input: SourceInput): DenyList;
export function loadDenyList(root?: string): DenyList; // throws `pii: source list missing: <path>`
export function workbookCells(
  workbook: Buffer,
): { sheet: string; col: string; row: number; value: string }[];

// tools/check-pii.ts
export function scannedPaths(paths: string[]): string[]; // drops /^docs\/discovery\//, 'pnpm-lock.yaml'
export function scanText(path: string, text: string, deny: DenyList): string[];
//   `${path}:${line}: real name from the source lists` / `${path}:${line}: real phone from the source lists`
//   (at most one per kind per line; the value is never printed)
export function scanFiles(root: string, paths: string[], deny: DenyList): string[]; // skips files with a NUL in the first 8000 bytes
// main(): deny = loadDenyList(); paths = scannedPaths(`git ls-files -z`); prints
//   `pii: <n> names and <m> phones from the source lists; <f> files scanned; <e> problem(s)`; exitCode 1 on any.
```

**Deny-list rules (`denyListFromSources`), exactly:**

- Name candidates:
  - `users.users[].name`;
  - for each `tickets.tickets[]`: `reportedBy`, `startedBy`, `closedBy`, `assignedTo`, `transferTo`, `pausedBy`, and `crew[].name`;
  - workbook cells below a header cell (same sheet, same column, higher row number) whose trimmed lower-case value is `name`, `done by` or `supported by`.
- Every candidate is split on `/[,&/+]|\band\b/i`, trimmed and whitespace-collapsed. A part is dropped when it has fewer than 3 letters (`\p{L}`) or matches the generic-label rule `/^(?:operator|engineer|supervisor|admin|store|technician|maintenance|maint\.?|vendor|production|none|n\/?a)$|\bteam\b|^cell\s*\d+$/i`. Result: unique, lower-case.
- Phone candidates:
  - any string or number value under a JSON key matching `/phone|mobile|whatsapp/i`, at any depth, in `users` and `tickets`;
  - workbook cells below a header cell matching `/^(?:phone|mobile|whatsapp)(?:\s*(?:no\.?|number))?$/i`.
- Normalise a phone candidate as: digits only; keep it only if it has 10–13 digits; store the last 10.

**Workbook reader (`workbookCells`, standard library only).**

- Find the End-of-Central-Directory signature `PK\x05\x06` with `lastIndexOf`; read the entry count at +10 and the directory offset at +16.
- For each central entry (signature `PK\x01\x02`), read:
  - method at +10, compressed size at +20;
  - name, extra and comment lengths at +28, +30 and +32;
  - local header offset at +42, and the name at +46.
- The data starts at local offset + 30 + local name length (+26) + local extra length (+28).
- Method 0 is the raw bytes, method 8 is `zlib.inflateRawSync`; any other method throws `pii: unsupported zip method`. If `xl/sharedStrings.xml` exists, throw `pii: shared strings not supported`, so a changed workbook cannot pass silently. The frozen file uses inline `t="str"` values.
- Each `xl/worksheets/*.xml` is read with `/<c r="([A-Z]+)(\d+)"[^>]*>(?:<f>[^<]*<\/f>)?(?:<v>([^<]*)<\/v>|<is><t[^>]*>([^<]*)<\/t><\/is>)/g`. Values are XML-unescaped (`&amp; &lt; &gt; &quot; &apos; &#n; &#xh;`). `sheet` is the entry path.

**Scan rules (`scanText`).**

- Names: one regex, `(?<![\p{L}\p{N}_])(?:n1|n2|…)(?![\p{L}\p{N}_])` with flags `giu`. Names are sorted longest first and regex-escaped, and each inner space becomes `\s+`. An empty name list matches nothing.
- Phones: `/(?<!\d)\+?\d[\d\s-]{8,15}\d(?!\d)/g`. Normalise each match as above and look it up in the phone set.

**CI (`.github/workflows/ci.yml`).** Every job runs checkout (`fetch-depth: 0`), `pnpm/action-setup@v4` (10.30.3),
`setup-node@v4` (24, pnpm cache) and `pnpm install --frozen-lockfile`. Then:

- `static`:
  - `format:check`, `lint`, `typecheck`, `build`, `parity`, `docs:check`, `pii:scan`, `licences`, `migrations:check`, `audit:lean`;
  - on `pull_request` only: `parity:update` (keeps its `PARITY_ALLOW_SKIP` env), `changelog:check`, `migrations:immutable`, `pr:size` (keeps its `LEAN_ALLOW_LARGE` env).
- `api`: `pnpm exec playwright install --with-deps chromium` (the PDF tests need it), then `pnpm exec vitest run --shard=${{ matrix.shard }}/3`.
- `browser`: the same Chromium install, then `pnpm exec playwright test --shard=${{ matrix.shard }}/2`.
- `secrets`: unchanged.

## 5. Data

| Field                                                                                                                        | Type                                          | Where                                               | Read/write                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `tenant.time_zone` → `Config.timeZone`                                                                                       | `string` (IANA), default `Asia/Kolkata`       | Postgres `tenant`; `GET /api/v1/config`             | read by `SlaTimerSummary`                       |
| `SlaTimer.dueAt`, `SlaTimer.stoppedAt`                                                                                       | `string \| null` (ISO)                        | ticket reply `sla`                                  | read (render gated)                             |
| Per-worker seed rows: `tenant(id, slug, name)`, `segment`, `shift`, `machine`, `person`, `login`, `list_item`, `ref_counter` | the existing columns used by `seedStatements` | the run's throwaway Testcontainer only              | written once per worker process                 |
| `E2E_ADMIN_DATABASE_URL`, `E2E_PASSWORD_HASH`                                                                                | `string` env                                  | set by global setup, read by workers                | test-only; the hash is of the fake e2e password |
| `parity.yaml rows[].ticket`                                                                                                  | optional `string` `#<issue>`                  | `docs/spec/parity.yaml`                             | new optional field; no row sets it now          |
| Source lists (§4 rules)                                                                                                      | JSON / xlsx                                   | `docs/discovery/real-2026-11-13/` (tracked, frozen) | read-only, in memory, never echoed              |

**No schema change, no migration, no new table, no new dependency.** `pg` and `yaml` are already root devDependencies.

## 6. Test cases (Given / When / Then)

Docker is needed for the browser and API tiers. This cloud container has none, so the browser tests go red
and green on the branch's CI. Every `tools/` test is database-free and runs in the stop hook's fast tests.

**Browser** (`apps/web/e2e/`, both projects)

1. **T1 — bug repro, written first.** `sla-timers.spec.ts` ›
   `test.describe('plant time zone')` with `test.use({ timezoneId: 'America/New_York' })` ›
   "shows no SLA due time until the plant time zone loads".
   - **Given:** `ensureSlaConfiguration()` has run, asha has raised a work request with `raiseWorkRequest`, admin is signed in, and `/api/v1/config` is held by `page.route` (same pattern as the "keeps SLA drafts" test).
   - **When:** admin opens `/desk/<id>`.
   - **Then:** the "SLA timers" region contains "min left", has 0 `time` elements and does not contain "Due".
   - **When:** the route is released (in a `finally`).
   - **Then:** the Acknowledge row's `time` is visible, and its text equals `Intl.DateTimeFormat('en-GB', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'Asia/Kolkata'})` applied to its `datetime` attribute.
   - Red before the `SlaTimerSummary` change (a `<time>` renders while config is held).
2. **T2 — regression.** "freezes cached Settings and ticket timers while offline".
   - **Given:** a work-request ticket, with the Acknowledge `<time>` visible.
   - **When:** the page goes offline and the clock moves 2 minutes.
   - **Then:** the timers text is unchanged.
3. **T3 — regression.** "configures policies and future pause rules, then shows ticket timers".
   - **Given:** a previous run left an open ticket on the SLA machine.
   - **When:** the test runs again.
   - **Then:** it passes (`prepareStoppedTicket` cancels first; no 409).
4. **T4 — 20 in a row (evidence).**
   - **Given:** the full SLA file (7 tests).
   - **When:** `pnpm exec playwright test apps/web/e2e/sla-timers.spec.ts --repeat-each=20 --retries=0 --global-timeout=2400000`.
   - **Then:** 280 passed, 0 failed, 0 flaky (7 × 20 × 2 projects).
5. **T5.** `tenant.spec.ts` › "signs in to this worker's own tenant and nowhere else".
   - **Given:** worker `i`.
   - **Then:** `TENANT.slug` is `e2e-w${testInfo.workerIndex}`; `apiLogin('asha')` returns a token; a plain `fetch(\`${API_URL}/api/v1/auth/login\`)` (IP host, no tenant) with asha's credentials answers 404.
6. **T6 — regression.** The whole suite (`pnpm test:e2e`) passes on both projects with per-worker tenants and no assertion changes.
7. **T7 — CI.**
   - **Given:** the PR.
   - **Then:** the jobs `static`, `api (1–3)`, `browser (1–2)` and `secrets` are green, and each finishes in under 8 minutes (`timeout-minutes: 8` makes a slower shard red).

**Docs check** (`tools/docs.test.ts`)

8. **T8.** "fails an instruction file that names another process".
   - **Given:** `[{path:'AGENTS.md', text:'intro\nroute to DeepSeek Flash'}]`.
   - **When:** `processErrors`.
   - **Then:** `['AGENTS.md:2: names a process other than Athena v3 (DeepSeek)']`.
9. **T9.** "flags every process marker" (`it.each` over the 7 markers, each in a one-line text): each gives exactly 1 error with its label. The lower-case word `dsh` gives 0 errors (case-sensitive marker).
10. **T10.** "passes Athena v3 wording": `'Athena v3: Opus plans and reviews, Sonnet builds'` gives `[]`.
11. **T11.** "fails ADR 0001, SPEC or THIRD_PARTY naming Drizzle": `[{path:'THIRD_PARTY.md', text:'| Drizzle ORM | database |'}]` gives `drizzleErrors` = `['THIRD_PARTY.md:1: names Drizzle; the repo uses raw SQL on pg (D02)']`.
12. **T12.** "the repository's instruction and stack files pass".
    - **Given:** the real tree.
    - **When:** `processErrors(readDocs(instructionPaths()))` and `drizzleErrors(readDocs([...STACK_FILES]))`.
    - **Then:** both are `[]`.
    - Red until the documentation edits in tasks 8–11 are done.

**Parity** (`tools/parity.test.ts`)

13. **T13.** "rejects an in-progress row with neither evidence nor a ticket": a row with `status 'in-progress'` and `evidence []` gives an error list containing `'v3.test.04: in-progress without evidence or a ticket'`.
14. **T14.** "accepts an in-progress row with a ticket and no evidence": the same row with `ticket: '#91'` gives no error for that row.
15. **T15.** "rejects a ticket that is not a GitHub issue": `ticket: '91'` gives `'v3.test.06: ticket must be a GitHub issue like #91'`.
    - Existing "passes the schema" stays green on the real ledger.

**Changelog and union merge** (`tools/changelog.test.ts`, `tools/union-merge.test.ts`)

16. **T16.** "accepts exactly one fragment": `[{status:'A', path:'changes/76-green-fast-main.md'}, {status:'M', path:'apps/x.ts'}]` gives `[]`.
17. **T17.** "fails a PR without a fragment": `[{status:'M', path:'changes/70-old.md'}]` gives `['add exactly one changelog fragment under changes/ (found 0)']`.
18. **T18.** "fails a PR with two fragments": two `A` fragments give `[... '(found 2)']`.
19. **T19.** "fails a badly named fragment and ignores the README":
    - `[{A,'changes/notes.md'}, {A,'changes/README.md'}]` gives the name error for `changes/notes.md` and no count error (found 1).
20. **T20.** "merges two appended wiki/log.md lines without a conflict".
    - **Given:** a temp git repo (`mkdtemp`) with this repo's `.gitattributes`, a committed `wiki/log.md` holding `base`, branch `a` appending `line a`, and `main` appending `line b`. Git runs with `-c user.name=Test -c user.email=test@example.invalid`.
    - **When:** `git merge a --no-edit`.
    - **Then:** exit 0, and the file contains `base`, `line a` and `line b`.
    - Red without `.gitattributes` (merge conflict).

**PII scan** (`tools/pii.test.ts`). No real value is ever written to disk outside the temp dir, or into an assertion message.

21. **T21.** "fails on a planted real name from the source lists".
    - **Given:** `deny = loadDenyList()`, `name = deny.names[0]`, and a temp dir with `planted.md` = `Reported by ${name}\n` (title-cased with `toUpperCase` on the first letter of each word, to prove case-insensitivity).
    - **When:** `scanFiles(tmp, ['planted.md'], deny)`.
    - **Then:** exactly 1 error equal to `'planted.md:1: real name from the source lists'`, and no error contains `name`.
22. **T22.** "passes the same file without the planted name": `planted.md` = `Reported by a fake person\n` gives `[]`.
23. **T23.** "fails on a planted phone in every written form".
    - **Given:** `deny = denyListFromSources({users: {users: [{name: 'Fake Person', phone: '+91 90000 00001'}]}})`.
    - **When:** scanning lines `9000000001`, `+91-90000-00001`, `09000000001`, `+919000000001`.
    - **Then:** 4 errors, `'p.md:1…4: real phone from the source lists'`; the line `9000000002` gives none.
24. **T24.** "ignores generic labels":
    - `denyListFromSources({users: {users: [{name:'Operator'}, {name:'Maint. Team'}, {name:'Cell1'}, {name:'AB'}, {name:'Fake Person'}]}})` gives `.names` equal to `['fake person']`.
25. **T25.** "reads names from the workbook":
    - **Given:** the real workbook buffer and the real JSON sources.
    - **Then:** the deny-list built from all three has more names than the one built from the JSON alone (compared as counts only).
26. **T26.** "fails loudly when a source list is missing": `loadDenyList(emptyTmpDir)` throws `/pii: source list missing/`.
27. **T27.** "never scans the source lists": `scannedPaths(['docs/discovery/real-2026-11-13/live/users.json', 'pnpm-lock.yaml', 'apps/x.ts'])` gives `['apps/x.ts']`.
28. **T28.** "the repository holds no real name or phone outside docs/discovery".
    - `scanFiles(root, scannedPaths(gitLsFiles()), loadDenyList())` gives `[]`.
    - The same check runs in CI as `pnpm pii:scan`.

## 7. Tasks (in order; one acceptance assertion each; red first, then green)

| #   | Files (≤3 unless noted)                                                                                                                                                                                                                                                             | Red → green                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `sla-timers.spec.ts` (T1 only), `SlaTimerSummary.tsx`                                                                                                                                                                                                                               | T1 red on CI, then the `timeZone &&` gates → T1 green. Command: `pnpm exec playwright test apps/web/e2e/sla-timers.spec.ts -g "time zone"`                                                                                                                                                 |
| 2   | `sla-timers.spec.ts` (T2, T3 edits)                                                                                                                                                                                                                                                 | `pnpm exec playwright test apps/web/e2e/sla-timers.spec.ts --repeat-each=3 --retries=0` green (T4 is task 15)                                                                                                                                                                              |
| 3   | `fixtures.ts`, `test.ts` (new), `tenant.spec.ts` (new)                                                                                                                                                                                                                              | T5 red (env not published yet)                                                                                                                                                                                                                                                             |
| 4   | `stack.ts`, `playwright.config.ts`, `vite.e2e.config.ts`                                                                                                                                                                                                                            | T5 green: `pnpm exec playwright test apps/web/e2e/tenant.spec.ts`                                                                                                                                                                                                                          |
| 5   | `admin`, `board`, `desk` specs (mechanical import/`apiFetch` swap)                                                                                                                                                                                                                  | those three files green                                                                                                                                                                                                                                                                    |
| 6   | `floor`, `offline`, `settings-severity` specs                                                                                                                                                                                                                                       | those three files green                                                                                                                                                                                                                                                                    |
| 7   | `sla-timers.spec.ts`, `tags.spec.ts`, `sla-test-helpers.ts`                                                                                                                                                                                                                         | T6: `pnpm test:e2e` all green                                                                                                                                                                                                                                                              |
| 8   | `tools/parity.ts`, `tools/parity.test.ts`, `docs/spec/parity.yaml` (comment)                                                                                                                                                                                                        | T13–T15 red → green: `pnpm exec vitest run tools/parity.test.ts`                                                                                                                                                                                                                           |
| 9   | `tools/check-docs.ts`, `tools/docs.test.ts`, `package.json` (`docs:check`)                                                                                                                                                                                                          | T8–T11 green; T12 red                                                                                                                                                                                                                                                                      |
| 10  | `docs/adr/0001-stack.md`, `docs/spec/SPEC.md`, `THIRD_PARTY.md`                                                                                                                                                                                                                     | the Drizzle half of T12 green                                                                                                                                                                                                                                                              |
| 11  | DSH retirement: (a) delete `docs/orchestration.yaml` and `tools/check-orchestration.ts`, `package.json` scripts/verify, `D18`; (b) `CLAUDE.md`, `AGENTS.md`, `docs/HANDOFF.md`; (c) `ORCHESTRATION.md`, `BUILD-PROTOCOL.md`, `REVIEW-MECHANISMS.md`; (d) `SKILLS.md`, `WORKFLOW.md` | T12 green; `pnpm docs:check` exit 0. Any line still reported is fixed by deleting the DSH-only text or replacing it with the Athena v3 equivalent (harness model table). Never by weakening a marker.                                                                                      |
| 12  | `tools/check-changelog.ts`, `tools/changelog.test.ts`, `package.json` (`changelog:check`)                                                                                                                                                                                           | T16–T19 red → green                                                                                                                                                                                                                                                                        |
| 13  | `.gitattributes`, `tools/union-merge.test.ts`                                                                                                                                                                                                                                       | T20 red (no attributes) → green                                                                                                                                                                                                                                                            |
| 14a | `tools/pii-sources.ts`, `tools/pii.test.ts` (T23–T26)                                                                                                                                                                                                                               | red → green: `pnpm exec vitest run tools/pii.test.ts`                                                                                                                                                                                                                                      |
| 14b | `tools/check-pii.ts`, `tools/pii.test.ts` (T21, T22, T27, T28), `package.json` (`pii:scan`)                                                                                                                                                                                         | red → green; `pnpm pii:scan` exit 0                                                                                                                                                                                                                                                        |
| 15  | `.github/workflows/ci.yml`                                                                                                                                                                                                                                                          | push; T7 green; record the shard times in §9                                                                                                                                                                                                                                               |
| 16  | Evidence T4                                                                                                                                                                                                                                                                         | Locally where Docker exists: the T4 command. Otherwise in CI: one commit adds a temporary job `sla-repeat` (`timeout-minutes: 45`, the same setup steps plus the Chromium install, running the T4 command). Record the run URL and the counts in §9, then the next commit deletes the job. |
| 17  | Bookkeeping (docs only, see below)                                                                                                                                                                                                                                                  | `pnpm verify` green; `pnpm changelog:check` green                                                                                                                                                                                                                                          |

**Task 17, exactly.**

- `changes/README.md`, `changes/76-green-fast-main.md` (bullets, each a user-visible or contributor-visible change):
  - SLA due times wait for the plant time zone;
  - browser tests use one tenant per worker;
  - CI runs in sharded jobs under 8 minutes;
  - the docs, changelog and PII checks;
  - one process (D18).
- `CHANGELOG.md`: the note line.
- `docs/plan/MILESTONES.md`: row 01 → `done`, PR `#<n>`.
- `docs/plan/ledger.md`: create it on this branch with exactly the first three lines of `origin/claude/orchestrator-ledger:docs/plan/ledger.md` (title, blank line, the "One line per event…" line), a blank line, then `- 2026-11-13 · 01 PR #<n> — SLA x20: <passed>/280; shards static <m>, api <m>/<m>/<m>, browser <m>/<m>; docs, changelog and PII checks proven by planted violations (T8–T28)`.
- `wiki/log.md`: append `2026-11-13 — Ticket 01 Green, fast main (#<n>): SLA due times wait for the plant zone; one seeded tenant per Playwright worker; CI sharded (static, api×3, browser×2, each < 8 min); docs/parity/changelog/PII guards; DSH routing retired (D18).`
- `docs/HANDOFF.md` (rewritten in task 11b; refresh here):
  - State: `main` has M2-2.2 (#74), the milestone plan (#75) and ticket 01 merged.
  - The only process is Athena v3 (D18).
  - Frontier: 02, 08, 10, 13.
  - CI shape and the per-worker e2e tenants.
  - Blocked/external: N1, N11, N12, N5, and production backup/security sign-off.
  - Under 50 lines.
- PR: body says what changed for a user, which tests prove it, and how to try it (open a ticket and watch the SLA panel). It contains `Closes #76`. Labels: see question 1.

## 8. Out of scope

- `Timeline` and `PeopleSection` in `TicketDetail.tsx` also format with `config?.timeZone` before config loads. This is the same class of bug, but the ticket names only the SLA timer. Proposed follow-up issue.
- Selecting API tests by touched module (ticket 03, once modules exist); moving full journeys to staging (13).
- Pseudonymised fixtures and loading real people (ticket 08); `merge=union` for `docs/plan/ledger.md` (question 4).
- Folding the `changes/` fragments into a release (no release yet); rewriting old `wiki/log.md` lines (append-only), ROADMAP or spike docs (history, not instruction files).
- Vendored `.claude/skills/**` (installed by the harness, pinned by `skills.lock.json`).
- Any server, schema or API change.

**Regression risk.**

- Every e2e spec changes its imports and the stack no longer seeds `cosmos`: T6 must be green on both projects.
- Removing `orchestration:check` from `verify`.
- The CI job split must still run every check the old `checks` job ran: compare the step lists one by one in review.

## 9. Evidence (filled by the builder)

- T4 SLA ×20: _command, where, passed/failed/flaky, run URL_
- Shard times (run URL): static _m_, api 1/2/3 _m_, browser 1/2 _m_
- T1 red run (before the fix) and green run: _run URLs_

## 10. Questions for the orchestrator

1. **PR shape.** About 1,050 changed code lines (about 110 of them from deleting `check-orchestration.ts`; docs excluded) is over the 800 hard limit. Default if not answered: one PR with `size:large` and the reason "ticket 01 bundles three process goals". The alternative is three PRs from this plan: tasks 1–7 + 15–16, tasks 8–13, tasks 14a–b; the last one carries `Closes #76`. The plan works either way. `no-parity` is not needed: `parity.yaml` changes legitimately (task 8).
2. **Phones (for Nimish, plain English).** "The Cosmos files we have (logins, tickets, the platform export) contain no phone numbers. The scan checks every real name now, and will check phone numbers from any list that contains them. Is there a list of the team's real phone numbers (for example for the 26 logins), and where is it?" Non-blocking: the phone check is built and proven on made-up numbers.
3. **Retiring the DSH / hosted-free-coder route (#73, two commits ago)** by editing the repo `CLAUDE.md` and `AGENTS.md`. The plan follows BRIEF scope 1 and ROADMAP H1. Please confirm before task 11 runs, since `CLAUDE.md` is a governing file.
4. **Ledger.** `docs/plan/ledger.md` exists only on `claude/orchestrator-ledger` (PR #144). Creating it here per your ruling gives #144 an add/add conflict on rebase. Do you want `docs/plan/ledger.md merge=union` added to `.gitattributes` in this PR (one line)? Default: not added.
5. Note, no answer needed: `merge=union` applies to local merges and rebases, which is how the merge queue rebases. Whether GitHub's web merge honours it is not verified.
