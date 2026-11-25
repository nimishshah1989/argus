# 0044 — The last old-design screens (S19, S23, S24, S25, S26) onto the v2 kit: how the tickets split

Date: 2026-11-25 · Decided by: Plan (unattended; coordinator's planning job). Kit rules are ADR 0036 and are not re-planned here.

Status: **issues #760 (S26-0 kit), #761 (S19), #762 (S25), #763 (S23) created; seeds pushed for #760, #761, #762.** #763 has no seed yet; S24 has no issue yet.

Added 2026-11-25 (second session, unattended): S23/S24 are built on the printed-page pattern with a computed takeaway per
section; the wireframes' calendar/ranked-bar redraw, worst-first sorting and collapsed tails are Nimish's open
questions, so they are MISSING rows in the coverage tables and not built. S25's chip groups come from the wireframe
(`GROUP_OF` in `screens/v2/guide/model.ts` on `plan/t762`). S26-0 reuses v1's `CrudSpec` and `crud-actions` hooks;
the kit copies `useCrud`/`useLookups` because a `Screens: none` PR may touch only `apps/web/src/ui/` (ADR 0040).
The next Plan session writes the issues and seeds from this file without re-reading the v1 code.

## Decisions (assumptions, unattended)

1. **S19 is `/login` only.** The approved wireframe `S19-login.html` draws only the sign-in form (brand, Username,
   Password, Show password, Sign in, the 30-day hint). `/who` and `/password` are not in it, so they stay v1 and are
   not touched; `faces/signin/parts.tsx` stays (both use its `Notice`). The ticket builds `screens/v2/sign-in/`
   (`model.ts`: `signInError` mapping, ready rule, where to go next; `View.tsx`: kit form), routes `/login` to it in
   `App.tsx` (one line) and deletes `faces/signin/sign-in.tsx` and the sign-in-only parts of `parts.tsx` (`Fields`,
   `signInError`, `SIGNED_OUT_PARAM` if unused after). It must keep the labels "Username", "Password", the button
   "Sign in" and the landing URLs: `e2e/sign-in.ts` and 58 specs depend on them.
2. **S23 and S24 share one v1 page** (`ReportsPage.tsx`, `report-view.ts`, `?screen=monthly-report|annual-report`).
   Two tickets in two folders (`screens/v2/monthly-report/`, `screens/v2/annual-report/`), each on the printed-page
   pattern (`screens/v2/printed-page/PageBody.tsx`, `page-model.ts`) over the answer-key figures
   `monthly-report.json` / `annual-report.json`. S23 adds its `LIVE` entry (`group: 'reports'`,
   `screen: 'monthly-report'`) and `FIRST.reports`; S24 adds its entry and **deletes** `ReportsPage.tsx`,
   `report-view.ts`, `ReportsPage.test.ts`, `report-view.test.ts` and the `reports` branch of `Analytics.tsx`. So S24
   builds after S23. The one exception to "each PR deletes its v1 page": until S24, v1 still draws the annual tab.
3. **S25 Guide:** `screens/v2/guide/`, reusing `guide-entries.ts` (36 entries, 4 unbuilt) as its data; `LIVE` entry +
   `FIRST.guide`; deletes `GuidePage.tsx` and the `guide` branch of `Analytics.tsx`. The 8 group chips are built (the
   wireframe is approved); no search box (v1 had none). `e2e/analytics-guide.spec.ts` must keep 36 contents links,
   `#guide-<id>` anchors and the link hrefs.
4. **S26 Settings is two surfaces:** `/desk/settings` (`screens/Settings.tsx`, `components/SettingsSections.tsx`,
   `SlaSettingsSections.tsx`, admin|head) and `/settings/*` (`screens/settings/Plant.tsx` menu + gate, most pages
   generic `patterns/crud-page.tsx` configs). Tickets, in build order:
   - **S26-0 kit (`Screens: none`, ADR 0040):** a v2 CRUD list + form sheet in `apps/web/src/ui/v2/` with the
     behaviour of `crud-page`/`form-sheet`/`crud-actions` (Add `POST` + Idempotency-Key, Edit `PUT` all fields +
     `active`, `separate` fields via their own route, on/off with optional reason, required-only client check, server
     message inline, not optimistic, offline blocked). **Must merge before the CRUD page tickets.**
   - **S26-1 shell + jobs:** `Plant.tsx` → v2 menu/gate (admin|head; People/Logins admin only; Jobs `canSeeJobs`),
     the failed-jobs badge (v1's only badge; the wireframe's other attention badges are a question to Nimish, not
     built), `Jobs.tsx`. Leaves a one-line page registry the other tickets add to.
   - **S26-2** machines, groups, shifts (`plant-specs.tsx`, `machine-production.tsx`).
   - **S26-3** PM plans, registers, roster (+ copy roster), ladder.
   - **S26-4** people, logins (`People.tsx`, `people-specs.tsx`).
   - **S26-5** audit (`Audit.tsx`: area/person/from/to filters, cursor paging, admin-only CSV).
   - **S26-6** lists hub + 6 lists, glossary, analytics profile.
   - **S26-7** company (fields, features, logo, one PUT per changed key) + translations.
   - **S26-8** `/desk/settings`: criticality, severity matrix, SLA policies, restore-clock pauses, all states.
   S26-2…8 each depend on S26-0 and S26-1 only, and are independent of each other.
5. **Shared files, by one-line edits only:** `App.tsx` (route), `screens/v2/live.tsx` (`LIVE` entry, `FIRST`),
   `live-frame.tsx` (`ModelKey` union), `Analytics.tsx` (drop one import + one branch: Guide and S24 both do this;
   the second to merge takes main's file and removes its own two lines), `insight-coverage.test.ts` (`SECTIONS`, plan
   writes it on the seed). Each ticket names a distinct anchor line so merges do not touch the same lines.
6. **Coverage tables** `docs/design/v2/scope/<folder>.md` are written by Plan on each seed from the wireframe's own
   coverage section and the v1 inventory below; any MISSING row goes at the top, waiting for Nimish's written yes.
7. Not in scope: Money Matters (#679), batches #750–#753 folders, any other v2 screen folder.

## v1 inventory (from this session's read; file:line)

- Sign-in: `faces/signin/sign-in.tsx` 80 (WizardPage, `getBrand`, `signIn` → `setToken`/`rememberWho`/
  `rememberUsername`; shared login without acting person → `getConfig` then `/who`, else `landingPath(role)`),
  `parts.tsx` 80 (`signInError`: non-ApiError → `signin.unreachable`, `rate_limited` → `signin.tooMany`,
  `not_found` → `signin.unknownCompany`, `internal` → `signin.serverProblem`, else `login.failed`; `?signedOut`
  banner; Show password), `last-username.ts`. Routes `App.tsx:41-43`. e2e: `signin.spec.ts`, `signed-out.spec.ts`,
  `who-is-acting.spec.ts`, `landing.spec.ts`. Landing: `roles.ts:21-34`.
- Reports: `ReportsPage.tsx` 133, `report-view.ts` 101; links `/api/v1/reports/{monthly|annual}.pdf` and
  `/api/v1/reports/workbook.xlsx`; period line (monthly = month before run month; annual = "2026 to 11 November");
  untitled table captioned "Management commentary and actions"; empty `analytics.report.empty`, not computed.
  Engine: monthly 8 tables + `ch-rp-daily`, `ch-rp-12m`; annual 12 tables (two share "Preventive maintenance and long
  breakdowns") + `ch-ry-month`, `ch-ry-pareto`. Tests `ReportsPage.test.ts`, `report-view.test.ts`, e2e
  `analytics-reports.spec.ts:101`, `analytics-shell.spec.ts:19,53,89`.
- Guide: `GuidePage.tsx` 94, `guide-entries.ts` 312 (`guideFigureLinks`); tests `guide-entries.test.ts`,
  `v2/nav.test.ts:66`, e2e `analytics-guide.spec.ts:10`, `analytics-shell.spec.ts:109`.
- Settings: routes `App.tsx:51-55`; per-page fields, validation and API calls as in decision 4; e2e
  `settings-{severity,plant,production-data,people,lists,company,translations,audit,jobs,registers,roster}.spec.ts`,
  `sla-timers.spec.ts`, `pm-plans.spec.ts:138`, `analytics.spec.ts:273,445`, `coded-close.spec.ts:50`,
  `escalation-history.spec.ts:260`, `gallery/board-settings-order.spec.ts`. Unit tests in `screens/settings/*.test.ts`
  (D05 hidden-key checks per spec). Gap found: `task_reason` list has no menu entry (spec §7 L259 names it);
  roster/ladder people choices read admin-only `/api/v1/people` (a head may get an empty list): check before S26-3.
- SPEC.md has no Settings/Reports/Guide headings: §2 L57, L65, L67, L83; §7 L243-259; §9 L290-293.
