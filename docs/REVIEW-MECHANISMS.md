# Review mechanisms

Every claim about the product is backed by an artifact: a plan, a test, a CI run, a reviewer verdict, a parity row, or a gate report. Opinion is not evidence.

## 1. Principles

1. **No self-review.** The author never reviews their own work. A fresh context reads the plan, the diff and the CI result.
2. **Risk-proportional.** A copy change does not need a schema review; a migration, an auth change or a tenancy change needs three.
3. **Evidence, not vibes.** Every finding cites a file and line and names the fix. A `PASS` with no evidence is a failed review.
4. **The reviewer is read-only.** Reviewers do not edit code; the author fixes.
5. **Tests are the first reviewer.** A test that cannot fail is not a test. A suite that was weakened to go green is a failed review.
6. **Human at the irreversible points.** Security isolation, the cutover, and a new tenant get a human sign-off.
7. **Review the reviewer.** A false pass is a defect; sample audits and checklist versions keep reviewers honest.

## 2. Risk tiers: how much review a change gets

| Tier                                           | Examples                                                                       | Required reviews                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **R0 — docs and copy**                         | README, a label, a comment, a non-behavioural doc                              | Self-check, link check; no reviewer required                                                                  |
| **R1 — UI only**                               | A screen, a component, a layout, a chart                                       | Plan (light), tests, code review, design/accessibility review                                                 |
| **R2 — domain or API**                         | A ticket command, a figure, a permission, an endpoint, a job                   | Plan review, tests (unit + integration), code review, contract review, concurrency/idempotency where relevant |
| **R3 — schema, auth, tenancy, money, cutover** | A migration, RLS, login/session, import, SLA money figures, production cutover | Plan review + architecture review + schema review + code review + security review + human sign-off            |

A PR that mixes tiers is split. The highest tier in the diff decides the review.

## 3. The review ladder

| #   | Review                     | Who                                                | Checklist                                                                                                                                                                                                                        | Evidence                                         | When                                              |
| --- | -------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| 1   | **Plan review**            | `plan-reviewer` (fresh context)                    | Every file, interface, field and test named; Given/When/Then tests that fail first; vertical; own interface; regression risk                                                                                                     | `docs/slices/<ticket>.md`                        | Before code                                       |
| 2   | **Architecture review**    | `architecture-reviewer` (fresh context)            | Modular monolith unless reasoned; one interface per module; no cross-module DB access; versioned contracts; single source of truth; failure and idempotency at boundaries; observability; security; simplest stack; traceability | `docs/adr/`, module map                          | Any new module or boundary change                 |
| 3   | **Schema review**          | `schema-reviewer` (fresh context)                  | Tables match the data map; normalised; keys/constraints/indexes for known queries; personal and child data minimised and scoped; reversible migrations, no silent loss; audit fields; every slice covered                        | migration + `docs/spec/DOMAIN.md`                | Any table, column, key, index or migration        |
| 4   | **Test review**            | CI + `code-reviewer`                               | Tests came first; no test deleted, skipped or weakened; the new test fails without the code; domain branch coverage 100%                                                                                                         | CI run + commit order                            | Every PR                                          |
| 5   | **Code review**            | `code-reviewer` (fresh context)                    | Matches the plan exactly; nothing extra; boundaries; errors handled at boundaries; no secrets or real data; data safety; whole suite green                                                                                       | PR diff + plan + CI                              | Every PR                                          |
| 5b  | **Lean review**            | `code-reviewer` + `docs/LEAN.md`                   | Smallest complete change; nothing to delete; no one-use abstraction; no new dependency without an ADR; file/function budgets; shortcut ledger                                                                                    | Size report, dependency diff, review notes       | Every PR                                          |
| 6   | **Security review**        | Human (before cutover and plant two) + checklist   | RLS forced and tested; `app_router` narrow; session/token handling; webhook signature; rate limits; CSP; secrets; file upload; PDF escaping; dependency audit                                                                    | threat model + test output                       | R3, then before cutover, then before a new tenant |
| 7   | **Design review**          | `impeccable` + `docs/DESIGN.md` + design checklist | Role and task obvious; one primary action; type/spacing/colour tokens; empty/loading/error/offline states; 52 px targets; WCAG AA; Gujarati/Hindi text; low-end phone                                                            | screenshots + axe + Playwright                   | Every user-facing screen                          |
| 8   | **Data and parity review** | Data reviewer + `parity.yaml`                      | Import reconciliation; answer-key fixtures; every “keep” row has a test; deliberate differences logged                                                                                                                           | reconciliation report, fixtures, parity counts   | M1b, M4a, each gate                               |
| 9   | **Operational review**     | Lead + checklist                                   | Deploy and rollback work; migrations expand/contract; restore drill executed; `/health`; failed-jobs page; alarms; cost caps; backups                                                                                            | staging run + drill log                          | M0, M1b, each gate                                |
| 10  | **Gate review**            | Nimish + lead + human senior engineer (M1b/M5)     | Scope done/not done; parity counts; test counts; lean audit; quality scorecard; ten steps to try; risks; go/no-go                                                                                                                | `docs/plan/gates/M<n>.md`, `docs/QUALITY-BAR.md` | End of a milestone                                |
| 11  | **Post-merge**             | CI + staging smoke + monitoring                    | Deploy green; smoke test; error rate; timer lag; rollback ready                                                                                                                                                                  | staging URL + logs                               | Every merge                                       |

