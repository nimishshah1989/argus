# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE

**Process:** pstack (`CLAUDE.md`, D23). **Plan:** `docs/plan/MILESTONES.md` (68 tickets; tracker at the top wins).
**Ledger:** `docs/plan/ledger.md` (every dispatch, ruling and merge, one line each).

**M0 (14 tickets): 10 merged**: 01, 02, 03, 04, 05, 06, 08, 10, 11, 13 (+ side PRs 01b, 13b, 04b).
**In flight when this was written** (finish or restart them): 07 (history cannot be lost: schema, 54 tests,
branch `claude/t07-history-cannot-be-lost`), 12 (page patterns: wizard, settings, dashboard, board; branch
`claude/t12-page-patterns-more`), a CI-friction fix (auto labels, `pnpm precheck`, 57P01 teardown).
**Then:** 09 (real tickets in) → 14 (staging holds Cosmos, safe to run) → the M0 gate report
`docs/plan/gates/M0.md` → Nimish's go → move `ready-for-agent` from M0 to M1 issues.

## Staging (AWS, account 118167167649, ap-south-1)

- Server `i-0c8debfdec0da8209`, Elastic IP 3.108.95.203, `m6g.large` in zone c (t4g.medium had no capacity),
  RDS up, site_url `https://cosmos.3-108-95-203.sslip.io`. Nothing answers until the first deploy.
- First deploy needs: ticket 07 merged (RDS-compatible roles), GitHub secret `AWS_ROLE_ARN` (Nimish, withheld
  until then), `ROUTER_DATABASE_URL` on the server (ticket 14), a free outside uptime pinger.

## Decisions waiting for Nimish at the gate

- Pick the accent (blue or deep teal) on `/gallery`; review the 31 status labels (copy written by agents).
- DATA-MAP §5 wording from ticket 07; Q25 default (offboarding proof lives in the audit row, files in the
  backup bucket); offboarded-tenant stub keeps customer name; billing alarm = existing USD 150 budget.
- Tag data: existing rows are exported before `ticket_tag` is dropped (07).

## Follow-ups logged (not yet tickets)

Server accepts what the Spec forbids (05); make the server call `availableActions`; raise-race 500 → 'already
open' (15); phones for admins on the people screen (21); `must_change_password` not enforced (21); seed
fixture mode wipes tenant (14); admin group for switched-off list entries; boundary tool gaps (template
`import()`, `LOCK`/`COPY`/`TRUNCATE` lists); PR #158's `ai_suggestion` vs `erase_person`; e2e API rate limit.

Nimish may merge small PRs when all 8 checks are green (not DB, permissions, tenancy, deletes) and tells the
orchestrator the number. Agents cannot force-push or delete tests: he deletes test files by hand.

<!-- prettier-ignore-start -->
<!-- facts: written by the session-end hook -->
Last session ended 2026-11-13 14:22 UTC on branch `claude/orchestrator-ledger`.
- 11cfa8b docs(plan): ledger — #168 merged
- 57a6019 merge main (#168 merged)
- f93fd76 chore(process): one plan, one CLAUDE.md; remove stale docs and Athena v3 leftovers (#168)
Uncommitted files: 0
<!-- end facts -->
<!-- prettier-ignore-end -->
