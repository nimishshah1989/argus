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
  (`apps/server/src/seed/cosmos-data.ts:152-163`, `:262`) — which is exactly what ticket 47 has to replace with aliases.
- The list is a generic settings resource: one entry in `LIST_NAMES` gives the API routes, the reply contract, the
  admin permission and the audit (`packages/shared/src/config.ts:4-16`, `apps/server/src/modules/plant/settings-lists.ts:14-60`,
  `:81`; audit at `apps/server/src/modules/plant/settings-routes.ts:160-167` and `:245-250`). The web hub is also
  config: `LIST_PAGES` + an icon (`apps/web/src/screens/settings/lists-specs.tsx:101-163`,
  `apps/web/src/screens/settings/Lists.tsx:18-24`).
- A new list can be given starting rows the first time it is read, idempotently and audited, without a migration:
  `apps/server/src/modules/plant/lockout.ts:12-30` (advisory lock, `has…` check, insert-on-conflict, one audit line),
  wired as the resource's `prepare` (`settings-lists.ts:51`) and called from the ticket paths that need it.
- A plant that already holds tickets cannot be re-seeded: `seed:cosmos` refuses a tenant with any ticket, import batch
  or audit row (`apps/server/src/seed/cosmos.ts:80-97`). Cosmos is live, so its list must arrive through the lazy
  default, not a re-seed.
- The close form already **requires** its maintenance code before it can send (`apps/web/src/components/reportFields.ts:135-143`),
  and the classification step renders it from `maint_code` (`apps/web/src/components/ReportSections.tsx:193-199`).
  Every other report requirement works the same way: the form enforces it and the API accepts an omitted field —
  `apps/server/test/ticket-report.test.ts:190-205` is the test that says a close with `report: {}` succeeds and gets
  defaults. The design lock keeps floor and desk **copy** as v3 has it, and `closes.*` is a frozen catalogue namespace
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
required pickers and one change to `reportReady`; the columns and the trigger already accept it.

