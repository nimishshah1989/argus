# 51 — Registers

**What changed for a user:** nothing in this PR — it is the frozen plan (`docs/slices/51-registers.md`) and this
fragment. The ticket that follows it puts AMC, warranty, legal tests and calibrations in one register with a `kind`,
loads the workbook's 2 AMC/Warranty and 1 Legal Compliance rows into it, edits them on a generated settings page, and
pushes each item's owner a notice when its lead time opens. From the last packet the register is also the live source of
the Action Center's AMC/legal reminders and of the workbook's two register sheets.

**Not in this PR:** no product code, no migration, no dependency. `packages/db/migrations/0015_m4b_schema.sql` is
untouched (D17: `asset_register` already holds the row; `service_contract` and `compliance_item` do not exist).
`pnpm precheck` is the only check this PR claims.

## Prerequisite

Ticket 46 is merged: 46a is the 0015 migration, 46b (`b06e888f`) published
`insertAssetRegister`/`assetRegisterById` through `plant/index.ts`. 51 extends that seam; it adds no column and no table.

## The three packets

- **51a — the workbook load and the registers screen.** A pure mapper (`apps/server/src/seed/asset-registers.ts`) turns
  `fixtures/answer-key/input.json`'s `settings.machAmc` (2) and `settings.machLegal` (1) plus the two type lists into 3
  drafts (2 `amc`, 1 `legal`; 0 warranty/calibration; every date empty; lead 15; the type/test wording in `notes`); the
  Cosmos seed writes them through `plant`'s seed entry. The generated settings page `/settings/registers` lists, adds,
  edits and removes them (head/admin, audited `register.create/update/remove`, the reason kept on a remove) with the
  fields kind, machine, vendor, reference, starts/ends/due, lead days, owner and notes. Its strict
  `assetRegisterReplySchema` (with `active`) is registered in `replies.ts`, taking the reply-contract route count from
  137 to 140.
- **51b — the `register.due` notice.** A daily 00:15 UTC per-tenant job watches `due_on ?? ends_on`, opens the window
  inclusive at `watchOn − lead_days`, and calls `notify` once per item per date to the active owner
  (`register:<id>:<watchOn>`, which `notify` stores with the person and channel). Fake-clock tested at the day before,
  the boundary, a second run, an overdue run, a moved date and a removed row.
- **51c — the register as the live source.** `loadEngineData` maps the rows into `EngineData.amc`/`legal` with the
  stored `endsOn`/`dueOn`, the AMC `type`/`noRenew` and the legal `tid`/`name`/`form` read back from the note
  convention, and `itemKey = row id`; the Action Center's AMC/legal reminders and the workbook's AMC & Warranty / Legal
  Compliance sheets print the register from then on, and the key's 36 nudges and 17 sheets stay exact on the fixture
  path.

## The rulings (full argument and cost in the plan)

1. **One register, `kind` the only classifier** (EWC/FOC/warranty → warranty, calibrat → calibration, else amc/legal).
   Cost: a misclassified line is one field edit; the notice rule is kind-blind.
