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
