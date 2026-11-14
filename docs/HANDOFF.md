# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE

**Process:** pstack (`CLAUDE.md`, D23). **Plan:** `docs/plan/MILESTONES.md` (68 tickets; tracker at the top wins).
**Ledger:** `docs/plan/ledger.md` (every dispatch, ruling and merge, one line each). Orchestrator stopped here
on Nimish's instruction so he can restart on the new harness; no builder session is running.

**M0 (14 tickets): 12 merged**: 01–08, 10–13 (+ side PRs 01b, 13b, 04b, CI friction #170).
**Left in M0:** 09 (real tickets in; blocked by 07 + 08, both merged: READY) and 14 (staging holds Cosmos, safe to
run; blocked by 09 + 13). Then the M0 gate: `docs/plan/gates/M0.md`, Nimish tests staging on his phone, picks
the accent, reviews the 31 status labels, then moves `ready-for-agent` from M0 to M1 issues.
09 may overlap `docs/plan/CLAUDE-ADOPTION.md` (import pack): read it first.

## Staging (AWS, account 118167167649, ap-south-1)

- Server `i-0c8debfdec0da8209`, Elastic IP 3.108.95.203, `m6g.large` in zone c, RDS `uptimo-postgres`,
  site_url `https://cosmos.3-108-95-203.sslip.io`. Nothing answers until the first deploy.
- First deploy (ticket 14 owns it; Nimish does the AWS parts, step by step): 1) RDS snapshot first
  (`aws rds create-db-snapshot`, wait until available); 2) GitHub secret `AWS_ROLE_ARN`; 3) `ROUTER_DATABASE_URL`
  in `migrate.env` only, never `app.env` (edit `infra/instance/refresh-env.sh`); 4) migration 0009 needs a
  maintenance window (FK re-validation takes ACCESS EXCLUSIVE locks); 5) `gh workflow run deploy.yml`; 6) free outside uptime pinger. Unverified on real RDS: master-user roles, pg-boss, pgcrypto.
- Tags: staging has none; otherwise `scripts/export-tags.ts` first, then `PGOPTIONS='-c uptimo.tags_exported=N'`;
  `scripts/preflight-cutover.ts` must exit 0.

## Decisions waiting for Nimish at the gate

Accent (blue or deep teal) on `/gallery`; 31 status labels; new words ("Switch off", "Step 1 of 3", "Show the
numbers"), chart style, a "Show switched off" option; DATA-MAP §5 wording from 07, Q25 default (offboarding proof in
the audit row, files in the backup bucket), offboarded-tenant stub keeps the company name; `audit_purge` also
removes offboard/erase proof rows after 3 years; billing alarm = existing USD 150 budget; a repo admin adds the
`pr-meta` check to the required checks (merge rule: 9 green checks).

## Follow-ups (not yet tickets)

Separate NOLOGIN history-owner role before production (26/28); server accepts what the Spec forbids (05);
raise-race 500 → 'already open' (15); admin phones on the people screen (21); `must_change_password` (21);
seed fixture mode wipes tenant (14); tags digest gate; erase dry-run; `ai_suggestion` decision vs undo lock;
import_row delete; PR #158's `ai_suggestion` vs `erase_person`; e2e API rate limit.
