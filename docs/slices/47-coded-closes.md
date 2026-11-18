# M4b-47 — coded closes (ticket 47)

Ticket 47, `docs/plan/MILESTONES.md:423-426`:

1. [Browser] Every breakdown close requires codes from one `failure_code` list; the list is a generated settings
   screen; a switched-off code still shows on old reports.
2. [API] Bhavin's old codes resolve through the alias column loaded in 37, so legacy and new closes count in one code.

What ticket 46 already built, and what this plan uses rather than repeats: `breakdown_report.failure_component`,
`failure_mode`, `failure_cause`, `failure_action` and `pm_report` are columns (`packages/db/migrations/0015_m4b_schema.sql:35-39`);
one invoker-rights trigger refuses any non-null code that is not a `list_item` of
`list = 'failure_code'` for the same tenant, with no `active` filter, so a switched-off code keeps validating old rows
(`0015_m4b_schema.sql:41-79`); `list_item.aliases text[] NOT NULL DEFAULT '{}'` and its uniqueness trigger exist since
0014 (`packages/db/migrations/0014_m4a_schema.sql:91-120`). No migration, no table, no dependency is added here.

## What is true on main today (evidence, not assumption)

- Nothing seeds or writes the `failure_code` list, and no product code reads `aliases`: the only `aliases` users are
  migration 0014 and its tests (`packages/db/test/m4a-schema.test.ts:121-131`). The `maint_code` list is seeded from the
  live config's 19 codes and keeps the export-only ones switched off as rival rows
  (`apps/server/src/seed/cosmos-data.ts:152-163`, `:262`) — 47's failure list folds those three into aliases instead.
- The list is a generic settings resource: one entry in `LIST_NAMES` gives the API routes, the reply contract, the
  admin permission and the audit (`packages/shared/src/config.ts:4-16`, `apps/server/src/modules/plant/settings-lists.ts:14-60`,
  `:81`; audit at `apps/server/src/modules/plant/settings-routes.ts:160-167` and `:245-250`). The web hub is also
  config: `LIST_PAGES` + an icon (`apps/web/src/screens/settings/lists-specs.tsx:101-163`,
  `apps/web/src/screens/settings/Lists.tsx:18-24`).
- A new list can be given starting rows the first time it is read, idempotently and audited, without a migration:
  `apps/server/src/modules/plant/lockout.ts:12-30` (advisory lock, `has…` check, insert-on-conflict, one audit line),
  wired as the resource's `prepare` (`settings-lists.ts:51`) and called from the ticket paths that need it.
- A plant that already holds tickets cannot be re-seeded: `seed:cosmos` refuses a tenant with any ticket, import batch
  or audit row (`apps/server/src/seed/cosmos.ts:80-97`). Cosmos is live, so its list must arrive through the lazy seed
  from its own codes, not a re-seed.
- The close form already **requires** its maintenance code before it can send (`apps/web/src/components/reportFields.ts:135-143`),
  and the classification step renders it from `maint_code` (`apps/web/src/components/ReportSections.tsx:193-199`).
  The API's contract today is the opposite for every report field: an omitted field takes a default —
  `apps/server/test/ticket-report.test.ts:190-205` is the test that says a close with `report: {}` succeeds. R3 makes
  the failure code the one exception, and that test keeps every one of its default assertions and gains the code. The
  design lock keeps floor and desk **copy** as v3 has it, and `closes.*` is a frozen catalogue namespace
  (`docs/design/LOCK.md:8`, `packages/shared/test/catalogue.test.ts:55-79`).
- Reports reach the engine through exactly one loader, which maps `maint_code` straight through
  (`apps/server/src/modules/analytics/load.ts:120-122`). Every code figure reads that value: annual "By cause"
  (`packages/domain/src/analytics/annual-report.ts:202-214`), monthly code tables
  (`packages/domain/src/analytics/monthly-report.ts:242`), the breakdown log's Code column
  (`packages/domain/src/analytics/breakdown-log.ts:86-88`), the data checklist's missing-code rule
  (`packages/domain/src/analytics/data-checklist.ts:69`).