**R2 — the floor keeps the plant's word "Maintenance Code"; the settings screen is "Failure codes".**
The design lock freezes floor and desk copy, and the `closes` namespace is frozen in the catalogue test; renaming the
label would need both a lock decision and a frozen-copy entry. The one visible change on the floor is where the
options come from. The picked value is stored in `failure_component` **and mirrored into `maint_code`**, so every
existing figure, PDF (`apps/server/src/modules/reports/pdf-template.ts:90`) and screen that reads `maint_code` counts a
new close without any of them changing. Cost if wrong: one list carries two names (the plant's on the form, the data
map's on the screen), which costs a copy change and a lock decision, not data; the aliases and the two columns keep the
data consistent either way.

**R3 — presence is enforced by the form; the server enforces provenance and refuses an unknown code.**
Every other required report field is the form's (`reportFields.ts:135-143`) and the API's contract is that an omitted
report field takes a default (`ticket-report.test.ts:190-205`); imports and old offline clients send reports with no
code. So the server's named refusal is only for a code that is sent and is not this plant's: HTTP 422, `validation`,
message **"That is not a failure code of this plant"**, field `report.failureComponent` (the trigger's own wording,
`0015:52-53`), raised before the database so the caller gets a field and not a 500. A missing code is not a server
refusal. An empty code at close never reaches the server from the floor because the button is disabled;
the data checklist already lists an uncoded report (`data-checklist.ts:69`). Cost if wrong: a non-app client can close
uncoded; the fix is one schema `superRefine` on `closeTicketSchema` plus a code on the report fixtures, no schema change.

**R4 — the 19-code list is a tenant default created on first use, not a migration and not a re-seed.**
`ensureFailureCodes` (the `lockout.ts:12-30` shape: advisory lock, `has…` check, insert-on-conflict, one audit line) is
called from three places so no plant can be left without a picker: the first `GET /config` (the close form's source of
lists, `plant/service.ts:54-70`), the `failure_code` settings list read (`settings-lists.ts:51`), and the close/report
write (before the code is resolved). One source for the 19 rows and the three aliases
(`packages/shared/src/failure-codes.ts`). Cosmos live gets them on its next config load; a plant created later gets
them the same way. Cost if wrong: one extra indexed SELECT per config load and, once, 19 inserts under a per-tenant
lock (the lockout list already does this on every read); if the config call site were dropped, the floor's picker could
be empty on a fresh plant — that is why it is the first of the three.

**R5 — aliases: `E`←`ele`, `HY`←`hyd`, `RT`←`rot`. Nothing else is seeded.**
D31 binds the three (`docs/decisions/D31-m4a-migration-homes.md:12`), the export calls them "(alt)", DATA-MAP says the
old codes ride on the row's `aliases` "rather than kept as a rival list" (`docs/DATA-MAP.md:63`), and that amends the
earlier PARITY line "keep both sets, mark the three as inactive" (`docs/spec/PARITY.md:163`). `MEC`, `NI`, `INT`, `FS`,
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

**R7 — legacy codes are canonicalised on read in the analytics loader only.**
`load.ts:120-122` is the single seam every figure's `maintCode` passes; the loader resolves it with the same list map,
so the annual "By cause", the monthly code tables and the breakdown log count `ELE` as `E`, beside a new close's `E`.
Report display is the report's own truth and is not rewritten: the ticket detail and the PDF show the code as recorded
(which is how a switched-off code "still shows on old reports" — nothing filters reads by `active`). Cost if wrong: a
figure and a report could read differently for an old row (`E` vs `ELE`); the figure is the one that must be one code
per R2 of the ticket, and the log remains the honest record.

**R8 — past breakdowns and imports keep the legacy code; the four failure columns stay NULL there.**
`POST /tickets/past` is the after-the-fact door for old paper and writes through the import path
(`apps/server/src/modules/tickets/past.ts:95-116`); history has no codes (`33% have no fault code`,
`docs/discovery/01-SCOPE-BRIEF.md:55`). A past breakdown can still carry `maintCode` (one of the 19) and counts in
every code figure. Cost if wrong: a desk-entered past breakdown cannot be coded into the four columns until someone
extends that path; no data is guessed and no migration is needed.

**R9 — tenancy and the engine.** Every new query names `tenant_id` explicitly (the trigger's own pattern,
`0015:48-74`) and runs inside the tenant transaction; another plant's code is refused by the trigger and never resolves
in this plant's index. The engine keeps reading `data.lists['maint_code']` for labels; the `failure_code` descriptions
are for the settings screen, and switching `codeLabel` to them is 48's call when the Pareto axis exists.

## Packet 47a — the one list, with Bhavin's old codes riding on it (API, one PR)

**Files (10; this is the named shared seam — one list with four entry points, so the 3-file cap is exceeded by design).**
`packages/shared/src/failure-codes.ts` (new: `DEFAULT_FAILURE_CODES` — the 19 codes in `input.json` order with their
descriptions as labels and their position as `sort` (the picker shows the plant's order, not the alphabet),
`E`/`HY`/`RT` carrying `ele`/`hyd`/`rot`; `failureCodeIndex(rows)`; `resolveFailureCode(index, value)` — trim,
lower-case, code first then alias, `null` when neither), `packages/shared/src/config.ts` (`'failure_code'`
after `'maint_code'` in `LIST_NAMES`), `packages/shared/src/index.ts` (one export line),
`packages/shared/src/plant-settings.ts` (`aliases` on `listFields`: create/patch take `''`, `'ele, hyd'` or an array and
normalise to a lower-case array; reply returns the array), `apps/server/src/modules/plant/repo/reads.ts`
(`failureCodes(tx, tenantId)` with `code, aliases`, `hasFailureCodes`, `insertFailureCode` on conflict do nothing,
`lockFailureCodeSeed`), `apps/server/src/modules/plant/failure-codes.ts` (new: `ensureFailureCodes(tx, who)` and
`failureCodeIndexOf(tx, tenantId)`), `apps/server/src/modules/plant/settings-lists.ts` (`prepare` for `failure_code`,
`aliases` in columns and reply), `apps/server/src/modules/plant/service.ts` (`ensureFailureCodes` before
`loadPlantRows` in `loadConfig`, login when the route has one), `apps/server/src/modules/plant/index.ts` (two exports),
`apps/server/test/failure-codes.test.ts` (new).

**Red:** `pnpm exec vitest run apps/server/test/failure-codes.test.ts` (no such module). **Green:** the same, then
`pnpm exec vitest run apps/server/test/plant-settings-cosmos.test.ts apps/server/test/plant-settings-access.test.ts packages/shared/test/catalogue.test.ts`.

**Acceptance.**

- Given a plant that never opened Settings, when its config loads (or the `failure_code` list is read), then the list
  holds the 19 live codes with descriptions and `E`/`HY`/`RT` carry `ele`/`hyd`/`rot`, exactly once; a second read and a
  second config load add nothing.
- Given the list, when the head edits a row's old codes to `'ele, ELECTRICAL'` and the admin switches a code off, then
  the reply carries `['ele','electrical']` and `active:false`, both edits leave one `list_item.update` audit line with
  before/after, and a code or alias already used in the list (any letter case) is refused 409 by the 0014 trigger.
- Given plant B's alias, when plant A's list is read, then it is absent and the resolver never returns it.

## Packet 47b — coded closes and one code on read (API, one PR)

**Files (6).** `packages/shared/src/ticket.ts` (`breakdownReportSchema` gains the four optional `failure*` strings,
`.max(60)`), `packages/shared/src/ticket-reply.ts` (the four nullable strings on `storedReportSchema`),
`apps/server/src/modules/tickets/repo/report.ts` (`ensureFailureCodes` first per R4, then resolve each of the four
submitted values through `failureCodeIndexOf` before insert, write the four columns and the mirrored `maint_code`,
select and build them in `loadReport`/`buildStoredReport`, under 400 wc-lines; the file is 329 now), `apps/server/src/modules/tickets/outcome.ts` (`ReportValidationError` carries the refusal text so
it is not the generic "Invalid report"), `apps/server/src/modules/analytics/load.ts` (one line: `maintCode` resolved
through the same index), `apps/server/test/failure-code-closes.test.ts` (new). The past-breakdown and import path is not
edited: it keeps writing `maint_code` only (R8).

**Red:** `pnpm exec vitest run apps/server/test/failure-code-closes.test.ts`. **Green:** the same, then
`pnpm exec vitest run apps/server/test/ticket-report.test.ts apps/server/test/tickets-past.test.ts apps/server/test/analytics-engine.test.ts apps/server/test/import-real.test.ts packages/db/test/m4b-schema.test.ts`.

**Acceptance.**

- Given a started ticket and the list, when the technician closes with the code `E`, then the report row holds
  `failure_component = 'E'` and `maint_code = 'E'`, the detail reply returns both, and the PDF and the breakdown log
  show `E`.
- Given a legacy history row (channel `import`) stored with `maint_code = 'ELE'` and a new close coded `E`, when the
  annual report's "By cause" is computed, then it holds one `E` row that counts both, and each count drills to its own
  ticket: legacy and new closes count in one code.
- Given a client built before this ticket, when it sends `maintCode: 'ele'`, then the stored code is `E` (alias, any
  case); when it sends `NOPE`, then the reply is 422 `validation`, "That is not a failure code of this plant", field
  `report.failureComponent`, and nothing is written.
- Given a code used on a close and then switched off, when the ticket detail is read, then the report still shows the
  code; when `/config` is read, then the entry is there with `active:false` and the close form's options omit it.
- Given an imported report with no codes, when it is read and counted, then every `failure*` column is NULL, no trigger
  refusal occurs, and the row still counts under its `maint_code`.

## Packet 47c — the screen and the floor's picker (web, one PR)

**Files (8).** `packages/shared/src/i18n/lists.en.ts` (the `failure_code` title/add/empty/menu/sub keys, `lists.field.aliases`
and its hint; `lists.gu.ts` is `blank(listsEn)`, so no Gujarati file changes), `apps/web/src/screens/settings/lists-specs.tsx`
(`ListsPage` gains `failure_code`; its spec shows the `aliases` field and every other list hides it with a reason),
`apps/web/src/screens/settings/Lists.tsx` (one icon), `apps/web/src/screens/settings/lists-specs.test.ts` (the new page,
the aliases field on it and hidden elsewhere, the D05 guard already walks the reply schema),
`apps/web/src/components/ReportSections.tsx` (the required Choice is sourced from `failure_code`, same position, same
"Maintenance Code" copy), `apps/web/src/components/reportFields.ts` and `reportFields.test.ts` (`maintCode` in the form's
values becomes `failureComponent`; `buildReportBody` sends it; `reportReady` requires it), `apps/web/e2e/coded-close.spec.ts`
(new one journey).

**Red:** `pnpm exec vitest run apps/web/src/screens/settings/lists-specs.test.ts apps/web/src/components/reportFields.test.ts`
and `pnpm exec playwright test apps/web/e2e/coded-close.spec.ts`. **Green:** the same, then
`pnpm exec playwright test apps/web/e2e/closes.spec.ts` (its "Maintenance Code" label is unchanged by R2, so it proves
the old journey still passes) and `pnpm ui:check`.

**Acceptance.**

- Given the head opens Settings → Lists, when they open Failure codes, then the 19 codes are listed with their
  descriptions, each row's old codes are shown and editable, and the screen is reachable from the hub without new
  screen code.
- Given an old ticket closed with code `E`, when the head switches `E` off on that screen, then the ticket detail still
  shows `E`, the close form no longer offers it, and the switch is in the audit trail.
- Given the floor writes a report, when they reach the classification step, then "Maintenance Code" lists only switched-on
  failure codes, the report cannot be sent without one, and the journey sees the code on the closed ticket afterwards.

## Rails

Red first in every packet (the named test is red before the source edit; a verification packet's red is a named
mutation); never delete, skip or weaken a test. One writer per packet, one PR, one fragment section in packet order.
No new dependency, no new table (D17), no migration (46 owns M4b's), no change to `maint_code`'s or `failure_code`'s
rows by SQL outside `scripts`/repo files (`pnpm boundaries`); every new query names `tenant_id` and runs inside the
tenant transaction; `app_user` keeps only its existing grants. File ≤ 400 wc-lines, function ≤ 60, plan and fragment
formatted by prettier (`pnpm format:check`). The frozen seam for 48/49/51/52 and M6 is: `DEFAULT_FAILURE_CODES`,
`resolveFailureCode`, `failureCodeIndex`, `ensureFailureCodes`, the four `breakdown_report.failure_*` columns, the four
`storedReportSchema` fields, and `failure_code` in `LIST_NAMES`. `pnpm precheck` before every push; the reviewer is
fresh and runs the covering suite, not only the named test.

## Where a reviewer should push

R3 is the one deliberate thinness: the rule "every close requires a code" is the form's, the server refuses only an
unknown code, and the fixtures prove that is the codebase's contract for every required report field. If the reviewer
wants the API to refuse a missing code too, that is one `superRefine` and one line per close fixture, and the first
packet's list is already there to make it possible. R4's write during `GET /config` is the second: it is the lockout
list's pattern, but it is the first time the config route writes.

## Not in this ticket

No AI suggestion of the code (M6, ticket 55+); no Pareto/heatmap by code (48); no per-slot failure taxonomy and no
four-picker close (R1); no change to the importer's alias config or to 37's synthetic N12 map; no historical backfill
of failure codes onto imported rows (R8); no new table or migration.