## 4. Architecture review, concretely

The fixed checklist (from `.claude/agents/architecture-reviewer.md`):

1. **Modular monolith by default.** A separate service needs a written reason: different scaling, a different team, or failure isolation.
2. **Clear boundaries.** Each module owns one job and one published interface.
3. **No cross-module database access.** A module reads and writes only its tables; others go through its interface. (For this build, the pragmatic exception is the shared `packages/db` schema; the review checks that a module’s queries are confined to its own tables, not that every module owns a separate connection.)
4. **Contracts.** Every API and event contract is versioned and documented; Zod schemas are the source.
5. **Single source of truth.** Each fact has one owner; cached copies say where they come from and how they stay fresh.
6. **Failure at boundaries.** Every cross-boundary call says what happens on timeout or error; retries are idempotent.
7. **Observability.** Logs and errors are named per module with tenant and request ids; no personal data in logs.
8. **Security by default.** Auth at the edge, least privilege, secrets outside code.
9. **Simplest stack.** Nothing heavier than the brief needs; each part names why it beat a simpler one.
10. **Traceability.** Every choice traces to a requirement; nothing is designed that the brief did not ask for.

**For this product, the review also asks:**

- Does the tenant come from the host, never a client parameter?
- Is every new table covered by the generic isolation test?
- Is the ticket command replay-safe, and is the row locked?
- Does the figure come from the pure `figures()` function, not a handler?
- Does the job carry its tenant and set it before any query?
- Is the change configuration, not a Cosmos constant?
- Is there a rollback path for the deploy and the migration?

## 5. Backend capability review

Each backend capability has a named proof, not a claim.

| Capability                                                                                       | Proof                                                                                                                                              |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticket state machine                                                                             | One test per command per role; property test that cached figures equal recomputed; a concurrency test for two starts and a replay test for a close |
| Figures (response, hands-on, repair, waiting, vendor, handover, downtime, follow-up, per-person) | Golden tests from the exact definitions in `DOMAIN.md` §5; a fixture per edge case; reconciliation against Bhavin’s stored values on import        |
| Permissions                                                                                      | The permissions matrix is the test table; every cell server-checked                                                                                |
| RLS and tenancy                                                                                  | The generic isolation test on every table, two tenants, zero cross-reads; a dev assertion when `app.tenant_id` is unset                            |
| Idempotency                                                                                      | Every command with an `Idempotency-Key`; a replay returns the first result; a create-idempotency table for `raise`                                 |
| SLA timers and escalation                                                                        | Fake-clock tests for every timer path; missed ack → L2, missed restore → L3, critical still down → L4; repeat caps                                 |
| Jobs and retries                                                                                 | Provider contract tests; dead-letter table; a failed-jobs page; a timer-lag alarm                                                                  |
| PDFs                                                                                             | Text extraction for Gujarati fields; a page-1 pixel snapshot; a font test; a render timeout test                                                   |
| WhatsApp                                                                                         | Recorded webhook payload contracts; signature verification; 24-hour window state; template registry; media copied before the URL expires           |
| Imports                                                                                          | A fake export fixture; idempotent by Bhavin’s ticket id; reconciliation report; `import:undo`                                                      |
| Analytics engine                                                                                 | Answer-key fixtures from the platform; deterministic seed; every fixture number matches exactly; a backtest score                                  |
| Backups and restore                                                                              | A restore drill executed in M0 and quarterly; the output committed                                                                                 |
| Performance                                                                                      | `/state` under 300 ms for a 500-machine plant; Open and Live under 2 seconds on a low-end Android over 3G; a synthetic load test before M5         |
| Cost rails                                                                                       | Per-channel caps as settings with tests; a billing alarm; a cap-hit pauses the queue and tells the admin                                           |