- Imported history carries the legacy code only and is written by the import path
  (`apps/server/src/modules/imports/insert-reports.ts:38`), not by the report store; 37's load already resolved its five
  unknown codes (`NI`, `FS`, `PP`, `UTI`, and `INT` in the older export) through the export's labelled synthetic map
  (`docs/slices/37c-breakdown-load.md:15-19`), so those rows are stored as `MIS` and need no alias here.

**The codes, verified with node over the repo's own data.** `fixtures/answer-key/input.json` `settings.codes` holds the
19 live codes with descriptions (E "Electronics/Electrical" … RINT); its 1,343 breakdown rows carry exactly one
`maintCode` each and none of ELE/HYD/ROT. The older `docs/discovery/source/cosmos-platform-export-2026-10-28.json`
holds 22 codes, where the three extras describe themselves as alternates — ELE "Electrical (alt)", HYD "Hydraulic
(alt)", ROT "Rotary (alt)" — and its 1,158 rows use ELE 89, MEC 73, ROT 16, HYD 9, plus NI 2, INT 2, FS 1, PP 1,
UTI 1. That is the evidence for R5: three alternates fold; the rest are Bhavin's (N12) and are not guessed.

## Rulings (each settled here; none left open)

**R1 — "requires codes" is one code at close, `failure_component`, from the list; the other three columns stay NULL.**
The SPEC asks for four fields from our list and for codes to be picked, never generated (`docs/spec/SPEC.md:93`,
`:340`); the columns exist and are nullable by design (`0015:35-39`). But the plant's list is one flat 19-code list
that cannot distinguish "what failed" from "why" or "what was done": its descriptions mix object (E, M, ATC, PNU),
cause (HUM, LB) and event (NO DT, RINT); every one of the 1,343 history rows records a single code; and asking four
picks from the same 19 options would quadruple the floor's taps for no new information (design lock: one primary
action, 52 px targets). So the four columns stand ready for M6's suggestion and for a plant that later has a real
per-slot taxonomy, while this ticket requires one: `failure_mode`, `failure_cause` and `failure_action` are stored when
a client sends them and are never required. Cost if wrong: if Nimish wants all four at close, it is three more
required pickers, one change to `reportReady` and one line in the report store; the columns and the trigger already
accept it.

