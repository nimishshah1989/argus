# 0047 — S26-1…S26-8 ticket designs (issues and seeds not written yet)

Date: 2026-11-25 · Decided by: Plan (unattended). Applies ADR 0044 decision 4–6 and ADR 0046; kit is ADR 0036 + #760
(merged, PR #776). Seeds follow ADR 0034 (critical tests only). The next Plan session writes the eight issues and the
`plan/t<N>` seeds from this file without re-reading the wireframe or the v1 code.

## Facts found (so nobody re-reads)

- Every settings list reply is whole: `settingsPage` = `{ items, nextCursor: z.null() }` (`packages/shared/src/plant-settings.ts:33`),
  so a takeaway count over the loaded list is exact. **Audit is the exception**: cursor-paged (`auditPageSchema`).
- `patterns/crud-page.tsx`, `form-sheet.tsx`, `crud-actions.tsx` stay: the gallery (`gallery/crud-*.tsx`,
  `form-section.tsx`), `components/closeSheets.tsx` and the v2 kit itself import them. No ticket deletes them.
- v1 desk settings (`screens/Settings.tsx`, `components/SettingsSections.tsx`, `SlaSettingsSections.tsx`) has
  criticality, matrix, SLA policies only. The wireframe's "Restore clock pauses" is the `wait_reason` list's
  `pausesSla` flag (`lists-specs.tsx`), edited today in Lists.
- Wireframe facts (S26-settings.html, 16 numbered cards + desk settings + states + coverage): every data page =
  takeaway, ≤5 default columns, tail opens in place, "Show the numbers", Add, empty line. Coverage says all kept.
  Its 6 open questions are notes in each coverage file and block nothing (ADR 0044: built as drawn).

## Shape of every ticket (as #761/#762)

Seed `plan/t<N>` from main: `screens/v2/<folder>/model.ts` (types + pure takeaway functions that throw),
`model.test.ts` (visible: the counts), `screens/v2/holdout/<folder>-edges.test.ts` (empty list → null, inactive rows
left out, ties), `docs/design/v2/scope/<folder>.md` (coverage from the wireframe table + v1 inventory, questions as
notes). Where a v1 spec file moves, the seed **moves its test** to the new folder and adds a one-line re-export stub
(`export { x } from '../../settings/x-spec.js'`) so the moved test stays green; the builder moves the body and deletes
v1. Each ticket registers its views under its own `// S26-k` line in `screens/v2/settings/registry.ts` and drops its
pages' `spec`/`screen` from `PLANT_PAGES` in `screens/settings/Plant.tsx`. e2e listed per ticket must stay green.
Every takeaway takes `now`/`today` as an argument. All takeaways count `active` rows only.

## Tickets

1. **S26-1 shell + jobs** (`screens/v2/settings/`, Sonnet, ~files<=10 lines<=600). Seed also carries `registry.ts`
   complete (`V2_VIEWS: Partial<Record<PlantPage, ComponentType>>` with `// S26-1` … `// S26-7` anchors).
   `model.ts`: `settingsAccess(role) → 'allowed'|'refused'|'waiting'` (admin|head; undefined = waiting);
   `jobsTakeaway(items) → { failed, kind, attempts, failedAt } | null` (oldest failure first, `failedAt ?? createdAt`).
   View per ADR 0046 decision 2 (kit `Shell`, `useNav` with the `desk` item marked current, title `plant.title`).
   Only v1's failed-jobs badge (ADR 0046). Edits `App.tsx` routes, `Plant.tsx` (export `Body`; drop shell, `Home`,
   `NoAccess`), `Jobs.tsx` (drop `JobsScreen`). e2e `settings-plant.spec.ts`, `settings-jobs.spec.ts`.
