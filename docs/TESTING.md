# Testing

Tests are the executable memory of the rules. A test that cannot fail is not a test; a test weakened to go green is a failed review.

## 1. Layers

| Layer         | Tool                                  | What it proves                                                                                                                                   |
| ------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit          | Vitest                                | `packages/domain` pure functions: state machine, figures, severity, SLA maths, permissions                                                       |
| Property      | Vitest + fast-check (later)           | Cached figures equal recomputed; a command applied twice with the same idempotency key has one effect; state transitions never lose an invariant |
| Integration   | Vitest + Testcontainers Postgres      | Migrations, RLS, constraints, indexes, the generic isolation suite                                                                               |
| Contract      | Vitest + Zod                          | A handler agrees with its request/response schema; every command’s error envelope                                                                |
| End-to-end    | Playwright                            | A real ticket through the floor and desk; offline replay; PDF download; a 409 draft                                                              |
| Visual        | Playwright screenshots                | A component or screen changes only with a reviewed baseline                                                                                      |
| Accessibility | axe in Playwright                     | WCAG AA; no serious/critical violation; keyboard path                                                                                            |
| PDF           | `pdf-parse` + pixel snapshot          | Gujarati fields are present; glyphs render; page 1 matches                                                                                       |
| Offline       | Playwright `context.setOffline(true)` | The four queued writes replay; a replay onto a closed ticket becomes a draft, never a silent drop                                                |
| Performance   | Playwright + a timing budget          | `/state` under 300 ms for 500 machines; Open/Live under 2 s on a low-end profile                                                                 |
| Security      | Vitest + a human checklist            | RLS isolation; cross-tenant = not_found; rate limits; webhook signature; no secrets in logs                                                      |
| Migration     | `tools/check-migrations.ts`           | A destructive migration fails unless it carries an approved expand/contract plan and a backup step                                               |

## 2. The domain is the priority

`packages/domain` is pure and 100% branch-covered. The test names use the domain language:

- `ticket.state-machine.test.ts` — one test per command per allowed/forbidden role.
- `ticket.figures.test.ts` — one table per figure definition in `DOMAIN.md` §5, plus the edge cases: two people overlapping, lead pauses while support works, transfer gap, running/stopped twice, restore, correction overrides, self-started (response null), support upgraded to stopped, NO DT.
- `ticket.permissions.test.ts` — the permissions matrix as a table; every cell.
- `sla.test.ts` — fake clock; ack/restore/pause/handback; business hours off by default.
- `task.test.ts` — pending/overdue/done; `task_down_min` 0–1440; not added to parent downtime.

A bug starts with a failing test that reproduces it. The regression test stays.

## 3. Database and isolation

- Testcontainers Postgres 16 for every database test.
- Migrations run from zero and from the previous release (expand/contract).
- The generic isolation test introspects `public` tables, inserts one row per tenant per table through a factory, and asserts tenant A sees one row and tenant B sees none. A new table without a factory fails the suite.
- A dev assertion throws when a query runs without `app.tenant_id`.
- A cross-tenant id returns `not_found`, not `forbidden`.

## 4. End-to-end and devices

Playwright profiles: Pixel 5 (low-end Android class), iPhone 13, desktop. The floor flow is tested at 360 px first. The board is tested in kiosk mode at 1920×1080. Offline is a first-class test, not a manual note.

## 5. Fixtures and real data

- No real personal data in tests, fixtures, screenshots or logs. Use fake names and fake phone numbers.
- Cosmos seed fixtures are allowed only where a ticket says so and are labelled `cosmos`; the raw discovery files stay in `docs/discovery/` and are not copied into app fixtures.
- The answer key is `fixtures/answer-key/<screen>.json`, generated by the Playwright script from the platform HTML at a frozen as-of date; it is committed and reproducible.
- A reconciliation report may contain counts and hashes, not personal data.

## 6. CI

Every PR runs: format check, lint (including no string literals in JSX), strict typecheck, unit/property, integration + isolation, contract, Playwright (where a screen changed), axe, visual snapshots, PDF checks, offline, migration check, licence allowlist, secret scan, parity validation, build.

A red check blocks merge. A flaky test is fixed or quarantined with an owner and a date; it is not retried into green.

## 7. Manual and gate tests

A milestone gate report gives Nimish ten steps to try on staging. A `gate-manual` item is not “done” until he has tried it and the gate report says so. A push on a real Android and an installed iOS PWA is a manual check; the payload contract is automated.

## 8. Commands (after scaffold)

```bash
pnpm install
pnpm dev            # local web + server (from M0.1)
pnpm test           # unit + integration
pnpm test:e2e       # Playwright
pnpm lint
pnpm typecheck
pnpm parity         # validate docs/spec/parity.yaml
pnpm licences       # licence allowlist
pnpm migrations:check
pnpm verify         # everything CI runs
```

## 9. Coverage and flake policy

- Domain: 100% branches.
- API/handlers: every command and every error code has a test.
- UI: the four states (empty, loading, error, offline) and the role’s primary task; not every presentational branch.
- Flake: >1% over a week is a ticket. Retries are for diagnosis, not for green.
- A test that is slow because it is end-to-end stays end-to-end; speed is not a reason to test the implementation instead.
