# M4b-46 — the one M4b schema change (ticket 46)

Ticket 46: the one M4b migration (backup first): `forecast`, `intervention`, `pm_plan`, `asset_register`;
`raised_channel` gains `pm` and `inspection`; failure-code columns (component, mode, cause, action) on
`breakdown_report`. Authority: **D17 supersedes** `docs/ARCHITECTURE.md` §5/§9 item 34 and 38 where they name
`pm_task`, `pm_checklist`, `pm_execution`, `service_contract`, `compliance_item` or `forecast_outcome` — those tables do
not exist; the data lives in the four D17 tables, a `ticket` with channel `pm`, and that ticket's report data.
Convention: `0014_m4a_schema.sql` / `down/0014_m4a_schema.down.sql` is the file pattern.
Revised after a fresh plan review (FAIL → this revision): seed and runner entries, the PM report-data home, the down
file's exam, the channel policy, and the missing constraints.

## Packet 46a — migration 0015 (one PR)

**Files.** `packages/db/migrations/0015_m4b_schema.sql` (new), `packages/db/migrations/down/0015_m4b_schema.down.sql`
(new), `packages/db/test/m4b-schema.test.ts` (new), `packages/db/test/seed.sql` (one `forecast`, `intervention`,
`pm_plan` and `asset_register` row for tenant A and B each — the isolation test requires exactly one row per tenant in
every `tenant_id` table), `packages/db/test/migration-runner.test.ts` (the 0015 artifact query in `expectInstalled` and
its fault-injection case), the channel-policy sites below, `docs/DATA-MAP.md` (the four table rows, replacing
`forecast_outcome`, `pm_checklist`/`pm_task`/`pm_execution`, `service_contract`/`compliance_item`), and
`changes/46-m4b-schema.md`.

**The file.**

1. `ticket.raised_channel`: drop the unnamed CHECK (`ticket_raised_channel_check`) and re-create it named, with
   `'pm'` and `'inspection'` added. No row changes.
2. Four columns on `breakdown_report`: `failure_component`, `failure_mode`, `failure_cause`, `failure_action`
   (`text` NULL), plus `pm_report jsonb` NULL for the ticked PM job (`{total, undone[], readings{}, comments, doneBy}`;
   NULL on every non-PM report). A `BEFORE INSERT OR UPDATE` row trigger rejects any non-null failure code that is not a
   `list_item` of `WHERE tenant_id = NEW.tenant_id AND list = 'failure_code' AND code = …` (invoker rights, explicit
   tenant predicate — never RLS; no `active` filter, so a switched-off code still validates old rows). It checks each
   column separately.
3. `forecast`: `id`, `tenant_id`, `machine_id` (RESTRICT), `month date`, `as_of date`, `profile text` (the
   `kpi_snapshot` regexp), `model text`, `predicted jsonb NOT NULL`, `frozen_at timestamptz NOT NULL DEFAULT now()`,
   `outcome jsonb`, `scored_at timestamptz`, `UNIQUE (tenant_id, machine_id, month)`,
   `CHECK (date_trunc('month', month) = month)`. `predicted` is written once: `app_user` gets no UPDATE on
   `predicted`, only on `outcome`/`scored_at` (a column grant), and the test proves it.
4. `intervention`: `id`, `tenant_id`, `machine_id` (nullable, RESTRICT), `pm_plan_id` (nullable,
   `REFERENCES pm_plan(id) ON DELETE RESTRICT`), `changed_on date NOT NULL`, `control jsonb NOT NULL DEFAULT '[]'`,
   `before jsonb`, `after jsonb`, `verdict jsonb`, `decided_by_person_id` (SET NULL), `decided_at`, `created_at`,
   `CHECK (machine_id IS NOT NULL OR pm_plan_id IS NOT NULL)`.
5. `pm_plan`: `id`, `tenant_id`, `machine_id` (nullable, RESTRICT), `category text`, `title text NOT NULL`,
   `interval_days int CHECK (> 0)`, `meter_interval numeric CHECK (> 0)`,
   `meter_tolerance numeric CHECK (>= 0)`, `last_meter_reading numeric`, `last_done_on date`,
   `checklist jsonb NOT NULL DEFAULT '[]'`, `active boolean NOT NULL DEFAULT true`, `created_at`, `updated_at`,
   `CHECK (machine_id IS NOT NULL OR category IS NOT NULL)`, `UNIQUE (tenant_id, id)` (the composite FK target).
6. `asset_register`: `id`, `tenant_id`, `kind text NOT NULL CHECK (kind IN ('amc','warranty','legal','calibration'))`,
   `machine_id` (nullable, RESTRICT), `vendor text`, `reference text`, `starts_on date`, `ends_on date`, `due_on date`,
   `lead_days int NOT NULL DEFAULT 0 CHECK (lead_days >= 0)`, `owner_person_id` (SET NULL), `notes text`,
   `created_at`, `updated_at`, `CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)`.

