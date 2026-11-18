# M4b-51 — Registers (ticket 51)

Ticket 51: AMC, warranty and legal tests and calibrations are one register with `kind`, loaded from the workbook and
edited on a generated screen; an item within its lead time notifies its owner through `notify` (fake clock). Blocked
by 46, which is merged (46a `7abfed08`, 46b `b06e888f`). Authority: **D17** (`asset_register` and its `kind`;
`service_contract` and `compliance_item` do not exist), the 0015 migration on `main`, the 46b write seam,
`docs/DATA-MAP.md`'s AMC/legal row and `docs/plan/MILESTONES.md:447-450`. This plan is frozen: every fork below is a
numbered ruling with its cost if wrong; there is no open question left for a builder.

## Prerequisite: ticket 46 (merged)

46a is the only M4b migration. `asset_register` exists with `kind IN ('amc','warranty','legal','calibration')`, the
nullable machine/vendor/reference/dates/owner/notes columns, `lead_days` and two indexes
(`packages/db/migrations/0015_m4b_schema.sql:155-179`), RLS plus `SELECT, INSERT, UPDATE, DELETE` for `app_user`
(`:186-197`). No further migration is allowed: 0015 is immutable (`pnpm migrations:immutable`), so this ticket adds
no column and no table.

46b published the write seam this ticket extends:
`insertAssetRegister(client, tenantId, AssetRegisterInput) => AssetRegisterRow` and
`assetRegisterById(client, tenantId, id) => AssetRegisterRow | null`, both exported through `plant/index.ts`
(`apps/server/src/modules/plant/repo/records.ts:37-64,152-193`; `apps/server/src/modules/plant/index.ts:46-55`),
proved by `apps/server/test/m4b-write.test.ts:285-320`. 51 reuses `insertAssetRegister` for the seed, and adds a
list/update/remove store beside it for the screen; it never re-implements the INSERT.

## The shape in one paragraph

`asset_register` is the only home of an AMC, a warranty, a statutory test or a calibration: `kind` says which, the
machine names what it covers, `starts_on`/`ends_on` are a contract's life, `due_on` is the next test/renewal, `lead_days`
is how early the phone warning starts and `owner_person_id` is who gets it. The Cosmos seed maps the 11 November
workbook's two AMC/Warranty rows and one Legal Compliance row into three rows (two `amc`, one `legal`) with no invented
dates and the original type/test text in `notes`; the plant then edits them on a generated settings page
(`/settings/registers`, `CrudPage`). A daily `register.due` job reads the rows whose watch date
(`due_on ?? ends_on`) is inside `lead_days` of the plant's today and calls `notify` once per item per date, to the
active owner. From 51c the same table is the live source of `EngineData.amc`/`legal`, so the Action Center's AMC/legal
reminders and the workbook's two sheets print what the register holds.

## Facts it rests on (verified in this checkout, 19 Nov 2026)

| Fact                                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The ticket and its blocker                                 | `docs/plan/MILESTONES.md:447-450` (goals), `:618` (E17: 51 ← 46 only)                                                                                                                                                                                                                                                                                                                          |
| D17: one register, no `service_contract`/`compliance_item` | `docs/decisions/D17-table-budget.md:20` (the `asset_register` row), `:43` (the two removed tables)                                                                                                                                                                                                                                                                                             |
| The table, its kinds, dates, lead and indexes              | `packages/db/migrations/0015_m4b_schema.sql:155-179`; grants/RLS `:186-197`                                                                                                                                                                                                                                                                                                                    |
| The intended write path                                    | `docs/slices/46-m4b-schema.md:46-49` (the shape), `:101-107` (46b: plant repo functions, “47 builds coded closes, 49/51 the screens”)                                                                                                                                                                                                                                                          |
| The plant row in the data map                              | `docs/DATA-MAP.md:110` (“the supplier, the reference, start/end and due dates and the lead time for the alert. The `kind` column says which of the four it is”)                                                                                                                                                                                                                                |
| The fixture's register lines                               | `fixtures/answer-key/input.json:2236` (`machAmc`: 2), `:2237` (`machLegal`: 1), `:2238` (`legalTypes`: 1), `:2239` (`amcTypes`: 4)                                                                                                                                                                                                                                                             |
| The workbook export's counts                               | `fixtures/answer-key/workbook-export.json:15` (AMC & Warranty: header + `dataRows: 2`), `:16` (Legal Compliance: header + `dataRows: 1`)                                                                                                                                                                                                                                                       |
| The workbook itself agrees                                 | `docs/discovery/real-2026-11-13/cosmos-export-2026-11-11.xlsx`: `AMC & Warranty` `max_row=7` (4 title rows, a header at row 5, rows 6-7), `Legal Compliance` `max_row=6` (header at row 5, row 6); every date cell is empty                                                                                                                                                                    |
| The 45 sheets' current computation                         | `packages/domain/src/exports/plant-sheets.ts:246-305`: AMC `ends_on = start + months − 1 day` printed `DD-MM-YYYY`, legal `due_on = last + months` printed ISO; the sheets read `data.data.amc`/`legal`                                                                                                                                                                                        |
| The live export is waiting for these rows                  | `apps/server/src/modules/reports/export-data.ts:8-10` (“absent until M4b 49/51: their sheets print their header row today”)                                                                                                                                                                                                                                                                    |
| The engine's AMC/legal lines and reminder rules            | `packages/domain/src/analytics/types.ts:164-187` (`AmcLine`/`LegalLine`), `:236-238` (`EngineData.amc/legal`); `packages/domain/src/analytics/action-center-ext.ts:63-73` (end/due), `:78-146` (the two rules and their keys)                                                                                                                                                                  |
| The key raises no AMC/legal nudge                          | `packages/domain/test/analytics-action-center.test.ts:24,195` (no start/test date in the plant) and `:221-316` (the synthetic rules that must stay green)                                                                                                                                                                                                                                      |
| The triage rows and the open Bhavin question               | `docs/plan/m4a-triage.md:21-22` (amc-warranty/legal-compliance → 51) and `:55` (whether the dateless lines are placeholders; not blocking)                                                                                                                                                                                                                                                     |
| The settings framework the screen joins                    | `apps/server/src/modules/plant/settings-resources.ts:36-80` (the `Resource` contract), `:350` (`RESOURCES`); `settings-routes.ts:146-260` (create/edit/remove) and `:290-333` (the generic routes); `repo/plant-settings.ts:163-182` (`Store`, `tableStore`, “remove is what `active: false` does”)                                                                                            |
| The web pattern, date input and page list                  | `apps/web/src/patterns/crud-spec.ts:28-40` (`CrudField`; `kind` has no `date` yet), `apps/web/src/patterns/form-sheet.tsx:22,130` (it already renders `type=date`), `apps/web/src/patterns/crud-page.tsx:362` (“never delete”), `apps/web/src/screens/settings/Plant.tsx:38-47,81-96` (the one page list that is the menu and the routes)                                                      |
| The audit contract                                         | `packages/shared/src/audit.ts:9-28` (`AUDIT_AREAS`, a closed enum); `apps/server/src/modules/ops/repo.ts:18-33` (`audit.record`); retention 3 years at `docs/DATA-MAP.md:94` and `packages/db/migrations/0010_retention_support.sql:18-19`                                                                                                                                                     |
| The reply contract                                         | `packages/shared/src/replies.ts:147-152` (`settingsResource` = list/create/`PUT`, 3 routes) and `:185-196` (the existing resources); `apps/server/test/reply-contract.test.ts:37-42` (the route table equals `REPLY_SCHEMAS`, `toHaveLength(137)` today)                                                                                                                                       |
| `notify` and its dedupe                                    | `apps/server/src/modules/notifications/notify.ts:16` (max caller key 154), `:64-110` (one row per recipient/channel, `${key}:${personId}:${channel}`); the table's `UNIQUE (tenant_id, dedupe_key)` and free-text kind ≤40 at `packages/db/migrations/0012_m2_schema.sql:93-118`; the wording map `apps/server/src/modules/notifications/kinds.ts:6-14`                                        |
| The job shape and the fake clock                           | `apps/server/src/retention.ts:39-70` (cron map), `:75-82` (the 24 h clock guard), `:93` (`allowFakeClock`), `:125-159` (queue for every role, workers/schedule for non-api); `apps/server/test/retention-jobs.test.ts:8-11` (a fixed `NOW`); `apps/server/src/modules/notifications/jobs.ts:29-63` (the same two-tier shape, `notify.sweep` schedule); wiring `apps/server/src/index.ts:39-41` |
| The module edges                                           | `apps/server/src/modules/manifest.ts:59-72`: `plant` may call identity/files/ops and **not** notifications; `notifications` may call identity/plant/ops                                                                                                                                                                                                                                        |
| The owner's active check                                   | `apps/server/src/modules/identity/repo.ts:331-340` (`activePerson`), exported at `apps/server/src/modules/identity/index.ts:6`                                                                                                                                                                                                                                                                 |
| The seed and its source-order test                         | `apps/server/src/seed/cosmos.ts:32-36` (`SEED_FILES`), `:124-133` (the inserts), `:145-152` (the `sources` list); `apps/server/src/modules/plant/repo/seed.ts:65-96` (machine insert); `apps/server/test/cosmos-seed.test.ts:89-95` (“`sources.at(-1)` is the people fixture”)                                                                                                                 |
| The existing use of the word “registers”                   | `apps/server/src/seed/cosmos-data.ts:137-142` calls the machine master sheets “the 11 Nov registers”, and `packages/domain/src/analytics/registers.ts` is the M4a machine-register figures file; this ticket's files therefore use `asset-register`, and 51 does not touch that file                                                                                                           |
| 49a's loader ruling                                        | `docs/slices/49-pm-plans.md:88` (branch `plan/49`, commit `3eff2468`): “the loader is a seed/import step, not a migration and not a settings import”                                                                                                                                                                                                                                           |
| Parity rows                                                | `docs/spec/parity.yaml:1244-1256` (`m4a.amc-warranty`), `:1257-1268` (`m4a.legal-compliance`), both `todo`, ticket 51                                                                                                                                                                                                                                                                          |
| The public-API pin                                         | `packages/domain/test/registry.test.ts:61-67` (D2 lists every export; a new helper must be added there)                                                                                                                                                                                                                                                                                        |