2. **The loader is a seed/import step** (49a's R1), not a migration or a settings import. Cost: no upload screen in 51;
   M5 reuses the mapper.
3. **Dates stored, tenure not:** `ends_on = start + months − 1 day`, `due_on = last + months`, shared with the export's
   arithmetic; empty source dates import as NULL. Cost: the screen types dates; the 3 real rows do not remind until
   filled.
4. **The single free-text cells have one home and one convention:** AMC's “Vendor / contract no.” → `vendor`, legal's
   certificate → `reference`, the type/test/form wording → `notes` (`type`, `type · not renewing`, `name · form`).
   Cost: a rewritten note loses the AMC type detail and can lose the not-renewing flag; the workbook stays the archive.
5. **The pick-lists create no rows**; `amcTypes`/`legalTypes` classify and fill a missing legal name/form by `tid`.
   Cost: the old type vocabulary is not reused on new rows; a `list_item` list can join later without a migration.
6. **The screen is a generated `CrudPage` resource** at `/api/v1/settings/registers`, head/admin, audited, with a strict
   reply schema (`active` true, false on a remove; `replies.ts` 137 → 140), a phone/table spec and a Plant-settings nav
   entry; the owner lookup reads the config's people because `/api/v1/people` is admin-only. Cost: no bespoke register
   mockup.
7. **Switch-off is a removal:** `asset_register` has no `active` column, so the switch deletes and the audit keeps the
   before row and the reason for **3 years**, then only the workbook; a legal/calibration delete carries the hint to
   confirm the certificate/report is filed. The `switchOff`/`sendReason` are the `CrudSpec` fields; the server's remove
   path takes `active:false` and the reason. Cost: removed rows are not kept as “off”.
8. **The notice watches `due_on ?? ends_on`; `starts_on` never.** Window inclusive at `watchOn − lead_days`, no upper
   bound; `lead_days` defaults 15. Cost: a start-only row never reminds; overdue items get one message on the next run.
9. **Owner-only recipients, only while active.** No role fallback. Cost: the 3 unowned imported rows push nobody until
   the plant assigns owners; the Action Center still shows them on screen.
10. **One message per item per date** (`register:<id>:<watchOn>`, the person id in the stored key is intentional); a
    moved date is a new window; a removed row cannot be re-keyed. The row is purged after 90 days, so a still-overdue
    item can message once more after that. Cost: a renewal entered as a second row messages twice (edit the dates).
11. **The job is `register.due` in notifications** (plant may not call notifications; the reverse edge would cycle),
    with the rule published by plant. Cost: a plant reminder scheduled by the delivery module.
12. **The register is the live `EngineData.amc/legal` source:** stored end/due preferred; type/not-renewing and
    test/form are read back from the note through `clean`; `itemKey = row id` makes the later-line-clears rule inert;
    `months = 0` so the live sheet's tenure/Valid-for are blank but the dates and text are exact. Cost: a rewritten
    note changes the sheet/board and can lose `AMC (Comprehensive)`/not-renewing; two rows for one item both nudge.
13. **Two windows, both 15 by default:** the Action Center keeps the plant's global reminder setting (ticket 44), the
    push uses the row's lead. Cost: two knobs, aligned at import.
14. **Parity:** `m4a.amc-warranty` and `m4a.legal-compliance` → in-progress at 51a, **done at 51c**, with the 51 tests
    and the 45 workbook test named. Cost: the rows claim the live sheet a PR early if flipped earlier.
15. **No new table, migration or dependency.** Cost: none.

## Risk the reviewer should focus on

The notice-date rule (R8/R10): `due_on ?? ends_on`, the inclusive boundary, no upper bound, one message per item per
date, and the 90-day purge's one possible re-message. The acceptance pins the day before, the boundary, a second run, an
overdue run, a moved date and a removed row rather than a pasted number. The second target is R12 (the type/test/
not-renewing round-trip through `notes`, `months = 0`, `itemKey = row id`), the third is R7 (the switch deletes a
contract row; the audit keeps it 3 years, then only the workbook), and the fourth is the reply contract (`active: true`
on a listed row, `false` on the remove).

## 51a — the workbook load and the registers screen (this PR)

**What changed for a user:** a head or admin now has an **Asset register** page at `/settings/registers` (Plant
settings, `ShieldCheck`). It lists the plant's AMC, warranty, statutory tests and calibrations with the watch day
(`due_on ?? ends_on`), the lead and the owner, filters by kind and edits every field; switching an item off asks why
and the audit keeps the line and the reason. The Cosmos seed loads the 11 November workbook's two AMC/Warranty rows and
one Legal Compliance row as three register items, so the plant can see and edit them without retyping.

**The load (R1–R5).** A pure mapper (`apps/server/src/seed/asset-registers.ts` + its test) reads the answer-key
fixture's `settings.machAmc`, `settings.machLegal`, `amcTypes` and `legalTypes` and returns three drafts: TC-11
“AMC (Comprehensive)” and A/TANK-1 “AMC” as `amc`, and A/TANK-1 “Test Of Pressure Vessel · Form No 11” as `legal`;
0 warranty and 0 calibration; every date NULL because the workbook's date cells are empty; `lead_days` 15; no owner.
`notes` carries R4's convention exactly (the AMC type, or `type · not renewing`; the legal `name · form`), the AMC
“Vendor / contract no.” cell goes to `vendor` and the legal certificate cell to `reference`. A line's own `months`
wins over its `legalTypes` fallback, and `endOfTerm`/`addMonths` compute `ends_on`/`due_on` from the shared helpers.
The Cosmos seed resolves the machine codes after `insertMachines` in the same transaction, writes each row through 46b's
`insertAssetRegister`, reports `registers: 3` (with `registers_amc`/`registers_legal`) and an unknown-code conflict
(`register line for <code> has no machine`) instead of failing. The register source is listed **before** the people
fixture, so `sources.at(-1)` stays the people entry. A pre-0015 schema has no table: `insertAssetRegisters` checks
`to_regclass('public.asset_register')` and is a no-op, so the migration tests still seed an older schema.

**The screen and its replies (R6/R7).** The resource `settings-registers.ts` (with the store in
`repo/asset-registers.ts`, sharing `records.ts`'s one INSERT and `ASSET_COLUMNS`) is appended to `RESOURCES`: ten fields
(kind, machine, vendor, reference, starts/ends/due, lead days, owner, notes), head/admin, `register.create/update/remove`
on entity `asset_register`. The reply always carries `active: true` (there is no column) and the generic remove answers
`{...before, active:false}`; the remove path gained the optional `reason`, recorded as the audit's `after: {reason}`.
The kind chips, search, watch/lead/owner columns, `switchOff: {sendReason: true}` and the R4 notes hint are in
`registers-spec.tsx`; the owner lookup reads `/api/v1/config`'s people through a transport because `/api/v1/people` is
admin-only. `assetRegisterReplySchema` is registered in `packages/shared/src/replies.ts` as
`settingsResource('settings/registers', ...)`, so the list, create and edit replies are covered and the route count
goes from 143 to 146 with the equality assertion kept.

**The export keeps its arithmetic (R3).** `addMonths` and `endOfTerm` now live in
`packages/domain/src/analytics/plant-date.ts`, exported from the analytics index and pinned in D2's list; the 45
workbook's AMC end and legal due read the same helpers, and its 17 sheets and row counts stay exact.

**Evidence.** `apps/server/src/seed/asset-registers.test.ts` (the 3 rows and kinds, the notes/vendor/reference mapping,
the month-end end and 24-month legal due, the type fallback, the classifiers, the missing-machine conflict and the empty
source); `apps/server/test/cosmos-seed.test.ts` (3 rows, 2 amc + 1 legal, no date/owner, lead 15, notes, replace
re-run); `apps/server/test/asset-registers.test.ts` (list, create, edit, remove with its reason, audit lines, 404/422,
tenancy and the settings gate); `apps/server/test/asset-registers-pre0015.test.ts` (the no-op); the reply contract at
146; `apps/web/src/screens/settings/registers-spec.test.ts` (D05, the date/choice fields, the chips and the note); the
browser path in `apps/web/e2e/settings-registers.spec.ts`. `pnpm boundaries` is green: no new table, migration or
dependency, and the only module edge is plant → identity, already allowed.

**Deviation recorded for review:** the plan's reply count `137 → 140` predates this checkout: 47a's failure-code list
and 49a's PM plans already took it to 143, so 51a takes **143 → 146** (the equality assertion unchanged). The plan's
`mapAssetRegisters` signature has no machine list, so the pure mapper can only name a line that has no machine code
(`register line N has no machine`); the unknown-code conflict is the seed's, as the plan's field map describes. An
unknown or another plant's machine is a **422** on `machineId` (R6 and 51a's Given/When/Then 6), unlike PM plans'
`Problem.missing` 404; another plant's **row id** is a 404.

## 51b — the `register.due` notice (this PR)

**What changed for a user:** an owner now gets one push per register item on the first day of its lead window, and no
second one that day. The watch day is `due_on`, else `ends_on` — never `starts_on`; the window opens inclusive at
`watchOn − lead_days` and has no upper bound, so an item that was missed while the server was down still gets its one
message. Moving a date is a new window and sends a new message; switching the item off stops it; an owner who is no
longer active is skipped; an item with no owner notifies nobody.

**The rule is plant's, the job is notifications' (R8–R11).**
`apps/server/src/modules/plant/repo/asset-registers.ts` gains `dueRegisterItems(tx, tenantId, today)`: the tenant's
rows with an owner, a watch date and `COALESCE(due_on, ends_on) - lead_days <= today`, returning
`{ id, ownerPersonId, watchOn, leadDays }` ordered by watch day, exported through `plant/index.ts`.
`apps/server/src/modules/notifications/register-jobs.ts` runs it: `runRegisterDue` checks the clock, loops
`jobTenantIds()` (or the one named tenant) under `withTenant`, computes `plantToday`, skips an owner `activePerson`
does not return, and calls `notify` in the same transaction with `kind: 'register.due'` and the key
`register:<row id>:<watchOn>`; `notify` appends the person and channel, so the stored key is
`register:<id>:<date>:<person>:push`. `startRegisterJobs` creates the queue for every role and, off the `api` role, the
worker and the daily UTC schedule `15 0 * * *`; there is no boot enqueue, and a re-run writes nothing because of the
unique key. `notifications/kinds.ts` adds the push body (“Register item due”), and `index.ts` starts the job after the
notify jobs. The 24-hour database clock guard moved from `retention.ts` to `kernel/jobs.ts`
(`assertClockNearDatabase`, exported by `kernel/index.ts`); the message and the rule are unchanged and retention now
imports it.

**Evidence.** `apps/server/test/register-due.test.ts`, on the fake clock at 11:30 IST: the day before the window
(silent), the inclusive boundary (one), a second run that day (still one), `due_on` winning over `ends_on` with lead 0,
an overdue row (one on the next run, not a stream), a moved date (a new key, the old one never repeated), a new owner
(a second message for the same date, the old owner not repeated), a removed row (nothing new, the earlier row stays),
no owner / an inactive owner / a start-only row (none), one tenant's run leaving the other tenant's due row alone, the
clock guard refusing before writing, the row holding ids only, and the registration (queue for `api`, worker and
`15 0 * * *` UTC off it). The existing `notify.test.ts`, `retention-jobs.test.ts` (the moved guard still refuses) and
`sla-timers.test.ts` stay green.

**Rails.** No new table, column, migration or dependency (D17; 0015 untouched). `notifications → plant/identity` is
already in `CALLS`, so `pnpm boundaries` needs no edit; `pnpm size` stays inside 400 lines; every new function is under 60. **Deviation recorded for review:** the frozen plan names the test file `apps/server/test/asset-register-notice.test.ts`
and this packet names it `apps/server/test/register-due.test.ts` to match the `register.due` job; the cases are the
plan's, none dropped.

## 51c — the register as the live source (this PR)

**What changed for a user:** the Action Center's AMC/warranty and legal reminders and the workbook's AMC & Warranty
and Legal Compliance sheets now print the register. A row added, edited or removed on `/settings/registers` appears,
moves or disappears on both the next board and the next workbook download, with the plant's own type/test wording, the
stored end or due date, the certificate and the Not renewing flag. The 11 November fixture path is unchanged: the key's
36 nudges and 17 sheets print exactly as before.

**The load maps every field the engine has (R12).** `plant` publishes `assetRegistersForEngine(tx, tenantId)` beside the
51b due-date read: the tenant's rows with `kind`, `machine_id`, `vendor`, `reference`, `starts_on`/`ends_on`/`due_on`
as text and `notes`. `loadEngineData` splits them by kind — `amc`/`warranty` become `EngineData.amc`, `legal`/
`calibration` become `EngineData.legal` — and fills every field the two types hold: `months: 0` (the register stores
dates, not tenure), the stored `endsOn`/`dueOn`, `itemKey = row id`, and the AMC `type`/`noRenew` and the legal
`tid`/`name`/`form` read back from R4's note (`<type>`, `<type> · not renewing`, `<name> · <form>`). The note passes
through the load's existing redactor before it is parsed, so a person's name in a note becomes `[Pn]` like every other
free text. An empty note falls back to the kind's own label (`AMC`/`Warranty`, and `Legal compliance` on the board); a
null machine is `''`, which the reminder rules already filter out.

**The rule reads the stored date and the row's identity.** `amcLineEnd`/`legalLineDue` prefer `endsOn`/`dueOn` and
only fall back to start-plus-tenure when the stored day is absent, so a register row's reminder lands on the date the
plant entered. A later line clears an older one only when both carry the same `itemKey`; without a key the old
`machineId + type` / `machineId + tid` identity stays, so the fixture's renewal test is unchanged and two register rows
of one type both nudge (the row, not the type, is the item). The nudge key keeps ticket 44's `amc|<id>|<end>` /
`legal|<id>|<due>` shape, so an ack or snooze on a register nudge is the same stored key and a renewal that edits
`due_on` moves the key instead of leaving a stale one. A ` · not renewing` row raises no AMC nudge.

**The two sheets print the register.** `amcSheet` prints `line.type`, `line.start`, the stored end as `dmy`
(`DD-MM-YYYY`), the vendor and `yes` in Not renewing; `legalSheet` prints `line.name`, `line.form`, the last date, the
stored due (ISO) and the certificate. The tenure and Valid-for cells are blank when `months` is 0, so a register row
with no end or due date prints blank rather than an invented date. A row derived the old way (`months > 0`, no stored
day) prints exactly as the 45 key pinned it.

**Evidence.** `apps/server/test/asset-register-engine.test.ts` (11 cases): the full `AmcLine`/`LegalLine` mapping
(`type`/`noRenew`/`tid`/`name`/`form`, `months: 0`, `endsOn`/`dueOn`, `itemKey`), the redactor on a note, the empty-note
fallbacks, a blank end/due (not invented), another plant's row invisible, the board's titles (`AMC (Comprehensive) ends
in 10 days`, `Mitsubishi EWC`, `AMC ends in 9 days`, `Test Of Pressure Vessel (Form Form No 11) due in 10 days`, the
blank legal note as `Legal compliance`), the not-renewing suppression, both legal rows of one machine nudging, the
same-type row not cleared because the row id is the identity, an ack on the key closing it, both sheets' exact rows
(start ISO, end `DD-MM-YYYY`, blank tenure, the not-renewing cell, the certificate, blank end/due) and a removed row
leaving the load, the board and both sheets. The 45 workbook test (`analytics-workbook.test.ts`, the fixture path's
17 sheets and row counts) and the Action Center's 36 key nudges (`analytics-action-center.test.ts`) stay exact. The
whole `apps/server/test` + `packages/domain/test` run passes every touched suite; one timing check,
`state-scale.test.ts`'s p95 budget on the tickets `/state` route, failed under this host's concurrent test load and is
unrelated to this packet (that route reads no analytics load and no file here touches it).

**Parity and the data map (R14).** `m4a.amc-warranty` and `m4a.legal-compliance` are `done`, with the engine test, the
45 workbook test and the 51a register test as evidence; `docs/DATA-MAP.md:110` says the register is loaded, edited and
the live source for the Action Center and the workbook.

**Rails.** No new table, column, migration or dependency (D17; 0015 untouched); `pnpm boundaries` needs no `CALLS` edit
(analytics → plant already allowed, SQL stays in plant's repo); `pnpm size` stays under 400 lines per file and every
function under 60. **Deviation recorded for review:** the frozen plan names the read `assetRegistersForEngine(tx)`; this
packet names it `assetRegistersForEngine(tx, tenantId)` so the read is explicitly tenant-scoped like `shiftsForEngine`,
not RLS-only. The plan also lists `docs/DATA-MAP.md:110` and the `export-data.ts` comment, both done here.