**R2 — the floor keeps the plant's word "Maintenance Code"; the settings screen is "Failure codes".**
The design lock freezes floor and desk copy, and the `closes` namespace is frozen in the catalogue test; renaming the
label would need both a lock decision and a frozen-copy entry. The one visible change on the floor is where the
options come from. The picked value is stored in `failure_component` **and mirrored into `maint_code`**, so every
existing figure, PDF (`apps/server/src/modules/reports/pdf-template.ts:90`) and screen that reads `maint_code` counts a
new close without any of them changing. Cost if wrong: one list carries two names (the plant's on the form, the data
map's on the screen), which costs a copy change and a lock decision, not data; the aliases and the two columns keep the
data consistent either way.

**R3 — every close that records a breakdown report carries a code, and the server refuses one that does not; the form
requires it too.**
A live breakdown is a ticket of `kind` `stopped` whose `raised_channel` is one of the four live breakdown channels
(`packages/shared/src/channel.ts:7-13` — the one predicate that already excludes `pm`, `inspection`, `import` and
`backfill`, so planned and historical work is never asked). The rule lives in the one write path for a person's report,
`apps/server/src/modules/tickets/repo/report.ts` (`storeReportForTransition` → `storeBreakdownReport`), with the channel
handed in one line from `apps/server/src/modules/tickets/routes.ts:128` (`loaded.extras.raisedChannel`); the ticket's
`kind` and the ticket row come with it. **The three cases, settled here:**

1. **A close with a report** (`kind:'report'` and a `report` body) and **the late report** that completes a `no_report`
   close: after `ensureFailureCodes` (R4) and alias resolution (R6), a missing code throws
   `ReportValidationError(failureCodeField('failure_component'), 'A failure code is required')`; the reply is HTTP 422,
   `validation`, field `report.failureComponent`.
2. **A `kind:'report'` close with no report body** on a live breakdown is refused too — it claims a report it does not
   store, and would otherwise be the uncoded close the milestone forbids: HTTP 422, `validation`, field `report`,
   message "A report is required to close a breakdown". The existing test that expects this to succeed
   (`ticket-report.test.ts:258-270`) changes to the refusal.
3. **`no_report` and `done` closes record no breakdown report and therefore cannot carry codes: they are exempt and stay
   allowed.** The code arrives with the late report that completes a `no_report` close (case 1). This is the milestone's
   open conflict, recorded with its resolution as Q32 in `docs/spec/QUESTIONS.md`.

Both refusals are produced in `report.ts` (not `outcome.ts`), by `failureCodeField` plus `ReportValidationError`; the
unknown-code refusal is the trigger's own wording, **"That is not a failure code of this plant"** (`0015:52-53`).
`failure_mode`, `failure_cause` and `failure_action` stay nullable (R1). Cost if wrong: a plant that wants a live
breakdown closed with a report but no code, or closed as `kind:'report'` without the body, cannot; the list is created
on the write (R4) and the form falls back to the plant's maintenance codes while the list is empty (R4), so a missing
list cannot become a missing close.

**R4 — the list is the plant's own maintenance codes, seeded on the settings-list read and on the close write, never on
`GET /config`.**
`ensureFailureCodes` is called from two places, both already allowed to write: the `failure_code` settings list's
`prepare` and the report store (`repo/report.ts`, before the code is resolved — a close is already a write). **The
settings-list GET writing is accepted**: the generic route runs `prepare` before the list read
(`apps/server/src/modules/plant/settings-routes.ts:296`, and again before a create at `:148`), exactly as `lockout_step`
already does (`settings-lists.ts:51`, `lockout.ts:12-30`), and it happens once per plant. **It seeds from the plant, not
from code**: `ensureFailureCodes` first checks for existing rows without taking any lock (`hasFailureCodes`), so an
ordinary close never serialises; only when the list is empty does it take the per-tenant advisory lock, re-check, and
copy the plant's own `maint_code` rows (code, label, sort, active) into `failure_code`, using the fallback's
description where the plant's own label is just the bare code (so Cosmos's screen reads "E — Electronics/Electrical"
rather than "E"), attaching `ele`/`hyd`/`rot` as aliases on E/HY/RT when the plant has those (a legacy code whose target
is absent stays a row of its own — nothing is lost). The 19-code default lives in `apps/server/src/seed/failure-codes.ts` and is used **only** by a plant that has no
`maint_code` rows at all, because SPEC rule 4 keeps plant codes out of `packages/shared` (`docs/spec/SPEC.md:335`). The
config route is not touched: a screen read never writes. While a plant has no `failure_code` rows, the close form shows
its `maint_code` options (the tenant's own codes) and sends the picked one as the failure code, so the floor is never
left with an empty picker and that first close creates the list. Cost if wrong: a plant that never opens the screen and
closes only through clients that send no code keeps its `maint_code` rows and has no failure list until the first coded
close; a code added to `maint_code` after the seed is added on the failure screen by the head (or by a later sync), not
automatically.

**R5 — aliases: `E`←`ele`, `HY`←`hyd`, `RT`←`rot`. Nothing else is seeded.**
The three are applied when the seed copies the plant's codes (R4): the plant's own ELE/HYD/ROT rows become
`ele`/`hyd`/`rot` on E/HY/RT instead of rival rows, and the 19-code fallback carries the same three. D31 binds them
(`docs/decisions/D31-m4a-migration-homes.md:12`), the export calls them "(alt)", DATA-MAP says the old codes ride on
the row's `aliases` "rather than kept as a rival list" (`docs/DATA-MAP.md:63`), and that amends the earlier PARITY line
"keep both sets, mark the three as inactive" (`docs/spec/PARITY.md:163`). `MEC`, `NI`, `INT`, `FS`,
`PP`, `UTI` are **not** aliased: the real map is N12, still Bhavin's, and 37c's rule is that no invented mapping is
presented as the plant's (`37c-breakdown-load.md:15-19`). (The loaded 2026 log has no MEC; its NI/FS/PP/UTI rows
were already resolved to `MIS` by that synthetic map at import, `37c-breakdown-load.md:82-83`.) An admin can add an
alias on the screen when N12 lands. Cost if wrong: the older October export,
if it is ever loaded, counts MEC as its own code until N12; nothing is lost or dropped.