## 6. Automated gates (every PR)

| Gate                   | Tool                                                                                               | Fails when                                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Format / lint          | Prettier, ESLint (including the no-literal-strings rule)                                           | Any violation                                                                                             |
| Types                  | `tsc --noEmit` strict                                                                              | Any error                                                                                                 |
| Unit and domain        | Vitest                                                                                             | Any failure; domain coverage below 100%                                                                   |
| Database and isolation | Testcontainers Postgres                                                                            | Any migration or isolation failure                                                                        |
| API contracts          | Vitest + Zod                                                                                       | A handler disagrees with its schema                                                                       |
| End-to-end             | Playwright (phone and desktop profiles)                                                            | Any flow failure                                                                                          |
| Accessibility          | axe in Playwright                                                                                  | Any serious/critical violation                                                                            |
| Visual                 | Playwright screenshots                                                                             | A component or screen changes without a reviewed baseline                                                 |
| PDF                    | Text extraction + pixel snapshot                                                                   | Missing glyph or changed layout                                                                           |
| Offline                | Playwright `context.setOffline(true)`                                                              | A queued close does not replay or a 409 is dropped                                                        |
| Migration check        | Custom script                                                                                      | A destructive migration without an expand/contract plan                                                   |
| Licence                | `license-checker` allowlist                                                                        | A non-permissive dependency                                                                               |
| Secrets                | `gitleaks` or equivalent                                                                           | A key, token or real personal data in the diff                                                            |
| Parity                 | `parity.yaml` check                                                                                | A `done` row has no test, or an unknown id is referenced                                                  |
| Lean budgets           | `tools/check-size.ts`, `tools/check-deps.ts`, `tools/check-pr-size.ts`, `tools/check-shortcuts.ts` | A file/function over budget, a new dependency without an ADR, a huge PR, or a shortcut outside the ledger |
| Build and bundle       | Vite build + size budget                                                                           | The build fails or the bundle exceeds its budget                                                          |

## 7. Reviewer independence and the DeepSeek caveat

- The reviewer gets a **fresh context**: the plan, the diff, the CI result and the checklist. It does not get the author’s reasoning or the whole conversation.
- In this DSH session only DeepSeek models are available, so “fresh context” is weaker than a different model family. We compensate with fixed checklists, file:line evidence, the risk tiers, static analysis and a human security review. If exact model diversity is required, the build runs in Claude Code, or we add a human reviewer for R3 changes.
- **Adversarial review** is used on R3 and on the analytics port: one pass argues the change is correct, a second pass actively tries to break it (wrong tenant, replayed command, back-dated time, overlapping crew, shift midnight, NO DT, a blank code, a long Gujarati string).
- **Review of reviewers:** each month a sample of merged PRs is re-reviewed by a fresh reviewer. A false pass becomes a ticket against the checklist, not against the author.

## 8. Metrics that tell us review is working

- First-pass yield: share of PRs that pass review without a fix round.
- Escaped defects: bugs found after merge, per milestone.
- Parity burn-down: `done / total` per milestone, from `parity.yaml`.
- Test counts and flake rate.
- Review cycle time and blocked age.
- Rollbacks per month.
- Security findings closed vs open.
- Cost per milestone (tokens and infrastructure).

A milestone gate reports these numbers and the senior-engineer scorecard (`docs/QUALITY-BAR.md`). “It looks good” is not a metric.

## 9. What Nimish is asked to review

Only what a product owner can judge: does this screen do the right job for this role; is the wording right; is the flow acceptable; does the handback/escalation policy match the plant; is the cutover safe. Not code, not architecture, not library choices, not test seams. The gate report tells you what to try in ten steps and what question needs your answer.