RLS, `tenant_isolation` and grants for all four in the 0014 DO-block shape, with the `forecast` exception above;
indexes `forecast (tenant_id, month)`, `intervention (tenant_id, changed_on)`, `pm_plan (tenant_id, machine_id)`,
`pm_plan (tenant_id, category) WHERE active`, `asset_register (tenant_id, kind, due_on)` and
`asset_register (tenant_id, ends_on)`. **Headers:** the up carries `approved-by:` (D17 + this plan + the review) and
`backup:` (the ticket's snapshot step) because the `DROP CONSTRAINT` trips the DROP rule; the down carries
`destructive-approved:` and `backup:` too.

**Backup and revert.** The up is additive otherwise. The down drops the four tables and columns and the trigger
**function**, restores the old channel CHECK, deletes its own ledger row so the runner can re-apply, and turns
`row_security` off / lifts FORCE on `ticket` while it checks for `raised_channel IN ('pm','inspection')` rows (as the
owner, or it reads nothing — D24); with any such row it stops with "Revert stopped: … Restore the snapshot instead".
The test runs the down the way the runner does, as the non-superuser owner.

**Channel policy (46a, code).** `pm` and `inspection` tickets are planned work, not breakdowns: they must not take an
SLA clock, appear in the drift list, get escalation, or count as live breakdowns in analytics. One shared predicate
(e.g. `isBreakdownChannel` in `packages/shared`) replaces the ad-hoc `NOT IN ('import','backfill')` checks at
`apps/server/src/modules/analytics/load.ts:72`, `modules/tickets/repo/sla.ts`, `repo/drift.ts`, `repo/escalation.ts`,
`modules/tickets/list.ts` and `modules/accountability/sla.ts`, with a test proving a `pm` ticket gets no clock and no
drift row, and a `floor` ticket still does.

**Acceptance — `packages/db/test/m4b-schema.test.ts`** (as `app_user` unless noted):

- applies from scratch; the down then refuses while a `pm` ticket exists, and after it is removed the down applies,
  proving the four tables/columns/trigger are gone, the old CHECK refuses `'pm'` again, and a second run re-applies;
- `asset_register` without `kind` is refused; each of the four kinds inserts; `lead_days < 0` is refused;
- a ticket inserts with `pm` and with `inspection`; `whatsapp` still inserts; `bogus` does not; a `pm` ticket gets no
  `sla_timer` row and no drift row, a `floor` ticket gets its clock;
- a breakdown report with the four codes inserts and reads back; a bad code and another tenant's code are refused; a
  valid but switched-off `failure_code` is accepted (47's rule: old reports keep their codes); `pm_report` round-trips
  and non-PM rows stay NULL;
- `pm_plan` carries `meter_interval`, `meter_tolerance`, `last_meter_reading`; a plan with neither machine nor category
  is refused; a duplicate `forecast` machine/month is refused; `app_user` cannot UPDATE `forecast.predicted` but can set
  `outcome`; `intervention.pm_plan_id` cannot point at another tenant's plan;
- cross-tenant reads see nothing (the isolation test now discovers the four tables; the seed has their rows).

**Production-copy rehearsal.** The milestone says applies and reverts on a production copy. If this checkout has no
access to a restored Cosmos copy, the builder runs the up/down/up on the migrated container and records the gap in the
fragment and the gate (it must not claim a production rehearsal it did not run); the operator step is two commands with
`scripts/migrate.ts` on the restored copy.

**Rails.** `scripts/migrate.ts` only; headers as above; `pnpm migrations:check`, `pnpm migrations:immutable`,
`pnpm boundaries`, the isolation and migration-runner suites, and `pnpm precheck` green. Up file ≤ 399 wc-lines; if it
grows, move the trigger into a `plpgsql` block or a second file is not allowed — keep it one file.

## Packet 46b — the write paths the schema now allows (one PR)

**Files.** `packages/shared/src/ticket.ts` (`raiseTicketSchema` gains an optional channel restricted to the internal
values), `apps/server/src/modules/tickets/routes.ts` (the raise path; keep the file under 400 lines — it is 384, so
extract a helper rather than grow it), `apps/server/src/modules/tickets/repo/ticket.ts` (`insertTicket` carries
`raised_channel`), the breakdown close path (`recordPastBreakdown`/`close`) for the codes and `pm_report`, a published
`tickets` function 49/52 can call for a `pm`/`inspection` raise, plant-module `pm_plan`/`asset_register` repo functions
behind `plant`'s interface, `apps/server/test/m4b-write.test.ts` (new), the fragment section.

**Acceptance.** A ticket raises with channel `pm` or `inspection` through the published path (a floor login cannot ask
for `pm`); a breakdown report stores the four codes only when they are `failure_code` items and stores `pm_report` for a
PM job; a `pm_plan` draft and an `asset_register` row write and read through their module's published interface. No
screen — 47 builds coded closes, 49/51 the screens. Use a machine with no open ticket in the test (the seed's `VC-1`
has one).

## Not in this ticket

No screen, no `failure_code` seed/screen (47), no PM generation (49), no calendar (50), no forecast freeze (52), no
intervention runner (54).
