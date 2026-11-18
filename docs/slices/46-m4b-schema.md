# M4b-46 — the one M4b schema change (ticket 46)

Ticket 46: the one M4b migration (backup first): `forecast`, `intervention`, `pm_plan`, `asset_register`;
`raised_channel` gains `pm` and `inspection`; failure-code columns (component, mode, cause, action) on
`breakdown_report`. Authority: `docs/decisions/D17-table-budget.md` (the four tables and why nothing else may hold
the data), `docs/ARCHITECTURE.md` §9 items 34 and 38, and the M4b ticket list. Convention: `packages/db/migrations/0014_m4a_schema.sql`
is the pattern — one file, `BEGIN`, `SET LOCAL lock_timeout = '5s'`, a header with `approved-by:` and `backup:`,
RLS + `tenant_isolation` policy + grants in one DO block, and a `down/` file.

## Packet 46a — migration 0015 (one PR)

**Files.** `packages/db/migrations/0015_m4b_schema.sql` (new), `packages/db/migrations/down/0015_m4b_schema.down.sql`
(new), `packages/db/test/m4b-schema.test.ts` (new), `changes/46-m4b-schema.md` (new).

**What the file adds.**

1. `ticket.raised_channel`'s CHECK gains `'pm'` and `'inspection'` (drop and re-create the constraint; no row changes).
2. Four columns on `breakdown_report`: `failure_component`, `failure_mode`, `failure_cause`, `failure_action`, all
   `text` NULL. A `BEFORE INSERT OR UPDATE` trigger rejects any non-null value that is not a `list_item` of the
   tenant's `failure_code` list (the same shape as `0014`'s list-alias trigger); NULL means "not coded yet".
3. `forecast` — the frozen monthly forecast per machine: `id`, `tenant_id`, `machine_id` (RESTRICT), `month` (date,
   first of month), `as_of` (date the forecast was frozen), `profile`, `model`, `predicted jsonb NOT NULL`,
   `frozen_at timestamptz NOT NULL DEFAULT now()`, `outcome jsonb`, `scored_at timestamptz`, and
   `UNIQUE (tenant_id, machine_id, month)`. The outcome is filled into the same row later; nothing rewrites
   `predicted`.
4. `intervention` — a PM change judged before and after against a control group: `id`, `tenant_id`, `machine_id`
   (nullable, RESTRICT), `pm_plan_id` (nullable), `changed_on date NOT NULL`, `control jsonb NOT NULL DEFAULT '[]'`,
   `before jsonb`, `after jsonb`, `verdict jsonb`, `created_at`. `CHECK (machine_id IS NOT NULL OR pm_plan_id IS NOT NULL)`.
5. `pm_plan` — a plan per machine or per category: `id`, `tenant_id`, `machine_id` (nullable, RESTRICT), `category`
   (nullable), `title text NOT NULL`, `interval_days int CHECK (> 0)`, `meter_interval numeric CHECK (> 0)`,
   `meter_tolerance numeric CHECK (>= 0)`, `last_meter_reading numeric`, `last_done_on date`,
   `checklist jsonb NOT NULL DEFAULT '[]'` (the ticked points are the PM ticket's report data, D17),
   `active boolean NOT NULL DEFAULT true`, `created_at`, `updated_at`,
   `CHECK (machine_id IS NOT NULL OR category IS NOT NULL)`.
6. `asset_register` — AMC, warranty and legal tests/calibrations in one table with a `kind`: `id`, `tenant_id`,
   `kind text NOT NULL CHECK (kind IN ('amc', 'warranty', 'legal', 'calibration'))`, `machine_id` (nullable, RESTRICT),
   `vendor text`, `reference text`, `starts_on date`, `ends_on date`, `due_on date`, `lead_days int NOT NULL DEFAULT 0`,
   `owner_person_id` (SET NULL), `notes text`, `created_at`, `updated_at`,
   `CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on)`.

RLS, `tenant_isolation` and `app_user` grants for all four tables in the `0014` DO-block shape; indexes for the reads
the later tickets make (`forecast (tenant_id, month)`, `intervention (tenant_id, changed_on)`,
`pm_plan (tenant_id, machine_id)`, `asset_register (tenant_id, kind, due_on)`).

**Backup and revert.** The file is additive (no row is rewritten; the channel constraint is metadata only), but the
header still carries `backup:` per the ticket and names the snapshot step. The down file drops the four tables, the
four columns and the trigger, and restores the earlier channel CHECK; it refuses with a clear message while any
`raised_channel IN ('pm', 'inspection')` row exists (a revert must not silently break those tickets).

**Acceptance — `packages/db/test/m4b-schema.test.ts`.** On the migrated container, as `app_user`:

- the migration applies from scratch and its down file applies on a copy that has no PM/inspection rows (the test
  creates one, proves the down refuses, removes it, then reverts);
- an `asset_register` row without `kind` is refused; each of the four kinds inserts;
- a ticket inserts with `raised_channel = 'pm'` and with `'inspection'`; `'whatsapp'` still inserts and `'bogus'` does not;
- a breakdown report with the four codes set to the tenant's `failure_code` items inserts and reads back; one bad
  code is refused, and a code that belongs to another tenant is refused;
- a `pm_plan` row carries `meter_interval`, `meter_tolerance` and `last_meter_reading`, and a plan with neither
  machine nor category is refused;
- two `forecast` rows for one machine and month are refused; a second machine is accepted; `outcome` can be filled on
  the same row;
- cross-tenant reads see nothing (the isolation test discovers tenant tables automatically; this test proves the four
  new ones directly).

**Rails.** Migration applies with `scripts/migrate.ts`, never raw psql; no `DROP`/`UPDATE` on existing data beyond the
channel constraint; every new table has `tenant_id` and RLS in the same file; `pnpm migrations:check`,
`pnpm migrations:immutable` and `pnpm boundaries` green; `pnpm precheck` before push.

## Packet 46b — the write paths the schema now allows (one PR)

**Files.** `apps/server/src/modules/tickets/raise.ts` and its reply schema (the channel), the breakdown close path
(`breakdown_report` codes), `apps/server/src/modules/plant/` (a `pm_plan`/`asset_register` repo behind its module),
`apps/server/test/m4b-write.test.ts` (new), the fragment section.

**Acceptance.** A ticket can be raised through the internal path with channel `pm` or `inspection` (never by a floor
login for `pm`); a breakdown report stores the four codes only when they are `failure_code` items; a `pm_plan` draft
and an `asset_register` row are written and read through their module's published interface. No screen in this ticket —
47 builds coded closes, 49/51 the screens.

## Not in this ticket

No screen, no list seed for `failure_code` (47 owns the generated settings list), no PM job generation (49), no
forecast freeze (52), no intervention runner (54).
