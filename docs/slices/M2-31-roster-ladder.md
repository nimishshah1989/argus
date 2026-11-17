# M2-31a — duty roster and escalation ladder on Settings, and the lockout list pages

Milestone M2 (Accountability), tickets 31 (goal 1) and 66 (settings half). Frozen plan: one writer, the files
named below. Read `docs/LEAN.md`, `docs/TESTING.md`, `apps/web/src/screens/settings/lists-specs.tsx` and
`apps/server/src/modules/accountability/settings-resources.ts` before writing anything.

## What already exists (do not rebuild)

- The server already owns both resources as generic settings pages:
  `LADDER_RESOURCES = [roster, rules]` in `apps/server/src/modules/accountability/settings-resources.ts`,
  registered by `registerSettings` in `routes.ts` as `GET/POST /api/v1/settings/roster`,
  `GET/POST /api/v1/settings/escalation-rules` and `PUT /:id` (a row is switched off, never deleted).
- It already refuses a ladder repeat under 15 minutes and a repeat with no cap (`checkRepeat`), and it seeds a
  plant's first ladder and its lockout steps (`ensureEscalationDefaults`, `ensureLockoutSteps`).
- All list names already exist on the server (`LIST_NAMES` in `packages/shared/src/config.ts`), including
  `breakdown_category` and `lockout_step`; the lockout step list is seeded with the four starting steps and is
  an ordinary editable list.
- The browser has no page for any of it: `PLANT_PAGES` in `apps/web/src/screens/settings/Plant.tsx` has
  machines, groups, shifts, people, logins, audit, lists, glossary, company, translations. `LIST_PAGES` in
  `lists-specs.tsx` has wait_reason, work_type, quick_problem only.

## What this ticket adds

### 1. Server: copy a day's roster forward

- `packages/shared/src/escalation-settings.ts`: `export const rosterCopySchema = z.object({ date: calendarDay }).strict();`
  and `export type RosterCopy = z.infer<typeof rosterCopySchema>;`
- `apps/server/src/modules/accountability/repo/ladder.ts`: `copyRoster(poolClient, tenantId, input: { date: string; days: number })`
  → `{ created: number; skipped: number }`. It copies every roster line whose `date = input.date` to the same
  `shift_id`, `person_id`, `level` on each of the next 7 dates (`days = 7`), `ON CONFLICT (tenant_id, date,
shift_id, person_id) DO NOTHING`, counting created and skipped rows. No line is ever deleted.
- `apps/server/src/modules/accountability/routes.ts`: `POST /api/v1/settings/roster/copy` — `requireAuth`,
  `canSettingsSla` (admin or head) else `forbidden`, body parsed with `rosterCopySchema` else 422
  `apiError('validation', <message>, 'date')`; refuses a date older than the one-year roster floor
  (`ROSTER_KEEP_DAYS` in `ladder.ts`) with 422 naming `date`. One audit row through `audit.record`:
  `action: 'roster.copy'`, `entity: 'roster_entry'`, `after: { date, days: 7, created, skipped }`.
  Reply `{ created, skipped }`.
- `checkRule` in `settings-resources.ts`: a rule with `channel !== 'push'` answers
  `{ field: 'channel', message: 'WhatsApp arrives in M3; escalation is push only for now' }`.

### 2. Browser: two new settings pages and two new list pages

- `apps/web/src/screens/settings/roster-spec.tsx`: `rosterSpec: CrudSpec<RosterReply>` over
  `/api/v1/settings/roster` (schema `rosterReplySchema`) with lookups for shifts and people (see
  `plant-specs.tsx` for the lookup pattern and `people-specs.tsx` for the people/shift paths), fields
  `date` (text), `shiftId` (choice), `personId` (choice), `level` (choice L1–L4, vendor), columns date/shift/
  person/level, search by person. Switch off is the row's `active`. Export also
  `RosterScreen` = the `CrudPage` plus one action above it: a date input (default the plant's today from
  `getConfig().timeZone`) and a **Copy to the next 7 days** button that calls the new route and shows
  `roster.copied` with the returned counts (`{{created}}` / `{{skipped}}`), or the server's refusal text.
- `apps/web/src/screens/settings/ladder-spec.tsx`: `ladderSpec: CrudSpec<RuleReply>` over
  `/api/v1/settings/escalation-rules` (schema `ruleReplySchema`): fields trigger (choice), severityMin (choice
  S1–S4), level (choice), notifyRole (choice) / notifyPersonId (choice person, optional, one of the two),
  channel (choice with **push only**), delayMinutes, repeatMinutes, repeatCap; columns trigger/severity/level/
  who/delay/repeat. The repeat floor and pairing are the server's answer: the screen must show the server's
  message, not re-word it.
- `apps/web/src/screens/settings/lists-specs.tsx`: add `breakdown_category` to `LIST_PAGES` with the
  `needsLockout` flag (title/sub/empty keys) and `lockout_step` as an editable list with **no** flags and the
  fields label/code/sort (four starting steps are seeded by the server; the page is how they are edited).
- `apps/web/src/screens/settings/Plant.tsx`: add `'roster'` and `'ladder'` to `PlantPage`, register
  `{ page: 'roster', icon: CalendarDays, key: 'plant.menu.roster', screen: RosterScreen }` and
  `{ page: 'ladder', icon: Siren, key: 'plant.menu.ladder', spec: ladderSpec as never }` in `PLANT_PAGES`.
- `apps/web/src/api.ts`: `copyRoster(date: string)` helper (see `putSeverityMatrix` for the shape) that
  returns `{ created: number; skipped: number }` and throws `ApiError` on refusal.