**R6 — resolution happens on the way in, case-insensitively, through this plant's list; a switched-off code is
accepted on write but never offered.**
The close/report path takes `failureComponent` or, for a client built before this ticket, `maintCode`; it resolves the
value against the tenant's `failure_code` codes and aliases and writes the canonical code into both `failure_component`
and `maint_code`. An alias resolves (`ele` → `E`). Switching a code off must not lose a close already queued on a phone:
the 46a trigger deliberately does not filter `active` (`0015:41-44`), and the picker hides it instead
(`reportFields.ts:145-149` filters `active !== false`). Cost if wrong: a switched-off code can still be recorded by a
client that sends it directly; the report keeps the code and the audit trail shows who switched it off.

**R7 — legacy codes are canonicalised on read in the analytics loader only, and an unknown code is never erased.**
`load.ts:120-122` is the single seam every figure's `maintCode` passes; the loader resolves it with the same list map and
falls back to the raw value — `maintCode: raw === null ? null : (resolveFailureCode(index, raw) ?? raw)` — so the annual
"By cause", the monthly code tables and the breakdown log count `ELE` as `E`, beside a new close's `E`, while `MEC`
(the N12 code, deliberately not aliased) and a blank stay exactly as they were.
Report display is the report's own truth and is not rewritten: the ticket detail and the PDF show the code as recorded
(which is how a switched-off code "still shows on old reports" — nothing filters reads by `active`). Cost if wrong: a
figure and a report could read differently for an old row (`E` vs `ELE`); the figure is the one that must be one code
per R2 of the ticket, and the log remains the honest record.

**R8 — past breakdowns and imports keep the legacy code, which is optional; the four failure columns are not written
there.**
`POST /tickets/past` is the after-the-fact door for old paper and writes through the import path
(`apps/server/src/modules/tickets/past.ts:95-116`); history has no codes at all (`33% have no fault code`,
`docs/discovery/01-SCOPE-BRIEF.md:55`), so its `maintCode` is optional: a past breakdown may carry one of the plant's
codes or none, and either way it counts in every code figure (a blank stays a blank). Its four failure columns stay
NULL because that path does not write them. Cost if wrong: a desk-entered past breakdown cannot be coded into the four
columns until someone extends that path; no data is guessed and no migration is needed.

**R9 — tenancy and the engine.** Every new query names `tenant_id` explicitly (the trigger's own pattern,
`0015:48-74`) and runs inside the tenant transaction; another plant's code is refused by the trigger and never resolves
in this plant's index. The engine keeps reading `data.lists['maint_code']` for labels; the `failure_code` descriptions
are for the settings screen, and switching `codeLabel` to them is 48's call when the Pareto axis exists.

## Packet 47a — the one list, with Bhavin's old codes riding on it (API, one PR)

