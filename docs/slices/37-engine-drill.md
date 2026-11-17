# M4a-37 — the engine's machinery, the drill-down and the analytics shell

Milestone M4a (tickets 36–45). Ticket 37's plan, split into three packets so each is one reviewable PR. **Part A
(merged: #265) built the shell**: 43 figures registered with a drill type (`packages/domain/src/analytics/registry.ts`),
the pure `run`/`runWith` with the drill-provenance rule (`engine.ts`), the tenant read into plain rows (`load.ts`),
the profile resource and the audited profile route (`profile.ts`), and `GET /api/v1/analytics/figures`. Read those
files first; do not rebuild them. `COMPUTERS` is empty on purpose — engines 38–45 add the computations.

**Out of scope here:** the figure computations and their screens (tickets 38–45), the breakdown-log load (37c, its
own packet after this), the nightly `engine.run` job (37d), and any schema change (0014 already landed).

## Packet 37a — the snapshot writer and the drill-down (server, one PR)

### A1. `kpi_snapshot` writer

`apps/server/src/modules/analytics/snapshot.ts` (new) implements the existing seam
`FigureStore.save(tx, tenantId, result)` from `service.ts` (today `notStored`):

- one row per figure whose `status === 'ready'`, into `kpi_snapshot` (see
  `packages/db/migrations/0014_m4a_schema.sql`): `profile = 'legacy'`, `key` = the figure key,
  `subject_kind = 'plant'`, `subject_key = ''`, `period_start = period_end = asOf`, `as_of = asOf`,
  `run_id` = one `gen_random_uuid()` per run (one `UPDATE … SET run_id` for the batch), `value` = `jsonb` of the
  figure value (null-safe; `not_computed` figures are not stored).
- a re-run for the same day replaces the rows (`ON CONFLICT (tenant_id, profile, key, subject_kind, subject_key,
period_start, period_end, as_of) DO UPDATE SET value, computed_at, updated_at, run_id`), so one day holds one
  value per figure; a different `asOf` keeps the series. Never deletes.
- export it from `apps/server/src/modules/analytics/index.ts` and use it in a **new** route
  `POST /api/v1/analytics/run` (`requireAuth`; only head, plant_head and admin — reuse the same `canAnalytics` +
  money-free rule as the GET; a refusal names its reason) that runs the engine and stores one snapshot, replying
  the same `FiguresReply` shape as the GET. The GET stays read-only: no write on a GET.

Tests in `apps/server/test/analytics-engine.test.ts` (it already has the fixture and a store test): a head runs it,
`kpi_snapshot` holds one row per ready figure with the right period/as_of/run_id; a second run replaces (row count
unchanged, new `run_id`, `updated_at` moves); an operator gets 403; nothing is written on a GET.

### A2. Drill-down

`GET /api/v1/analytics/drill?type=<machine|ticket|move>&ids=<id,id,…>`:

- permission: same as the figures route (`canAnalytics`); a refusal is the usual `forbidden`;
- `type` not one of `DRILL_TYPES` (`packages/shared/src/analytics.ts`) → 422 naming `type`; more than 200 ids or a
  malformed id → 422 naming `ids`;
- reply `{ type, rows }` where a row is the same plain shape the engine reads (`MachineRow`, `TicketRow` or
  `MoveRow` from `packages/domain/src/analytics/types.ts`), **only** rows of the asked type in the caller's tenant,
  in the order the ids were asked, ids that do not exist dropped (never an error for one missing id);
- implement it on the already-published interface `loadEngineData` and filter by id (one read, no new SQL, no N+1);
  put a `shortcut:` comment naming the trigger to move to narrow repo queries once a plant's load passes ~1 s,
  and record it in the PR body (it is the honest cost note, not a bypass);
- contract in `packages/shared/src/analytics.ts` (`drillQuerySchema`, `drillReplySchema`), wired into the reply map
  (`REPLY_SCHEMAS` in `packages/shared/src/replies.ts`) so the reply-contract test passes.

Tests: the three types return exactly the asked rows for a head; an operator is refused; a plant never sees the
other plant's ids (they are dropped); bad type and over-long id list are 422; missing ids are dropped.

**Write scope (37a):** `apps/server/src/modules/analytics/{snapshot.ts,routes.ts,index.ts,service.ts}`,
`apps/server/src/modules/analytics/repo/` if a query is genuinely needed, `packages/shared/src/analytics.ts`,
`packages/shared/src/replies.ts`, `apps/server/test/analytics-engine.test.ts` (or two new test files),
`apps/server/test/reply-contract.test.ts` (route count), `changes/37-analytics-engine.md`.

## Packet 37b — the analytics face shell and the profile screen (browser, one PR)

Design reference (approved, binding): `docs/design/slices/slice-9-analytics-1-dashboard-today.html` and
`docs/design/LOCK.md` § "Analytics face": left menu in groups, Dashboard in the platform's order, head and plant head
open on Today, every figure shows its drill target, Money Matters heads/admin only. Desktop first (SPEC §8), the phone
is a comfortable reader. **No figures exist yet** (COMPUTERS empty): the shell must render the registry's screens and
each figure's "not computed yet" state honestly, never a fabricated 0.

- `apps/web/src/screens/analytics/` (new): the face at `/analytics` with the locked left-menu groups (Today, Machines,
  Breakdowns, Forecast & scorecard, PM, Cost, Reports, Guide) and one route per screen group; a screen renders the
  figures of its group from `GET /api/v1/analytics/figures`, each tile showing the figure label, its value when
  `status === 'ready'`, "Not computed yet" otherwise, and a drill link when `drill.ids` is not empty
  (link to `/analytics/<group>?drill=<type>:<ids>`, which the shell renders as a plain list fetched from the new drill
  route — no new design, a table of the rows' identifying fields);
- entry points: an **Analytics** item in the desk's navigation for head/plant_head/admin only, and the **Guide** entry
  in the face's menu (a static page that lists each screen and figure with its label — the real explanations come in
  ticket 45);
- the **profile screen**: a generated `CrudPage` (`CrudSpec`) over `/api/v1/analytics-profile` under Settings
  (add a page to `PLANT_PAGES`), grouped fields exactly as `PROFILE_FIELDS` (`packages/shared/src/analytics.ts`) —
  money fields shown only to head/admin; the server's 422 names the field to correct and the screen shows it;
- catalogue: a new namespace `analytics.en.ts` + `analytics.gu.ts` (`blank(analyticsEn)` convention **only if** the
  existing namespaces do that; otherwise both languages real), registered in `packages/shared/src/i18n/index.ts` —
  a new namespace is not frozen and needs no `NEW_KEYS` entry;
- tests: a spec test for the profile page config (D05 reply-key check, as the other `*-spec.test.ts` files do); one
  Playwright journey `apps/web/e2e/analytics.spec.ts`: a head opens `/analytics`, sees the menu groups and "Not
  computed yet", opens the profile screen and saves one number (audited), and an operator is refused both.

**Write scope (37b):** `apps/web/src/screens/analytics/*` (new), `apps/web/src/App.tsx`,
`apps/web/src/screens/settings/Plant.tsx`, `apps/web/src/screens/desk/parts.ts` or the desk nav file that lists the
menu (find it), `apps/web/src/api.ts`, `packages/shared/src/i18n/{index.ts,analytics.en.ts,analytics.gu.ts}`,
`apps/web/src/screens/settings/analytics-profile-spec.tsx` + test, `apps/web/e2e/analytics.spec.ts`,
`changes/37-analytics-face.md`.

## Rails (both packets)

Red test first, then green. Never delete, skip or weaken a test. One writer per packet, disjoint files. Lean budgets
(file ≤ 400 lines, function ≤ 60); no new dependency. Every visible string a catalogue key in both languages; tokens
and kit components only. Money figures and money profile fields only for head/plant_head/admin (the server already
enforces it — never a second rule in the browser beyond hiding what the reply does not carry). No real names or
phones; engine data is coded (`PersonRow.code`). Commit locally; do not push; report red output, green output, and
any deviation.

**Rulings (addendum):** (a) `type=ticket` returns tickets and tasks, in asked order, reduced to the ticket row shape; (b) `POST /analytics/run` takes an optional `{ asOf }` JSON body (plant date, 422 on the field, defaults to the plant's today) and requires head/plant_head/admin through the existing `canAnalytics` **and** `canMoney` checks; (c) the snapshot writer stores plant-subject rows only (`subject_kind='plant'`, `subject_key=''`, `profile='legacy'`) and never deletes.