- Catalogues, **both languages** (`packages/shared/src/i18n/plant.en.ts` + `plant.gu.ts` and
  `lists.en.ts` + `lists.gu.ts`): menu titles and subs, field labels, copy button and its result, the list
  titles for the two new pages. Gujarati may start as the same English string only where the catalogue file
  already does that; every key must exist in both files.

## Tests — red first, then green

1. **Red (server):** in `apps/server/test/roster-ladder.test.ts`, `it('copies a day’s roster to the next seven
days, once')`: seed one line for today, `POST /api/v1/settings/roster/copy {date: today}` → 200
   `{created: 7, skipped: 0}`; the second call → `{created: 0, skipped: 7}`; the roster reply shows 8 lines;
   one audit row `roster.copy` exists; a head who is not admin still may copy; an operator gets 403.
2. **Red (server):** `it('refuses a ladder rule on WhatsApp and keeps the push rule')` — `PUT` an existing
   rule with `channel: 'whatsapp'` → 422 with `error.field === 'channel'`; `POST` a new rule with
   `channel: 'push'` succeeds; a repeat under 15 (`repeatMinutes: 10`) is still refused with `repeatMinutes`;
   a repeat with no cap is still refused with `repeatCap`.
3. **Red (web):** `apps/web/src/screens/settings/roster-spec.test.ts` and `ladder-spec.test.ts`, the D05
   reply-key check copied from `lists-specs.test.ts` (every schema key is a field or declared hidden with a
   reason), plus: the ladder channel choices are exactly `['push']`.
4. **Red (web):** extend `lists-specs.test.ts`: `breakdown_category` carries `needsLockout` and appears on the
   hub; `lockout_step` appears on the hub and its spec offers label and code.
5. **Red (browser):** `apps/web/e2e/settings-roster.spec.ts` — sign in as admin, seed one roster line for
   today through the API (`POST /api/v1/settings/roster`), open `/settings/roster`, press **Copy to the next 7
   days**, see the copied line and 8 rows in total. Keep it to one test and the chromium project.

Green commands (run them and paste the output in the report):

```bash
pnpm install --prefer-offline
pnpm exec vitest run apps/server/test/roster-ladder.test.ts
pnpm exec vitest run apps/web/src/screens/settings/roster-spec.test.ts apps/web/src/screens/settings/ladder-spec.test.ts apps/web/src/screens/settings/lists-specs.test.ts
pnpm exec playwright test apps/web/e2e/settings-roster.spec.ts --project=chromium
pnpm lint && pnpm typecheck && pnpm precheck
```

## Rails (do not break)

- Never delete, skip or weaken a test. A new behaviour gets a new test.
- One writer on these files only; no file outside the list above.
- Lean budgets: file ≤ 400 lines, function ≤ 60; no new dependency; no literal visible string (catalogue
  keys only, `t()` in the components); tokens and kit components only, no `className` with raw colours in
  `faces/`.
- No real names or phone numbers in tests or fixtures.
- Commit locally in small ordered commits. **Do not push, do not open a PR.**
- Report back: the files changed, the red output (the failing assertion), the green output of every command
  above, and anything the plan left silent (stop and ask instead of guessing).

## Addendum (Lead, same session) — binding

1. **Design reference (approved):** `docs/design/slices/slice-8-escalation-roster-lockout.html` and
   `docs/design/slices/README.md` § "Slice 8" — frames "Settings: duty roster", "Settings: escalation ladder",
   "Settings: edit a rule", "Settings: rule refused", "Settings: lists with needs-lockout flags", "Settings: flag
   a work type", "Settings: lockout steps". `docs/design/LOCK.md` § "Slice 8" is the rule list. Follow layout,
   states and copy; list every deliberate difference in the report.
2. **Verify the URL prefix** in `apps/server/src/modules/plant`'s `registerResource` before writing the spec or
   the copy route: use the real registered path.
3. **Evidence for the PR:** at the end of your new e2e spec, save two committed screenshots (360×800 viewport
   or the phone project): `docs/slices/m2-31-side-by-side/roster.png` (after the copy) and
   `docs/slices/m2-31-side-by-side/ladder.png`.

## Correction 2 (Lead, after the server survey) — binding, supersedes plan items

1. **Exact registered paths (verified):** the generic settings resources are at `/api/v1/roster` and
   `/api/v1/escalation-rules` (`plant/settings-routes.ts:215-258`, `resource.path` in
   `accountability/settings-resources.ts`). So the new copy route is **`POST /api/v1/roster/copy`**, and the
   browser specs use those paths. Do not use `/api/v1/settings/...`.
2. **Do NOT restrict the server's channel enum or add a server-side WhatsApp refusal.** The WhatsApp→push
   fallback is real, proven behaviour (`escalation.test.ts` "an edited rule is honoured: another level,
   another delay, another channel"; `accountability/escalation.ts:204-205,220`) and must stay for M3.
   "Push-only" is a **screen rule for now**: the ladder screen's channel field offers `push` only, and a web
   unit test asserts the choices are exactly `['push']`. Do not edit `apps/server/test/escalation.test.ts`,
   and do not delete or change the existing channel tests in `roster-ladder.test.ts`.
3. Therefore plan test 2 becomes: keep/extend the **existing** refusals test (repeat under 15, repeat with no
   cap — already `roster-ladder.test.ts:421-438`, run it, do not weaken it) and add only the web assertion that
   the ladder channel choices are `['push']`. No new server refusal is required.
4. The roster copy route keeps everything else in the plan: `ROSTER_KEEP_DAYS` floor refusal, `canSettingsSla`,
   one audit row `roster.copy`, reply `{created, skipped}`, idempotent on a second call.