**Files (11; this is the named shared seam — one list with four entry points, so the 3-file cap is exceeded by
design, and the PR body carries a plain `Large PR: the failure-code list and its alias contract, one seam` line).**
`packages/shared/src/failure-codes.ts` (new, **pure only**: `failureCodeIndex(rows)` and
`resolveFailureCode(index, value)` — trim, lower-case, code first then alias, `null` when neither; no plant data),
`packages/shared/src/config.ts` (`'failure_code'` after `'maint_code'` in `LIST_NAMES`),
`packages/shared/src/index.ts` (one export line), `packages/shared/src/plant-settings.ts` (`aliases` on `listFields`:
create/patch take `''`, `'ele, hyd'` or an array and normalise to a lower-case array; reply returns the array — **so
`aliases` becomes an accepted field on every list's create/patch and a key of every list's reply**, and the other lists'
screens declare it hidden with a reason in 47c),
`apps/server/src/seed/failure-codes.ts` (new: the fallback `DEFAULT_FAILURE_CODES` — the 19 codes in `input.json` order,
their descriptions as labels, position as `sort`, `E`/`HY`/`RT` carrying `ele`/`hyd`/`rot` — plus
`FAILURE_CODE_ALIASES` and `failureCodeSeedRows(maintCodes)`, the pure mapping of a plant's own maintenance codes to the
failure list (code, sort and active as the plant has them; the plant's label, or the fallback description when that
label is the bare code; the three aliases instead of rival rows); plant codes are seed data, not a `packages/shared`
constant, per `docs/spec/SPEC.md:335`),
`apps/server/src/modules/plant/repo/reads.ts` (`failureCodes(tx, tenantId)` with `code, aliases`, `maintenanceCodes(tx,
tenantId)` with `code, label, sort, active`, `hasFailureCodes`, `insertFailureCode` on conflict do nothing,
`lockFailureCodeSeed`), `apps/server/src/modules/plant/failure-codes.ts` (new: `ensureFailureCodes(tx, who)` —
`hasFailureCodes` **before** any lock, then lock, re-check, seed from the plant's `maint_code` rows or the fallback,
one audit line; and `failureCodeIndexOf(tx, tenantId)`), `apps/server/src/modules/plant/settings-lists.ts` (`prepare` for
`failure_code`, `aliases` in columns and reply), `apps/server/src/modules/plant/index.ts` (two exports),
`apps/server/test/failure-codes.test.ts` (new), `apps/server/test/reply-contract.test.ts` (the count: a list is three
generated routes and three reply schemas, so the route table's `toHaveLength(137)` at line 41 becomes 140). The config
route is not edited (R4).

**Red:** `pnpm exec vitest run apps/server/test/failure-codes.test.ts` (no such module). **Green:** the same, then the
covering suite below.

**Acceptance.**

- Given Cosmos (its `maint_code` list holds the 19 live codes plus inactive ELE/HYD/ROT, each labelled with its bare
  code), when the `failure_code` settings list is read, then it holds the plant's 19 codes with the fallback
  descriptions as labels ("E — Electronics/Electrical"), `E`/`HY`/`RT` carry `ele`/`hyd`/`rot`, the three old codes are
  not rival rows, a second read adds nothing, and the audit trail has one `failure_code.seed` line.
- Given a plant that added its own maintenance code (`GRS`, added to `maint_code` through the settings API), when the
  failure list is first read, then it holds `GRS` with the plant's label and no invented extra codes: the seed is the
  plant's list, and the fallback 19 appear only for a plant whose `maint_code` is empty.
- Given a plant whose `maint_code` holds ELE but not E, when the failure list is first read, then ELE stays a row of
  its own (a legacy code with no target is never dropped; only a mapped target turns a code into an alias).
- Given a plant whose `maint_code` is empty, when the failure list is first read, then the fallback 19 arrive once and
  `GET /config` before that carries no `failure_code` rows and writes nothing (R4: no write on the config read; the
  form's fallback in 47c is what keeps the floor able to close).
- Given a plant with the list already seeded, when a close resolves a code, then `hasFailureCodes` answers before any
  advisory lock is taken (no serialisation of ordinary closes), and a code added to `maint_code` afterwards is not
  copied automatically (the head adds it on the failure screen).
- Given the list, when the head edits a row's old codes to `'ele, ELECTRICAL'` and the admin switches a code off, then
  the reply carries `['ele','electrical']` and `active:false`, both edits leave one `list_item.update` audit line with
  before/after, and a code or alias already used in the list (any letter case) is refused 409 by the 0014 trigger.
- Given plant B's alias, when plant A's list is read, then it is absent and the resolver never returns it.
- Given the route table, when the app is built, then `/settings/lists/failure_code` GET, POST and PUT have reply
  schemas like every other list (137 → 140 routes/replies, no other route changes shape), and every reply parses.

**Covering suite (server + shared, not only the named test):**
`pnpm exec vitest run apps/server/test/failure-codes.test.ts apps/server/test/plant-settings-cosmos.test.ts apps/server/test/plant-settings-access.test.ts apps/server/test/plant-settings-writes.test.ts apps/server/test/settings-resources.test.ts apps/server/test/reply-contract.test.ts apps/server/test/support-access-guard.test.ts packages/shared/test`.

## Packet 47b — coded closes and one code on read (API, one PR)

**Files.** The rule's seam: `packages/shared/src/ticket.ts` (`breakdownReportSchema` gains the four optional `failure*`
strings, `.max(60)`), `packages/shared/src/ticket-reply.ts` (the four required-but-nullable strings on
`storedReportSchema`), `apps/server/src/modules/tickets/repo/report.ts` (`failureCodeField(column)` and both refusal
messages live here; `storeReportForTransition` refuses a `kind:'report'` close with no report body on a live breakdown
(R3 case 2); `storeBreakdownReport` runs `ensureFailureCodes`, resolves each of the four submitted values through
`failureCodeIndexOf`, enforces R3 case 1, inserts the four columns and the mirrored `maint_code`, and
`loadReport`/`buildStoredReport` return them; under 400 wc-lines — 329 now), `apps/server/src/modules/tickets/routes.ts:128`
(one argument: `loaded.extras.raisedChannel`), `apps/server/src/modules/tickets/outcome.ts` (one line: the reply uses the
message the error carries, so the two refusals read differently — the messages themselves are built in `report.ts`),
`apps/server/src/modules/analytics/load.ts` (one line: `maintCode: raw === null ? null : (resolveFailureCode(index, raw)
?? raw)`), and `apps/server/test/failure-code-closes.test.ts` (new). **The fixtures this rule forces (mechanical, rebased
on 46b where it touched the same file, no assertion removed):** one code at each close-with-report call site — 32 sites
in 14 server test files (`ticket-report` — whose "closes without a report" case at `:258-270` becomes R3 case 2's
refusal and whose "applies defaults" case keeps every assertion and gains the code — plus `tickets`, `tickets-commands`,
`notify-ticket-events`, `import-state`, `import-fixture`, `handback`, `escalation`, `escalation-reopened`, `ticket-pdf`,
`state`, `signoff-board`, `production-date`, `lockout`) — the three e2e specs that close through the API
(`signoff.spec.ts:34`, `signoff-feed.spec.ts:22`, `analytics-whywhy.spec.ts:48`), and the three stored-report fixtures
the four new reply keys force (`reply-contract.test.ts:77-113`, `report-html.test.ts:35-60`,
`ticket-pdf.test.ts:150-170`; 46b already touched these files once, so this packet rebases rather than re-adds). The
past-breakdown and import path is not edited: it keeps writing `maint_code` only (R8).

**Red:** `pnpm exec vitest run apps/server/test/failure-code-closes.test.ts` (the missing-code case is red). **Green:**
the same, then **the whole server suite** — `pnpm exec vitest run apps/server/test` — because the rule changes the close
contract of 14 test files, plus `pnpm exec vitest run packages/db/test/m4b-schema.test.ts`, plus the three e2e specs whose
API closes gained a code (`pnpm exec playwright test apps/web/e2e/signoff.spec.ts apps/web/e2e/signoff-feed.spec.ts apps/web/e2e/analytics-whywhy.spec.ts`).

**Acceptance.**

- Given a started ticket and the list, when the technician closes with the code `E`, then the report row holds
  `failure_component = 'E'` and `maint_code = 'E'`, the detail reply returns both, and the PDF and the breakdown log
  show `E`.
- Given a live breakdown (`kind` `stopped`, channel `floor`) and a close with a report that carries neither
  `failureComponent` nor `maintCode`, when it is sent, then the reply is exactly 422 `validation`, "A failure code is
  required", field `report.failureComponent`, and no report row is written; the same close with `maintCode: 'E'`
  (an app built before this ticket) is accepted and stored as `E`; a `pm`/`inspection` ticket, a support ticket, a
  past breakdown (`POST /tickets/past`, channel `backfill`) and an imported row are still accepted with no code.
- Given the same live breakdown, when it is closed with `kind:'report'` and **no** `report` body, then the reply is
  exactly 422 `validation`, "A report is required to close a breakdown", field `report` (R3 case 2); when it is closed
  with `kind:'no_report'` and when a general ticket is closed with `kind:'done'`, then both succeed, store no report,
  and are exempt (R3 case 3); the late report that completes the `no_report` close without a code is refused and with
  one is accepted.
- Given a legacy history row (channel `import`) stored with `maint_code = 'ELE'` and a new close coded `E`, when the
  annual report's "By cause" is computed, then it holds one `E` row that counts both: legacy and new closes count in
  one code. Given an unaliased legacy code (`MEC`) and a blank code on two other rows, when the same figure is
  computed, then `MEC` and the blank are still there, unchanged — the loader resolves what it knows and falls back to
  the raw value (R7).
- Given a client built before this ticket, when it sends `maintCode: 'ele'`, then the stored code is `E` (alias, any
  case); when it sends `NOPE`, then the reply is exactly 422 `validation`, "That is not a failure code of this plant",
  field `report.failureComponent`, and nothing is written.
- Given a code used on a close and then switched off, when the ticket detail is read, then the report still shows the
  code; when `/config` is read, then the entry is there with `active:false` and the close form's options omit it.
- Given an imported report with no codes, when it is read and counted, then every `failure*` column is NULL, no trigger
  refusal occurs, and the row still counts under its `maint_code`.

## Packet 47c — the screen and the floor's picker (web, one PR)

**Files (9).** `packages/shared/src/i18n/lists.en.ts` (the `failure_code` title/add/empty/menu/sub keys, `lists.field.aliases`
and its hint; `lists.gu.ts` is `blank(listsEn)`, so no Gujarati file changes), `apps/web/src/screens/settings/lists-specs.tsx`
(`ListsPage` gains `failure_code`; its spec shows the `aliases` field and every other list hides it with a reason),
`apps/web/src/screens/settings/Lists.tsx` (one icon), `apps/web/src/screens/settings/lists-specs.test.ts` (the new page,
the aliases field on it and hidden elsewhere, the D05 guard already walks the reply schema),
`apps/web/src/components/ReportSections.tsx` (the required Choice is sourced from `codeOptions(config)`, same
position, same "Maintenance Code" copy), `apps/web/src/components/reportFields.ts` and `reportFields.test.ts` (`maintCode`
in the form's values becomes `failureComponent`; `buildReportBody` sends it; `reportReady` requires it; `codeOptions`
returns the switched-on failure codes, or — while the list has no rows — the tenant's own maintenance codes from
`config.lists.maint_code`, never a hardcoded list: R4's bridge, unit-tested here with a tenant code that is not one of
the fallback 19),
`apps/web/e2e/fixtures.ts` (the e2e tenant is raw-SQL seeded, so it gets one `failure_code` row per code in the
`LISTS` array — aliases are not exercised by this journey), `apps/web/e2e/coded-close.spec.ts` (new one journey).

**Red:** `pnpm exec vitest run apps/web/src/screens/settings/lists-specs.test.ts apps/web/src/components/reportFields.test.ts`
and `pnpm exec playwright test apps/web/e2e/coded-close.spec.ts`. **Green:** the same, then
`pnpm exec playwright test apps/web/e2e/closes.spec.ts` (its "Maintenance Code" label is unchanged by R2, so it proves
the old journey still passes) and `pnpm ui:check`.

**Acceptance.**

- Given the head opens Settings → Lists, when they open Failure codes, then the plant's codes are listed with a
  readable label (the description for the 19 known codes, the plant's own label for a custom one), each row's old codes
  are shown and editable, and the screen is reachable from the hub without new screen code.
- Given an old ticket closed with code `E`, when the head switches `E` off on that screen, then the ticket detail still
  shows `E`, the close form no longer offers it, and the switch is in the audit trail.
- Given the floor writes a report, when they reach the classification step, then "Maintenance Code" lists only switched-on
  failure codes, the report cannot be sent without one, and the journey sees the code on the closed ticket afterwards.
- Given a plant with no `failure_code` rows yet (the deploy window), when the floor opens a close, then the same
  "Maintenance Code" box lists the plant's maintenance codes rather than nothing, the close stores the picked value as
  the failure code and the list exists on the next read (R4's bridge).

## Rails

Red first in every packet (the named test is red before the source edit; a verification packet's red is a named
mutation); never delete, skip or weaken a test. One writer per packet, one PR, one fragment section in packet order.
No new dependency, no new table (D17), no migration (46 owns M4b's), no change to `maint_code`'s or `failure_code`'s
rows by SQL outside `scripts`/repo files (`pnpm boundaries`); every new query names `tenant_id` and runs inside the
tenant transaction; `app_user` keeps only its existing grants. File ≤ 400 wc-lines, function ≤ 60, plan and fragment
formatted by prettier (`pnpm format:check`). The frozen seam for 48/49/51/52 and M6 is: `resolveFailureCode`,
`failureCodeIndex`, `ensureFailureCodes`, `failureCodeSeedRows` and the fallback `DEFAULT_FAILURE_CODES` in
`apps/server/src/seed/failure-codes.ts`, the four `breakdown_report.failure_*` columns, the four `storedReportSchema`
fields, and `failure_code` in `LIST_NAMES`. `pnpm precheck` before every push; the reviewer is
fresh and runs the covering suite, not only the named test.

## Where a reviewer should push

47b carries the ticket's real cost: the rule changes a contract every close test relied on, so about 35 call sites
gain one code and two tests change meaning on purpose (`ticket-report.test.ts:258-270` now expects the refusal, and the
"applies defaults" case keeps every assertion). The reviewer should check that no other assertion moved and that the
rule uses the shared channel predicate rather than a fourth copy of `import`/`backfill` string checks. R4's seed is the
second: it copies the plant's `maint_code` rows, so a plant with a custom code gets it — attack whether copying is right
(a plant's own label is copied as it stands; only a bare-code label takes the fallback description), and whether the
`maint_code` bridge can be removed once every plant has the list. Third, `aliases` becomes a field on every list's
create/patch and a key of every list reply; the reviewer should confirm the other list screens declare it hidden (the
D05 guard) and that the 0014 trigger still owns alias uniqueness. Fourth, 47a's reply-contract count moves 137 → 140 in
the same PR as the list, so the route table and `REPLY_SCHEMAS` must still match exactly.

## Not in this ticket

No AI suggestion of the code (M6, ticket 55+); no Pareto/heatmap by code (48); no per-slot failure taxonomy and no
four-picker close (R1); no change to the importer's alias config or to 37's synthetic N12 map; no historical backfill
of failure codes onto imported rows (R8); no new table or migration.