2. **S26-2 machines, groups, shifts** (`settings-plant/`, per ADR 0046 d5). `machinesTakeaway(rows) → {total, unset
(criticality null), excluded (excludedFromProduction)}`; `groupsTakeaway(groups, machines) → biggest by
`machine.groupId` {groupId, n, total, hidden}`; `shiftsTakeaway(shifts, prodHrsPerDay|null) → {count, totalHours}`
   (midnight wrap). Move `plant-specs.test.ts`; delete `plant-specs.tsx`, `machine-production.tsx`.
   e2e `settings-plant`, `settings-production-data`.
3. **S26-3 PM plans, registers, roster, ladder** (`settings-upkeep/`, ~files<=12 lines<=900).
   `pmTakeaway(plans, today)` overdue count, worst late, next due (via `pmPlanNextDue`); `registerTakeaway(rows, today)`
   soonest by `watchOf` + the next; `rosterGaps(entries, shifts, from, days=7)` L1 slots with nobody (active shifts),
   `{gaps[], covered, slots}`; `ladderSteps(rules)` trigger `ack_missed`, severity reaching `high`, sorted by
   `delayMinutes`. Move the four spec tests. Roster keeps "Copy to the next 7 days". Known v1 gap kept, not fixed:
   roster/ladder people lookups read admin-only `/api/v1/people`. e2e `pm-plans`, `settings-registers`,
   `settings-roster`, `escalation-history:260`.
4. **S26-4 people, logins** (`settings-people/`). Admin only (v1 `People.tsx`). `peopleTakeaway(rows) → {total,
noPhone}`; `loginsTakeaway(rows) → {total, shared}`. Move `people-specs.test.ts`; delete `People.tsx`,
   `people-specs.tsx`. e2e `settings-people`.
5. **S26-5 audit** (`settings-audit/`). `auditTakeaway(rows, hasMore, now)` over the last 7 days: `{count, area,
areaCount, by}` (area = `entity`, most rows, tie → newest; `by` = most rows within that area); **null when
   `hasMore` and the oldest loaded row is inside the window** (never a partial count). `mayExport(role)` = admin.
   Newest first kept. Delete `Audit.tsx`. e2e `settings-audit`.
6. **S26-6 lists hub, glossary, analytics profile** (`settings-lists/`). `listsTakeaway(counts) → longest {page, n,
total}`; hub tiles per list (link `?list=<page>`) and a read-only "All" table across the six lists (rows link to
   their list); a list page is the kit `CrudPage`. `glossaryTakeaway(terms) → {total, gu, guLatn, en}` from
   `direction`. `profileTakeaway(row) → {notSet: keys whose value is null, total: keys present}` (money keys absent
   for logins without money rights: never counted). Move `lists-specs.test.ts`, `analytics-profile-spec.test.ts`;
   delete `Lists.tsx`. e2e `settings-lists`, `analytics.spec.ts:273,445`.
7. **S26-7 company, translations** (`settings-company/`). Company stays a form, no takeaway (wireframe).
   `translationsTakeaway(overrides) → {missing, total}` from `missingTranslations` + the `en` key count. Move
   `company-spec.test.ts`, `translations-spec.test.ts`; delete `Company.tsx`, `Translations.tsx`.
   e2e `settings-company`, `settings-translations`.
8. **S26-8 desk settings** (`screens/v2/desk-settings/`, `/desk/settings`). `criticalityTakeaway(machines) → {total,
unset, A, B, C}`; `highCells(matrix)`; `slaRows(policies)`; `pausingReasons(waitReasons) → {pausing[], total}`.
   Restore clock pauses is read-only with a link to `/settings/lists?list=wait_reason` (one write path; noted in
   coverage as a question). All states kept (forbidden + SLA note, load failed, offline read-only, saved, failed).
   Deletes `screens/Settings.tsx`, `SettingsSections.tsx`, `SlaSettingsSections.tsx`. e2e `settings-severity`,
   `sla-timers`, `coded-close:50`.

Order: S26-1 first; S26-2…S26-8 after it, independent of each other (S26-8 touches only `App.tsx`'s `/desk/settings`
line). Menu attention badges and the menu takeaway are not built (ADR 0046 d4; wireframe question 1).
