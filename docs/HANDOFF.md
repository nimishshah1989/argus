# Where things stand

Under 50 lines. Read first, rewrite at session end.

## RESUME HERE (orchestrator, 13 Nov 2026 ~23:00 UTC)

**Process:** pstack (`CLAUDE.md`). The pstack plugin did NOT load in the cloud sandbox: builders are child sessions
(`create_session`), reviews are `ponytail-review` or fresh read-only Opus agents (adversarial for schema, auth,
tenancy, deletes). **Plan:** `docs/plan/MILESTONES.md` (tracker wins). **Ledger:** `docs/plan/ledger.md`.
**Standing authority (Nimish, asleep until ~04:00 UTC):** keep developing and merging; a fresh orchestrator session
continues when the previous one nears 60% context. BINDING EXCEPTION: no screens/flows/access-control UI are built
until Nimish approves the frontend plan (artifact https://claude.ai/artifact/VD9xJM9r9g77TQYKYW4XTS). No irreversible
AWS/production actions without him. Orchestrator branch: `claude/orchestrator-m0-gate` (ledger + tracker; ships in ONE PR at the gate).

**M0:** 01-13 merged, 14 code merged (#176) but 14 stays open until staging deploys, loads Cosmos and the restore drill is logged.
**M1 started early (API only):** 15 race fix #179, 16 goal 3 figures follow Bhavin #181. UI parked: branch `claude/t16-desk-ui-parked`.

## In flight (3 builders max)

- Accent deep teal MERGED as #177 (818b3a0; accent #0f766e, 5.47:1 on white; blue stays on /gallery as comparison). Check main CI gallery is green.
- Hardening MERGED: #180 (by Nimish) + follow-up #183 (7e62028: push parser bypass fixed, login guard reshaped, erased-login 401, change-password guarded). Open for Nimish: AI cap ceiling 100,000 USD and DOMAIN section 3 cap row split; Apple/Edge push hosts need a real-device check before production.
- Deploy fixes MERGED as #182 (Chromium in image, snapshot before migrating, PDF bytes direct, render gate, non-root; D25). NEW TERRAFORM: `aws_iam_role_policy.server_snapshot` (instance may create `uptimo-pre-*` snapshots). Nimish MUST apply it in the same apply as `github_sub_prefix`, before the first deploy, else the deploy stops safely at 'snapshot failed; nothing migrated'.
  Children never merge; merge on 9 green checks (static, api x3, browser x2, gallery, secrets, pr-meta), squash, then archive the child.

## Staging (AWS 118167167649 ap-south-1) — needs Nimish

Deployed infra: server i-0c8debfdec0da8209 (m6g.large, zone c), RDS uptimo-postgres, backup bucket, secret AWS_ROLE_ARN and variable
BACKUP_BUCKET set, snapshot `uptimo-before-0009` ready. Live tfvars (his Mac, ~/argus-staging/infra/terraform): domain "", billing_email set,
server_az_suffix "c", instance_type "m6g.large", external_uptime_ping false (org policy blocks SNS us-east-1).
First deploy failed at AWS sign-in: GitHub uses immutable subject. Fixed in #178. Nimish must: git pull; add
`github_sub_prefix = "repo:nimishshah1989@228974158/argus@1436478041"` to tfvars; terraform plan (expect 0 add, 1 change, 0 destroy);
apply; `gh workflow run deploy.yml`. Then infra/STAGING.md steps 9-12, part 2 (load Cosmos; Mac + SSM tunnel), RESTORE.md drill (log in docs/plan/restore-drill-log.md).
Plan expected after pulling main: `Plan: 1 to add (server_snapshot policy), 1 to change (deploy role trust), 0 to destroy`.

## Decisions waiting for Nimish

<<<<<<< HEAD
Screens plan approval + 5 questions in the artifact; 31 status labels; new words (Switch off, Step 1 of 3, Show the numbers), chart style,
"Show switched off"; DATA-MAP section 5 wording; Q25 offboarding proof; offboarded stub keeps company name; audit.purge also removes
import.undo rows after 3 years; billing alarm = USD 150 budget; repo admin must add `pr-meta` to required checks; cancel-then-restore gap counted
as downtime (follows Bhavin, questionable); Bhavin must confirm the 6 Nov support-downtime rule; floor taps 3 vs 4, 'Report a problem' vs
'Report a breakdown', open-support wording; what "Manav"/"core MD files" mean (analytics: dashboards are widgets, core + custom).

## Next after the above

M0 gate paperwork: `docs/plan/gates/M0.md` (goals, tests, evidence, what Nimish checks), full suite + audit (done: docs/plan/m0-audit.md), then STOP for his go.
Audit leftovers (not yet dispatched): 6 offline replay blocks on non-409 refusals (web data layer, with screens), 11 AI module polls every 2 s (M6),
12 four DB round-trips per request, 13-15,17-20 cleanups. Follow-ups: NOLOGIN history-owner role before production; erase_person blanks import_row
payload so later re-import/undo of that batch throws; admin phones (21); must_change_password (21); pending people merge needs design (21).
Do not message old sessions; archive children after merge.

<!-- prettier-ignore-start -->
<!-- facts: written by the session-end hook -->
Last session ended 2026-11-14 05:25 UTC on branch `claude/orchestrator-m0-gate`.
- c845d3d docs(plan): status
- c502d28 Merge remote-tracking branch 'origin/main' into claude/orchestrator-m0-gate
- 623426c docs(plan): M6 part 1 ruling
Uncommitted files: 0
<!-- end facts -->
<!-- prettier-ignore-end -->
=======
Separate NOLOGIN history-owner role before production (26/28); server accepts what the Spec forbids (05);
raise-race 500 → 'already open' (15); admin phones on the people screen (21); `must_change_password` (21);
seed fixture mode wipes tenant (14); tags digest gate; erase dry-run; `ai_suggestion` decision vs undo lock;
import_row delete; PR #158's `ai_suggestion` vs `erase_person`; e2e API rate limit.
>>>>>>> origin/main