### Derived counts (not pasted from the ticket)

| What                                     | Derived from                                                                    | Count                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| AMC & Warranty data rows                 | xlsx rows 6-7; `workbook-export.json` `dataRows`; `machAmc.length`              | **2**                                                    |
| Legal Compliance data rows               | xlsx row 6; `workbook-export.json` `dataRows`; `machLegal.length`               | **1**                                                    |
| `asset_register` rows written            | 2 + 1                                                                           | **3**                                                    |
| `kind = amc`                             | both AMC rows' type has no warranty token                                       | **2** (TC-11 “AMC (Comprehensive)”, A/TANK-1 “AMC”)      |
| `kind = warranty`                        | no source row                                                                   | **0**                                                    |
| `kind = legal`                           | “Test Of Pressure Vessel” / “Form No 11” is a statutory test, not a calibration | **1** (A/TANK-1)                                         |
| `kind = calibration`                     | no source row                                                                   | **0**                                                    |
| Distinct machines                        | `new Set([...machAmc, ...machLegal].map(l => l.machineId))`                     | **2** (TC-11, A/TANK-1; both in the 192 seeded machines) |
| Rows with a date                         | `machAmc` start `''`, `machLegal` last `''`                                     | **0**                                                    |
| Rows with `ends_on`/`due_on`             | computed only when a start/last exists                                          | **0**                                                    |
| Rows with an owner                       | the workbook has no owner column                                                | **0**                                                    |
| `lead_days`                              | the shared default (the platform's 15-day reminder window)                      | **15** each                                              |
| `notes` written                          | the AMC type (2) and the legal test + form (1)                                  | **3**                                                    |
| Pick-list entries that become rows       | `amcTypes` 4, `legalTypes` 1                                                    | **0** (R5)                                               |
| Notices from the imported 3 today        | no watch date and no owner (R3/R9)                                              | **0**                                                    |
| Notices per owned, dated item per window | one (the unique dedupe key, R10)                                                | **1**                                                    |

### How each source field maps (the loader, field by field)

| Source                                                    | Becomes                                                                                                                                                           |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `machAmc[].machineId`, `machLegal[].machineId`            | resolved to `machine_id` by code under the tenant; an unknown code skips the row with a conflict (`register line for <code> has no machine`), never a failed seed |
| `machAmc[].type`                                          | `kind` by R1; the text goes to `notes`                                                                                                                            |
| `machAmc[].start` (may be `''`)                           | `starts_on`, `''` → NULL                                                                                                                                          |
| `machAmc[].months`                                        | used to compute `ends_on = endOfTerm(start, months)`; not stored                                                                                                  |
| `machAmc[].vendor` (the one “Vendor / contract no.” cell) | `vendor`; `reference` stays NULL                                                                                                                                  |
| `machAmc[].noRenew`                                       | text in `notes` (`· not renewing`); not stored                                                                                                                    |
| `machLegal[].tid`                                         | looks up `legalTypes` for a missing name/form and a missing months; not stored                                                                                    |
| `machLegal[].name`, `.form`                               | classify (`/calibrat/i` → `calibration`); both go to `notes` as `name · form`                                                                                     |
| `machLegal[].last` (may be `''`)                          | `starts_on`, `''` → NULL                                                                                                                                          |
| `machLegal[].months`                                      | the row's own value wins; used to compute `due_on = addMonths(last, months)`; not stored                                                                          |
| `machLegal[].cert`                                        | `reference`; `vendor` stays NULL                                                                                                                                  |
| `amcTypes[]` (4)                                          | no row: the AMC contract-type vocabulary the classifier reads (R5)                                                                                                |
| `legalTypes[]` (1)                                        | no row: a fallback for name/form/months by `tid` (R5)                                                                                                             |
| nothing in the workbook                                   | `lead_days = 15`, `owner_person_id = NULL`, `notes` as above                                                                                                      |

**Cosmos's live plant.** The Cosmos seed (`pnpm seed:cosmos`, and the staging run in `infra/STAGING.md:79`) is how
the plant gets these rows: `seedCosmos` inserts the 192 machines, then the three register rows, in the same
transaction; a re-run replaces the tenant (the seed's existing rule). A real tenant without a seed adds its rows on
`/settings/registers`. The fixture is the 11 November workbook's settings state (`input.json:2236-2237` equals the two
sheets' rows); the 28 October export the seed otherwise reads has no `machAmc`/`machLegal`, which is why the register
fixture is a `SEED_FILES` constant rather than a `Paths` entry (49a's `pmPath` points at the same file, so a second
`Paths` key would only duplicate it).

## The notice date rule, exactly

`watchOn = due_on ?? ends_on`, in the plant's calendar day; `starts_on` is history and never triggers; the window opens
inclusive on `watchOn − lead_days` and has no upper bound. With `lead_days = 15` and `due_on = 2026-12-01`:

| Row state                           | Watch day | 2026-11-15 | 2026-11-16 | 2026-12-02            | 2026-12-02, run twice |
| ----------------------------------- | --------- | ---------- | ---------- | --------------------- | --------------------- |
| `due_on = 2026-12-01`               | 12-01     | no         | **1**      | same key, nothing new | nothing new           |
| `ends_on = 2026-12-01`, no `due_on` | 12-01     | no         | **1**      | same key              | nothing new           |
| only `starts_on`                    | none      | no         | no         | no                    | no                    |
| no owner                            | 12-01     | no         | no         | no                    | no                    |
| row removed before the run          | —         | no         | no         | no                    | no                    |
| owner switched off                  | 12-01     | no         | no         | no                    | no                    |

The dedupe key the caller passes is `register:<row id>:<watchOn>` (56 characters against the 154 a caller may pass);
`notify` stores `register:<id>:<watchOn>:<person id>:push` (98 against the table's 200) (`notify.ts:16,109`;
`0012_m2_schema.sql:96`). A moved `due_on` is a new key and therefore a new message; changing `lead_days` alone is
not.

## Rulings

**R1 — one register, and `kind` is the only classifier.** There is no `service_contract` or `compliance_item` table and
no second screen (D17). `kind` is one of the migration's four values; the loader classifies a line by its own words: a
type matching `/warranty|extended|\bEWC\b|\bFOC\b/i` is `warranty`, a legal name/form matching `/calibrat/i` is
`calibration`, every other AMC/Warranty sheet line is `amc` and every other Legal Compliance line is `legal`. **Cost if
wrong:** a misclassified line is one field edit on the screen, and the notice rule is kind-blind, so no date or reminder
moves.

**R2 — the loader is a seed/import step, not a migration and not a settings import.** A pure mapper
(`apps/server/src/seed/asset-registers.ts`) turns the fixture's `settings.machAmc`, `settings.machLegal` and the two
pick-lists into drafts; the Cosmos seed writes them through `plant`'s seed entry (49a's R1 shape,
`docs/slices/49-pm-plans.md:88`). A migration is schema and applies everywhere; a settings import would need an xlsx
reader and an upload screen no mockup approves (`docs/design/LOCK.md`). **Cost if wrong:** no product path uploads an
AMC/Warranty or Legal Compliance sheet in 51; a real plant either seeds or adds its rows on the screen, and M5's
importer reuses the mapper.

**R3 — dates are stored; tenure is not.** `starts_on` is the contract start or the last test; `ends_on` is
`endOfTerm(start, months)` (the day before `addMonths(start, months)`, month-end clamped); `due_on` is
`addMonths(last, months)`. Both computations use the new shared helpers in
`packages/domain/src/analytics/plant-date.ts`, the same arithmetic `plant-sheets.ts` uses, so import and export cannot
drift. An empty source date imports as NULL and no date is invented. `asset_register` has no `months`, `type` or
`noRenew` column (D17 chose dates) and this ticket does not add one. **Cost if wrong:** the screen trades tenure
arithmetic for dates (`starts/ends/due` are typed), and the three real rows carry no dates, so nothing reminds until
the plant fills them; the workbook remains the archive.

**R4 — the free text has one home each, and one convention.** The AMC sheet's single “Vendor / contract no.” cell goes
to `vendor` (the platform's own `line.vendor` in `AmcLine`, which the export prints); the legal “Certificate / report
no.” cell goes to `reference` (`LegalLine.cert`). The AMC `type`, the “not renewing” flag, and the legal test name and
Form No have no column, so the loader writes them to `notes` in one convention: an AMC note is `<type>` or
`<type> · not renewing`, and a legal note is `<name> · <form>`. The screen's notes field is the item's description and
its hint states the convention; 51c reads the type/name/form/flag back from it (R12). A plant-level row (no machine) is
allowed: `machine_id` is nullable in 0015. **Cost if wrong:** the notes are editable free text, and each loss is
separate: (a) an emptied or rewritten AMC note loses the type detail, so “AMC (Comprehensive)” falls back to
“AMC”/“Warranty”; (b) a note that no longer ends ` · not renewing` loses the flag, so the item reminds and the sheet's
Not renewing cell goes blank; (c) a rewritten legal note still gives a name and, when it has the separator, a form,
otherwise the board falls back to “Legal compliance”. The workbook and the key still hold the original wording.

**R5 — the platform's pick-lists do not become rows or lists.** `amcTypes` (4 labels) and `legalTypes` (1 entry) only
classify: a legal line's missing name/form are filled from `legalTypes` by `tid`, and a missing `months` falls back to
the type's months (the line's own 24 wins over the type's 11 in the real data). No `list_item` list is created in 51.
**Cost if wrong:** the plant cannot reuse its old contract-type vocabulary on a new row; if Bhavin wants it back, a
`list_item` list (`amc_type`, which D17 allows) joins this screen's fields later with no migration.

**R6 — the screen is the generated settings resource at `/api/v1/settings/registers`, with a reply schema.** A
`Resource` (`apps/server/src/modules/plant/settings-registers.ts`) appended to `RESOURCES`, gated by `canSettingsLists`
(head and admin, `packages/domain/src/permissions/settings.ts:5-7`), with the house audit actions
`register.create` / `register.update` / `register.remove` on entity `asset_register`. Fields: kind (choice, required),
machine (choice, blank means no machine), vendor, reference, startsOn/endsOn/dueOn (date), leadDays (text typed into a
number, 0-3650, default 15), owner (choice), notes (vendor/reference ≤120 characters, notes ≤500). Validation: a machine
of this plant (`exists`), an **active** person of this plant (`activePerson`), `endsOn >= startsOn`; the schema enforces
the dates, the lead and the enum, so a foreign id or a backwards date is a 422, never a 500.
`assetRegisterReplySchema` (strict) carries `id`, the ten fields and `active: z.boolean()`; the reply returns
`active: true` for a listed row and the generic remove returns `{...before, active:false}`, so the schema must allow
both. It is registered in `packages/shared/src/replies.ts` as
`...settingsResource('settings/registers', assetRegisterReplySchema)`, which adds the three routes (list page, create,
`PUT /:id`) and takes `apps/server/test/reply-contract.test.ts` from 137 to 140 with the equality assertion kept.
The server `Resource` has no `switchOff` or `sendReason`: `active:false` is the generic remove path (R7) and the reason,
when a screen sends it, comes in through `edit`'s patch.
The phone spec (`apps/web/src/screens/settings/registers-spec.tsx`) adds a `date` field kind (one line in
`crud-spec.ts`; `FormSheet` already renders it), kind chips for the list filter, a watch-date column, an owner column,
and `switchOff: { hintKey: 'plant.registers.removeHint', sendReason: true }` (a `CrudSpec` field: the sheet asks for
the reason and `switchBody` sends it). The page is one `PLANT_PAGES` entry (`registers`, `ShieldCheck`,
`plant.menu.registers`) so the left menu, the phone list and `App.tsx`'s route all follow. All copy is in
`plant.en.ts`; `plant.gu.ts` is `blank(plantEn)`, so the new keys fall back to English (D17's i18n rule). The owner
lookup reads `/api/v1/config`'s people (id/name/active, phone stripped for non-admins) through a `transport` that shapes
it as `{items}`, because `/api/v1/people` is admin-only and a head must be able to name an owner. **Cost if wrong:** no
bespoke register mockup; the screen follows the approved settings pattern, and the owner lookup is the one adapted
source (the roster's admin-only lookup is not copied).

**R7 — “switch off” is a removal, and the reason is audited for three years.** `asset_register` has no `active`
column and 0015 is immutable, so a row's switch is the generic `active: false` remove path: the store's `remove`
deletes the row, the audit keeps the before row, and the screen's hint says “Removing an item deletes its register
line; the audit keeps what it held.” The reason is a `CrudSpec` field (`switchOff: { hintKey, sendReason: true }`), not a
server `Resource` field; `switchBody` sends `{active:false, reason}`, and the generic `edit` passes `target.patch.reason`
to `remove`, which records it as the audit's `after` (`{reason}`), which the audit screen already renders
(`apps/web/src/screens/settings/Audit.tsx:61`). This is the roster's own precedent (`repo/plant-settings.ts:165`). The
audit row is kept **3 years** (`docs/DATA-MAP.md:94`; `audit_purge` refuses a cutoff younger than 3 years,
`packages/db/migrations/0010_retention_support.sql:18-19`), then an operator purge removes it: the removal is not a
permanent archive. For a **legal or calibration** item the hint adds the person-confirmation that the certificate or
report is filed before the line is removed. **Cost if wrong:** a removed contract or test lives in the audit for three
years and in the workbook, then only the workbook; there is no “off but kept” state and no restore button.

**R8 — the notice watches `due_on ?? ends_on`; `starts_on` never.** The window is `watchOn − lead_days <= plant today`,
inclusive, no upper bound (an overdue item still reminds once); a row with neither date raises nothing. `lead_days`
defaults to 15 on create and import (`REGISTER_LEAD_DAYS` in `packages/shared/src/plant-settings.ts`), the platform's
default reminder window. **Cost if wrong:** a row that records only a start date never reminds; the plant sets the end
or due; an overdue item gets its one message on the next daily run rather than an escalating stream, which is what the
“once per item per lead window” rule asks for.

**R9 — the owner is the only recipient, and only while active.** `to: [owner_person_id]`; no owner means the row is not
selected at all; an owner whose person is no longer active is skipped (`activePerson`). There is no role fallback: a
message to “all admins” for an item nobody owns is the failure the owner field exists to prevent. **Cost if wrong:** the
three imported rows push nobody until the plant assigns owners (the screen shows “No owner” and the plan's PR text says
so); the Action Center still shows the reminder on screen from 51c, so the item is not invisible.

**R10 — the dedupe key is `register:<row id>:<watchOn>`, and it lives 90 days.** `notify` appends the person and
channel, so the stored key is `register:<id>:<date>:<person>:push`; the person id is there **intentionally** — a new
owner gets one message and an old owner is not told again for the same date. One item notifies once per date, a second
run the same day is silent, a moved date is a new window, and a removed row cannot be re-keyed. Changing `lead_days`
alone does not re-message. `notification.purge` deletes notification rows after **90 days**
(`apps/server/src/retention.ts:51-53`; `docs/DATA-MAP.md:320`), so an item still overdue when its row is purged
re-notifies once on the next run; that is the price of keeping the table bounded. **Cost if wrong:** a renewal entered
as a second row (instead of editing the item's dates) messages twice; a long-overdue item can message again after 90
days; the add sheet's hint says to edit the dates when an item is renewed.

**R11 — the job is `register.due` in `notifications`, daily at 00:15 UTC.** `notifications` may read plant and identity
(`manifest.ts:59-72`), so the job lives there while the **rule** stays plant's: `plant` publishes
`dueRegisterItems(tx, tenantId, today)` (rows with an owner, a watch date and an open window); the job resolves the
active owner, calls `notify` in the same tenant transaction with the real `boss`, logs counts only, and takes the clock
as an argument with the 24-hour database guard (`allowFakeClock` for tests). Rejected: `plant` (it may not call
notifications; adding the reverse edge would make a module cycle) and `accountability` (a register is not SLA work).
**Cost if wrong:** a plant reminder is scheduled by the delivery module; moving it is one file plus one registration in
`index.ts`.

**R12 — the register is the live source of `EngineData.amc`/`legal` (51c), and the note carries the text back.**
`loadEngineData` reads the register through `plant.assetRegistersForEngine` and maps every field the engine has:

- AMC/warranty → `AmcLine`: `id`, `machineId = machine_id`, `type = amcType(note)`, `start = starts_on`, `months = 0`,
  `vendor`, `noRenew = note.endsWith(' · not renewing')`, `endsOn = ends_on`, `itemKey = id`. `amcType` is the note with
  the ` · not renewing` suffix removed, falling back to `kind === 'warranty' ? 'Warranty' : 'AMC'` when empty.
- legal/calibration → `LegalLine`: `id`, `machineId = machine_id`, `tid = id`, `name = legalName(note)`,
  `form = legalForm(note)`, `last = starts_on`, `months = 0`, `cert = reference`, `dueOn = due_on`, `itemKey = id`;
  the note's first separator (`·`) segment is the name and the rest (or null) the form, both empty when the note is
  empty.

`noRenew`, `tid`, `name` and `form` already exist on those types (they were simply left at `false`/empty by the earlier
plan); 51c now sets them. The type, the legal name/form and the ` · not renewing` suffix are the only parts of `notes`
that are read, and they are passed through the load's existing `clean` redactor, exactly as `problem`/`observedBy` are:
the raw note never reaches a figure. The note convention is R4's; a person who rewrites it changes the sheet's
Type/Test/Form cells and the board's wording, which is the recorded cost below. The two types gain optional `endsOn`/`dueOn`/`itemKey`; the action center prefers the stored
date, and an `itemKey` equal to the row id makes the “a later line clears the older” rule inert for register items (a
renewal is an edit of the same row). The exporter prints the type, the legal name/form, the Not renewing cell, and the
stored end/due dates exactly (`dmy` for the AMC end, ISO for the legal due); the tenure and Valid-for cells are blank
because `months` is 0. The fixture path keeps its own fields and prints the same rows as before.
**Cost if wrong:** (a) the live workbook's tenure/Valid-for columns are blank for register rows (the stored end/due
dates are exact); (b) the AMC type detail (“AMC (Comprehensive)” vs “AMC”) and the `noRenew` flag live only in the
note, so emptying it falls back to the kind label and loses the flag (the item then reminds and the sheet's Not
renewing cell goes blank); (c) a legal note without the separator still names the test but has no form, and an empty
note falls back to “Legal compliance” in the nudge; (d) two register rows for one item both nudge, because the row, not
a type, is the identity.

**R13 — two windows, both 15 by default.** The Action Center keeps the plant's global `amcRemindDays`/`legalRemindDays`
rules from ticket 44 (default 15; the key has no AMC/legal nudge, so the exact figures do not move). The phone push uses
the row's `lead_days`. Imported rows and new rows default to the same 15, so Cosmos sees them together; a plant can make
one row earlier or later than the screen. **Cost if wrong:** two knobs; the plan's acceptance names which one each test
asserts.

**R14 — parity flips here.** `m4a.amc-warranty` and `m4a.legal-compliance` become **in-progress** in 51a (the register
and its screen exist) and **done** in 51c (the same rows print on the two sheets and raise the Action Center reminders),
with evidence naming the 51 tests and the 45 workbook test. **Cost if wrong:** the rows would claim the live sheet a PR
early; no product behaviour moves.

**R15 — no new table, migration or dependency.** D17's budget stands (0015 untouched); the job uses pg-boss, already a
dependency; no xlsx reader is added. **Cost if wrong:** none; a reader would be an ADR-level dependency for a job the
seed already does.

## Rails for all three packets

- **D17:** no new table, no new column, no migration. `packages/db/migrations/0015_m4b_schema.sql` is read, never
  edited (`pnpm migrations:immutable`); the table count stays inside the budget.
- **No new dependency:** the notice uses pg-boss (already installed); the seed reads JSON with `node:fs`; no xlsx
  reader, no scheduler, no date library (the helpers are in `packages/domain`).
- **Tenancy/RLS:** every store and read runs inside `withTenant` or names `tenant_id`; the resource's machine, owner and
  row lookups are tenant-scoped; the job loops `jobTenantIds` under each tenant's settings; the tests prove a
  cross-tenant id is 404/422 and that one tenant's run writes only its own notification. No `row_security = off`.
- **Never weaken a test:** the 45 workbook's 17 sheets and exact rows, the Action Center's 36 nudges, the seed's
  `sources.at(-1)` assertion (`cosmos-seed.test.ts:95`) and the public-API pin stay green; the only edits to existing
  expectations are additions (one seed case, two names in D2's list, the parity status and evidence).
- **Size:** the new server files are planned under 400 lines (mapper ~170, settings resource ~160, store ~140, job
  ~120) and every function under 60; `pnpm size` is clean.
- **Fragment:** every packet appends its section to the one `changes/51-registers.md`; this plan PR adds the file with
  the plan section only (one fragment, no `CHANGELOG.md` edit).

## Packet 51a — the workbook load and the registers screen (one PR)

**Files.**

- `apps/server/src/seed/asset-registers.ts` (new, ≤200 lines): the pure mapper
  `mapAssetRegisters({ machAmc, machLegal, amcTypes, legalTypes }, { defaultLeadDays }) → { items, counts, conflicts }`,
  the classifier (`amcKind`, `legalKind`) and the draft shape (`machineCode`, `kind`, `vendor`, `reference`, `startsOn`,
  `endsOn`, `dueOn`, `leadDays`, `notes`).
- `apps/server/src/seed/asset-registers.test.ts` (new): the 3 rows and their kinds, the derived dates, the
  notes/vendor/reference mapping, the type fallback, the missing-machine conflict and the empty source.
- `packages/domain/src/analytics/plant-date.ts`: `addMonths(date, months)` and `endOfTerm(date, months)` (ISO, month-end
  clamped, null when unreadable).
- `packages/domain/src/analytics/index.ts`: export the two helpers; `packages/domain/test/registry.test.ts:61-67` gains
  `addMonths` and `endOfTerm` in D2's list (an addition, nothing removed).
- `packages/domain/src/exports/plant-sheets.ts` (`:246-305`): drop the local `addMonths`/`shiftDays`; AMC end is
  `dmy(endOfTerm(start, months))` and legal due is `addMonths(last, months)` — the same rows the key pins.
- `apps/server/src/seed/cosmos.ts`: `SEED_FILES.registers` = `fixtures/answer-key/input.json`, load it, call
  `insertAssetRegisters`, add `counts.registers` and the register conflicts, and put the source **before** the people
  entry so `cosmos-seed.test.ts:95` (`sources.at(-1)` is the people fixture) still passes.
- `apps/server/src/modules/plant/repo/seed.ts`: `insertAssetRegisters(tx, tenantId, items)` — resolve machine codes to
  ids under the tenant with one `SELECT id, code FROM machine`, skip an unknown code with a conflict, call
  `insertAssetRegister` per row; re-exported by `modules/plant/seed.ts`.
- `apps/server/src/modules/plant/repo/records.ts`: extract the private `insertAssetRow` (raw row) from
  `insertAssetRegister` and export it plus `ASSET_COLUMNS` for the sibling store (not through `plant/index.ts`), so the
  store and the published function share one INSERT and one column list.
- `apps/server/src/modules/plant/repo/asset-registers.ts` (new, ≤140 lines): `registerStore` with `all`, `one` (locked
  `FOR UPDATE`), `insert`, `update` and `remove`, the text-cast `ASSET_COLUMNS`, and
  `ORDER BY kind, COALESCE(due_on, ends_on) NULLS LAST, id`; `insert` translates the resource's snake_case values back
  to the `AssetRegisterInput` draft for `insertAssetRow`.
- `apps/server/src/modules/plant/settings-registers.ts` (new, ≤160 lines): the `Resource` — path, table
  `asset_register`, `kind: 'register'`, the column map, create/patch, `check`, `store: registerStore`, and the reply
  that always carries `active: true` (a listed row; the generic remove answers `{...before, active:false}`). It has no
  `switchOff`/`sendReason` (those are the web spec's, R6); `active:false` is the generic remove path and `edit` passes
  the reason to the modified `remove`.
- `apps/server/src/modules/plant/settings-resources.ts`: `registers` appended to `RESOURCES` (`:350`).
- `apps/server/src/modules/plant/settings-routes.ts:188-206`: `remove` takes the optional reason and audits it as
  `after: { reason }`; `edit` passes `target.patch.reason`.
- `apps/server/src/modules/plant/index.ts`: export nothing new beyond what 51a needs (the store is internal to the
  module; `insertAssetRegisters` goes through `plant/seed.ts` only).
- `packages/shared/src/plant-settings.ts`: `ASSET_KINDS`, `assetKindSchema`, `REGISTER_LEAD_DAYS = 15`,
  `assetRegisterCreateSchema` (`kind` required, `leadDays` default 15, `dropBlanks`), `assetRegisterPatchSchema`
  (`reason` accepted), `assetRegisterReplySchema` (strict; `active: z.boolean()` because the remove reply is
  `{...before, active:false}`) and the inferred types.
- `packages/shared/src/replies.ts`: `...settingsResource('settings/registers', assetRegisterReplySchema)` — the list
  page, create and `PUT /:id` replies (3 routes).
- `packages/shared/src/audit.ts:9-28`: `'asset_register'` in `AUDIT_AREAS`.
- `packages/shared/src/i18n/plant.en.ts`: the menu pair (`plant.menu.registers` and `.sub`) and the page keys
  `plant.registers.*` for title, intro, empty, add, kind plus the four kind labels (`kind.amc`, `kind.warranty`,
  `kind.legal`, `kind.calibration`), machine/noMachine, vendor, reference, startsOn, endsOn, dueOn, leadDays,
  owner/noOwner, notes/notesHint, allKinds, search, removeHint, watch, watchNone, ownerNone, dateColumn and lead (the
  `plant.menu.*` shape is `:9-14`); `packages/shared/src/i18n/audit.en.ts`:
  `audit.area.asset_register`. `plant.gu.ts` is `blank(plantEn)`, so no Gujarati edit is needed.
- `apps/web/src/patterns/crud-spec.ts:36`: `CrudField.kind` gains `'date'` (the only pattern change). 49a's plan
  names the same one-line change: whichever PR lands first adds it, the other finds it present and reuses it.
- `apps/web/src/screens/settings/registers-spec.tsx` (new, ≤150 lines): `CrudSpec` — title/empty/add/intro, the
  config-people lookup and the machines lookup, fields, `look`, columns (kind, machine, watch date, lead, owner),
  kind filter, search, `switchOff: { hintKey: 'plant.registers.removeHint', sendReason: true }` and the watch/owner
  note. The notes field's hint states the R4 convention.
- `apps/web/src/screens/settings/registers-spec.test.ts` (new): the D05 rule.
- `apps/web/src/screens/settings/Plant.tsx:38-47,81-96`: `'registers'` in `PlantPage`, one `PLANT_PAGES` entry
  (`ShieldCheck`, `plant.menu.registers`).
- `apps/web/e2e/settings-registers.spec.ts` (new): the browser path.
- `apps/server/test/asset-registers.test.ts` (new): the resource, audit, tenancy and removal.
- `apps/server/test/reply-contract.test.ts`: the route count goes **137 → 140** (the three register replies) and the
  `expect(keys).toEqual(Object.keys(REPLY_SCHEMAS).sort())` equality stays; the file is not otherwise weakened.
- `apps/server/test/cosmos-seed.test.ts`: one added case — the seeded tenant holds 3 register rows (2 `amc`, 1
  `legal`), no dates and no owner.
- `changes/51-registers.md` (this packet's section).

**Build.** Read `settings.machAmc`/`machLegal` in source order; classify; trim text to null; compute `endsOn` and
`dueOn` with the shared helpers; `notes` per R4; `leadDays` 15; return counts by kind and a conflict for a code the seed
has no machine for. The seed resolves codes after `insertMachines` in the same transaction (the 192-machine file has
both). The resource's `check` resolves machine and owner inside the tenant and compares the dates; the store returns
raw rows with `starts_on::text` etc. so the reply is date-safe. The reply is `assetRegisterReplySchema` with
`active: true` for every listed row (the remove's `{...before, active:false}` is the one false), registered in
`replies.ts` so the list, create and edit routes all have a schema. The screen groups by kind chips, shows the watch day
(`due_on ?? ends_on`), and computes the form note: “Reminds N days before DATE” or “Set an end or due date to start the
reminder”, plus “No owner: this item notifies nobody.”

**Given/When/Then.**

1. Given `fixtures/answer-key/input.json`, when the mapper runs, then it returns 3 drafts — 2 `amc` (TC-11,
   A/TANK-1) and 1 `legal` (A/TANK-1), 0 warranty/calibration, every date null, `lead_days = 15`, the notes
   “AMC (Comprehensive)”, “AMC” and “Test Of Pressure Vessel · Form No 11”, and no conflicts; the xlsx's rows 6-7/6
   and `workbook-export.json`'s `dataRows` agree.
2. Given a synthetic AMC line starting 2026-01-31 for 12 months (and one starting 2026-01-01), when mapped, then
   `ends_on` is 2027-01-30 and 2026-12-31 — the same `endOfTerm` the AMC sheet prints (the 45 key stays exact).
3. Given a legal line last done 2026-03-05 for 24 months, then `due_on = 2028-03-05`; given a line with no name/form
   but a `tid`, then the name/form come from `legalTypes`; a type containing `EWC`/`FOC`/`warranty` maps to `warranty`
   and a name/form containing `calibrat` to `calibration`.
4. Given the Cosmos seed on an empty tenant, when it runs, then the tenant holds 3 `asset_register` rows (2 `amc`, 1
   `legal`), the report counts `registers: 3`, the sources name the fixture before the people entry, the conflicts gain
   no register line, and a second run replaces them (still 3).
5. Given an admin on `/settings/registers`, when they add a warranty row with a machine, dates, lead 30, an active
   owner and notes, then the list shows it after reload, the audit has one `register.create` with the row, and the
   phone row reads the kind, machine and watch day.
6. Given the same screen, when they edit only the due date, then one `register.update` names only the changed key;
   `endsOn < startsOn` is 422 on `endsOn`, an unknown machine or owner is 422 on that field, another tenant's machine
   is 422, another tenant's row id is 404, and a technician or operator is refused by the settings gate.
7. Given the row's switch with a reason, then the row is gone from the list, one `register.remove` audit line carries
   the before row and the reason, and a reload no longer shows it.
8. Given the settings page at 360 px, when it lists the rows, then every reply key is a field or declared (D05), the
   kind chips filter, the watch day is the row's `due_on ?? ends_on` and the owner name reads.
9. Given any of the four replies, when the reply contract checks them, then the list is `settingsPage` of the row
   schema, create and edit are the row schema with `active: true`, the remove is `{...before, active:false}`, and the
   route count is 140.

**Red/green commands.**

- Red: `pnpm exec vitest run apps/server/src/seed/asset-registers.test.ts` — `Test Files 1 failed`,
  `Cannot find module '../asset-registers.js'`.
- Green: the same file; `pnpm exec vitest run apps/server/test/asset-registers.test.ts`;
  `pnpm exec vitest run apps/server/test/reply-contract.test.ts` (140 routes, the equality assertion kept);
  `pnpm exec vitest run apps/server/test/cosmos-seed.test.ts apps/server/test/plant-settings-cosmos.test.ts`;
  `pnpm exec vitest run apps/web/src/screens/settings/registers-spec.test.ts`;
  `pnpm exec playwright test apps/web/e2e/settings-registers.spec.ts`.
- Rails: `pnpm boundaries` (no new module edge), `pnpm migrations:immutable` (0015 untouched), `pnpm parity`,
  `pnpm precheck`.

**Covering suite.** `pnpm exec vitest run apps/server/test apps/server/src/seed packages/domain/test`, plus the web
settings units (`pnpm exec vitest run apps/web/src/screens/settings`) and the e2e spec.

## Packet 51b — the `register.due` notice (one PR)

**Files.**

- `apps/server/src/modules/plant/repo/asset-registers.ts`: `dueRegisterItems(tx, tenantId, today)` — the tenant's rows
  with `owner_person_id IS NOT NULL`, `COALESCE(due_on, ends_on) IS NOT NULL` and
  `COALESCE(due_on, ends_on) - lead_days <= $today::date`, returning `{ id, ownerPersonId, watchOn, leadDays }`,
  ordered by watch date; exported through `plant/index.ts`.
- `apps/server/src/kernel/jobs.ts`: `assertClockNearDatabase(pool, name, now)` moved from `retention.ts:75-82` (message
  and 24-hour rule unchanged), exported by `kernel/index.ts`; `retention.ts` imports it instead of its private copy.
- `apps/server/src/modules/notifications/register-jobs.ts` (new, ≤120 lines): `runRegisterDue`, whose deps are
  `{ pool, boss, now, tenantId?, allowFakeClock? }`, and `startRegisterJobs(boss, { pool, now? }, role)`; the
  `register.due` queue (`retryLimit: 1`, `expireInSeconds: 600`), the worker for non-api roles, the daily UTC schedule
  `15 0 * * *`, no boot enqueue.
- `apps/server/src/modules/notifications/kinds.ts`: `'register.due': 'Register item due'`.
- `apps/server/src/modules/notifications/index.ts`: export the two functions.
- `apps/server/src/index.ts:39-41`: `await startRegisterJobs(jobs.boss, { pool }, role)` after the notify jobs.
- `apps/server/test/asset-register-notice.test.ts` (new): the fake-clock acceptance below.
- `changes/51-registers.md` (this packet's section).

**Build.** `runRegisterDue` guards the clock, loops `jobTenantIds` (or the named tenant) under `withTenant`, computes
`plantToday(tx, tenantId, now)`, asks plant for the due rows, checks `activePerson` for each owner, and calls
`notify(tx, boss ?? null, { tenantId, to: [owner], kind: 'register.due', dedupeKey: 'register:' + id + ':' + watchOn,
now })`. The worker logs `{ job: 'register.due', tenants, notified }`; a duplicate job on the same day writes nothing
because of the unique key. The test seeds a tenant, a machine and an owner login with `insertAssetRegister` and runs
the job with `allowFakeClock: true`.

**Given/When/Then.**

1. Given an owned AMC row ending 2026-12-01 with lead 15, when the job runs at 2026-11-15 11:30 IST, then no
   notification; at 2026-11-16, then exactly one `register.due` row to the owner on `push`, with the key
   `register:<id>:2026-12-01:<owner>:push`.
2. Given the same row and day, when the job runs a second time, then the notification count is still 1.
3. Given a legal row due 2026-12-01 with lead 0, then 2026-11-30 gives none and 2026-12-01 gives one; an end date
   is used when `due_on` is null, and `due_on` wins when both are set.
4. Given an unowned row, an owner whose person is switched off, a row with only `starts_on`, and another tenant's due
   row in the same window, when the job runs for tenant A, then only A's owned active dated row notifies.
5. Given an overdue row whose window opened while the job was down, the next run calls it once; a moved date
   (2027-12-01) sends one new message when 2027-11-16 arrives, and never repeats the old key.
6. Given the row is removed through the screen's switch, then the next run sends nothing new and the earlier row stays.
7. Given a clock more than 24 hours from the database without `allowFakeClock`, then the job throws before writing.
8. Given a technician or operator, then the screen is refused but the job path is irrelevant to them; the notification
   row carries ids only (kind, person, channel), never a machine code or a test name.

**Red/green commands.**

- Red: `pnpm exec vitest run apps/server/test/asset-register-notice.test.ts` — the suite fails to import
  `runRegisterDue` (no such export) or `register-jobs.js`.
- Green: the same file; `pnpm exec vitest run apps/server/test/notify.test.ts` and
  `pnpm exec vitest run apps/server/test/retention-jobs.test.ts` (the moved clock guard still refuses and `notify`'s
  dedupe is unchanged); `pnpm exec vitest run apps/server/test/sla-timers.test.ts` (the fake-clock harness and the
  engine still pass).
- Rails: `pnpm boundaries` (notifications → plant/identity are already allowed; no `CALLS` edit), `pnpm size`,
  `pnpm precheck`.

**Covering suite.** `pnpm exec vitest run apps/server/test apps/server/src/seed packages/domain/test` (the job, the
notify module, the domain and the seed).

## Packet 51c — the register as the live AMC/legal source (one PR)

**Files.**

- `packages/domain/src/analytics/types.ts:164-187`: `AmcLine` already has `noRenew`; `LegalLine` already has `tid`,
  `name`, `form`; both gain `endsOn?`/`dueOn?` and `itemKey?`. 51c sets the existing fields from the register (R12),
  it does not add a parallel type.
- `packages/domain/src/analytics/action-center-ext.ts:63-73`: `amcLineEnd`/`legalLineDue` prefer the stored
  `endsOn`/`dueOn`; `:88-98,127-139`: a later line clears the older only when the item key matches (absent key keeps
  the old `machineId + type` / `machineId + tid` identity).
- `packages/domain/src/exports/plant-sheets.ts:262-305`: AMC end = `line.endsOn ?? endOfTerm(...)`, legal due =
  `line.dueOn ?? addMonths(...)`; the AMC Type prints `line.type`, the Not renewing cell `line.noRenew ? 'yes' : ''`,
  the legal Test/Form cells `line.name`/`line.form`, tenure/Valid-for blank when `months <= 0`.
- `apps/server/src/modules/plant/repo/asset-registers.ts`: `assetRegistersForEngine(tx)` — the tenant's rows with
  `kind`, `machine_id`, `vendor`, `reference`, `starts_on::text`, `ends_on::text`, `due_on::text`, `lead_days` and
  `notes` (R12 reads the type/test/flag back from it); exported through `plant/index.ts`.
- `apps/server/src/modules/analytics/load.ts:178-230`: map the rows to `EngineData.amc` (amc/warranty) and
  `EngineData.legal` (legal/calibration) with the R12 fields — `type`/`noRenew` and `tid`/`name`/`form` parsed from
  `notes`, passed through the existing `clean` redactor, `months: 0`, `itemKey: id`; a null machine is `''` (the rules
  filter on a known machine).
- `apps/server/src/modules/reports/export-data.ts:8-10`: the comment now says the registers come from the register
  rows.
- `apps/server/test/asset-register-engine.test.ts` (new): a register AMC with notes `AMC (Comprehensive)` ending 10
  days out and a legal row with notes `Test Of Pressure Vessel · Form No 11` due 10 days out appear in `loadEngineData`
  with the mapped `type`/`noRenew`/`name`/`form`; the board raises `amc|<id>|<end>` / `legal|<id>|<due>` with those
  words in the title; the sheets print the type/test/form and the Not renewing cell; a ` · not renewing` row raises no
  AMC nudge; a removed row is gone from both; two legal rows on one machine both nudge; an empty note falls back to
  `AMC`/`Warranty` and “Legal compliance”.
- `docs/DATA-MAP.md:110`: the status becomes “Built (M4b, 0015); loaded, edited and the live source for the Action
  Center and the workbook (51)”.
- `docs/spec/parity.yaml:1244-1268`: both rows `status: done` with the 51 evidence.
- `changes/51-registers.md` (this packet's section).

**Build.** The domain changes are additive (the fixture path sets no new field and prints identically; the 45 workbook
test's 17 sheets and row counts stay exact; the Action Center's key stays 36 nudges). `loadEngineData` maps the rows
after the lists, reading `type`/`noRenew` from the AMC note and `name`/`form` from the legal note per R12, through
`clean`; the Action Center's filters drop a register row with no machine. The nudge key keeps ticket 44's
`amc|<line id>|<end>` / `legal|<line id>|<due>` shape, so an ack/snooze on a register nudge is the same stored key.
The workbook route reads the same load, so the sheet is the register.

**Given/When/Then.**

1. Given a tenant with an AMC row (notes `AMC (Comprehensive)`, ending in 10 days), a warranty row (notes
   `Mitsubishi EWC`), an AMC row with notes `AMC · not renewing`, a legal row whose note is “Test Of Pressure Vessel ·
   Form No 11” (due in 10 days) and a blank-note AMC row, when `loadEngineData` runs, then `data.amc`/`data.legal`
   carry every field: `type` is `AMC (Comprehensive)`/`Mitsubishi EWC`/`AMC`, `noRenew` is true only for the marked
   row, `tid` is the row id, `name`/`form` are `Test Of Pressure Vessel`/`Form No 11`, `endsOn`/`dueOn` are the stored
   dates, `months: 0` and `itemKey = id`; a name in a note is replaced by the redactor.
2. Given the same rows, when the Action Center board is computed, then it includes the AMC nudge whose title ends
   `: AMC (Comprehensive) ends in 10 days` and the legal nudge whose title ends
   `: Test Of Pressure Vessel (Form Form No 11) due in 10 days` (the engine's existing “Form ” prefix), the not-renewing
   row raises no AMC nudge, an empty legal note's title falls back to “Legal compliance”, and an ack on the key removes
   the nudge from the open list.
3. Given two legal rows on one machine, then both nudge (the row id is the identity); a renewal that edits the same
   row's `due_on` moves the key instead of leaving a stale one.
4. Given the workbook is built, then the AMC & Warranty sheet prints the register's Type (`AMC (Comprehensive)`), start
   and stored end (end as `DD-MM-YYYY`, start ISO), and Not renewing `yes` for the marked row; the Legal Compliance
   sheet prints `Test Of Pressure Vessel` and `Form No 11`, the last/due dates, and the certificate; a row with no
   end/due prints blanks; the fixture's 17 sheets and the key's row counts are unchanged.
5. Given the register removes a row, then the sheet and the board no longer show it.
6. Given the key path (`ENGINE_DATA`), then `analytics-action-center.test.ts` and `analytics-workbook.test.ts` stay
   exact and `registry.test.ts` lists the two new date helpers.

**Red/green commands.**

- Red: `pnpm exec vitest run apps/server/test/asset-register-engine.test.ts` — the board has no `amc|`/`legal|` key.
- Green: the same file;
  `pnpm exec vitest run packages/domain/test/analytics-action-center.test.ts` and
  `pnpm exec vitest run packages/domain/test/analytics-workbook.test.ts` and
  `pnpm exec vitest run packages/domain/test/registry.test.ts`;
  `pnpm exec vitest run apps/server/test/report-export.test.ts` and
  `pnpm exec vitest run apps/server/test/analytics-engine.test.ts` and
  `pnpm exec vitest run apps/server/test/analytics-nudges.test.ts`.
- Rails: `pnpm boundaries` (analytics → plant is allowed), `pnpm parity` (the two rows' evidence), `pnpm precheck`.

**Covering suite.** `pnpm exec vitest run apps/server/test packages/domain/test` (the server and domain suites, the
workbook, the Action Center and the registry pin).

## Not in this ticket

No new table, column, migration or dependency (D17, 0015 immutable); no upload screen or xlsx reader; no PM plan,
calendar or PM job (49/50); no forecast or inspection (52); no intervention or ranking (54); no WhatsApp send for the
notice (push only, `channels` default); no repair of a mis-entered historical contract beyond editing/removing the row;
no second-plant import (M5 reuses the mapper). The N12 question (whether the dateless lines are placeholders) does not
block: the rows import as they are and the plant can remove them.

## Risk the reviewer should attack

The notice-date rule (R8) and the dedupe window (R10): `due_on ?? ends_on`, the inclusive boundary, no upper bound, one
message per item per date, and the 90-day purge's one possible re-message — a wrong choice here either misses a
statutory test or warns a day late, so the acceptance pins the day before, the boundary, a second run, a moved date, an
overdue row and a removed row. The second target is R12: the type/test/not-renewing round-trip through `notes` (a
rewritten note changes the sheet and the banner, and an emptied one loses `AMC (Comprehensive)` and the flag), the
`months: 0` blank tenure, and `itemKey = row id` (two rows for one item both nudge). The third is R7 (the switch
deletes a contract row; the audit keeps it 3 years, then only the workbook) and the fourth is the reply contract
(`active` true on a listed row, false on a remove).
