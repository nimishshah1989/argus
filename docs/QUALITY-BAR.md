# Quality bar — the 9/10 senior review

The target is **9/10 average, no category below 8**, with evidence. A 10 is not the goal; 9 means a senior engineer would ship it and defend it, not that it is perfect.

## 1. When it is scored

- At **M1b** (the soft cutover) and **M5** (plant two), by a human senior engineer plus the lead.
- At any gate where the change is R3 (schema, auth, tenancy, money, cutover).
- Every PR gets the small version: the review checklist in `docs/REVIEW-MECHANISMS.md` and the lean pass in `docs/LEAN.md`.

## 2. The ten categories

| #   | Category                          | What 9 looks like                                                                                                                             | Evidence                                      |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1   | Architecture and boundaries       | Modular monolith; each module owns its job and one interface; no cross-module DB access; dependency direction is obvious; no circular imports | Module map, import graph, architecture review |
| 2   | Simplicity and size               | No abstraction with one use; no unrequested option; file/function budgets met; dependency count justified                                     | `pnpm audit:lean`, review findings            |
| 3   | Correctness and tests             | Domain 100% branches; every command and figure tested; property tests for invariants; no skipped/weak tests; bugs have regression tests       | Test report, coverage, CI                     |
| 4   | Data and migrations               | Every tenant table has RLS; keys, constraints, indexes; expand/contract; backup before destructive; import reversible                         | Schema review, isolation suite, restore drill |
| 5   | Security and tenancy              | Host tenancy; forced RLS; one auth path; secrets outside code; rate limits; CSP; no real data in tests; OWASP ASVS L1 self-check              | Security review, threat model, pen-test notes |
| 6   | Failure and resilience            | Every boundary handles timeout/error; retries idempotent; dead letters; rollback works; offline queue never silently drops                    | Fault-injection tests, rollback drill         |
| 7   | Performance and scale             | `/state` <300 ms for 500 machines; Open/Live <2 s on a low-end Android/3G; board 60 fps; no N+1; indexes for known queries                    | Measured on staging, load test                |
| 8   | Observability and operations      | JSON logs with tenant/request ids; `/health`; failed-jobs page; timer-lag alarm; cost caps; restore runbook                                   | Runbook, dashboards, drill log                |
| 9   | UX and accessibility              | Every screen has a role, one primary action, four states, 52 px targets, WCAG AA, Gujarati/Hindi, tested on a phone                           | Design QA, axe, usability notes               |
| 10  | Documentation and maintainability | A new engineer can run it and find the why; ADRs for choices; no stale docs; no `shortcut:` without a trigger                                 | README, ADRs, handoff, lean audit             |

## 3. Scoring rules

- Each category is scored 0–10 with a one-line reason and a link to evidence.
- **Gate pass:** average ≥9.0 and no category <8. A 7 is a blocker, not a rounding error.
- A score without evidence is not a score.
- The human reviewer may lower a score the lead gave; the lead may not raise the human’s score without new evidence.
- The scorecard is committed in the gate report (`docs/plan/gates/M<n>.md`).
- A “10” is allowed but never required; chasing it creates the bloat this repo is trying to avoid.

## 4. What a senior reviewer is asked

1. Read the architecture and the module map; find the one place where a boundary is crossed.
2. Read the schema and the policies; try to see another tenant’s row; try a query without `app.tenant_id`.
3. Read the ticket state machine and the figures; try a back-dated close, a replayed command, two starts, a pause while support works.
4. Read the auth path; try a stolen/revoked token, a shared phone, a cross-tenant id.
5. Read the deploy and the migration; roll back one release; restore one backup.
6. Read the biggest files and the dependency list; ask what can be deleted.
7. Read the tests; find one that cannot fail.
8. Use the product on a phone as an operator, a technician and a head.

The output is the scorecard plus numbered findings, each with a file, a fix and the risk if skipped. “Looks good” is not a review.
