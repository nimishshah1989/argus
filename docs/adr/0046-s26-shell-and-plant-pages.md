# 0046 — S26-1 Settings shell + jobs, S26-2 machines/groups/shifts: how they are seeded

Date: 2026-11-25 · Decided by: Plan (unattended). Follows ADR 0044 decision 4; kit (ADR 0036, S26-0 #760) is not re-planned.

## Decisions (assumptions, unattended; issues/seeds not written yet: context budget)

1. **Folders and coverage files.** S26-1 → `apps/web/src/screens/v2/settings/` (`scope/settings.md`); S26-2 →
   `apps/web/src/screens/v2/settings-plant/` (`scope/settings-plant.md`). Two folders so the two tickets never edit the
   same coverage file.
2. **The shell.** `/settings` and `/settings/<page>` route to v2 `SettingsView` inside the kit `Shell` (rail from
   `navItems`, Desk marked current, title `plant.title`). The menu is a `<nav aria-label={t('plant.menu')}>` of links:
   Desk (Open, Live board) then the plant pages, as v1's SideNav; the phone home is the list with sub-line and chevron,
   a "Back to desk" link, and a page has a "Settings" back link. Gate: admin|head (else `plant.noAccess`); jobs entry
   only when `canSeeJobs`; People/Logins keep v1's own admin gate inside the page. Wide `/settings` → `/settings/machines`.
   Every selector `e2e/settings-plant.spec.ts` and `settings-jobs.spec.ts` use is kept (nav "Settings", link "Open",
   link "Settings", "Back to desk", link /Background jobs/ with "n failed", job rows are list items).
3. **Registry.** `screens/v2/settings/registry.ts`: `V2_VIEWS: Partial<Record<PlantPage, ComponentType>>`, one comment
   line per later ticket (`// S26-2` … `// S26-7`) as anchors; a ticket adds its lines under its own comment, so
   merges never touch the same lines. A page not in `V2_VIEWS` draws v1's body (`Plant.tsx` keeps `PLANT_PAGES` and
   exports its `Body`; its v1 shell, `Home`, `NoAccess` go).
4. **Jobs** is a list of kit rows (not a table): the e2e relies on list items and the reason must be readable before a
   retry. Takeaway: "1 job has failed: <kind>, <n attempts>, failed <ago> (<when>)", oldest failure first, tag
   `jobs.count`. Only v1's failed-jobs badge is built; the wireframe's other attention badges are its open question.
5. **S26-2** pages = kit `CrudPage` with v2 specs in its folder (wireframe columns: machines Code/Type/Criticality/Status,
   status chips, flag "not counted"; groups Segment and group/Machines/Shown; shifts Shift/Starts/Ends/Hours with a
   "Crosses midnight" tag) plus a computed takeaway drawn above the page from the same cached list query. The kit
   `CrudPage` shows every v1 column (nothing folded); the wireframe's per-row "other columns" fold is noted as changed,
   not dropped. v1 `plant-specs.tsx`/`machine-production.tsx` deleted by the build; their tests retargeted on the seed.
