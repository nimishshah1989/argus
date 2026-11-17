# M4a-37b — the analytics face shell and the profile screen (browser)

Part of ticket 37 (milestone M4a). The full plan is `docs/slices/37-engine-drill.md` on the sibling branch
`m4a-engine` (it lands with that PR); this file is the browser packet only. **Read the repo files it names before
writing anything.**

Part A of ticket 37 (#265) is merged: 43 figures are registered with screen, label, drill type and owner
(`packages/domain/src/analytics/registry.ts`), `GET /api/v1/analytics/figures` answers with
`{ asOf, profile, rows, figures }` (a figure is `{ key, screen, owner, status, value, drill: { type, ids } }`), and the
profile resource `GET/PUT /api/v1/analytics-profile` is live. `COMPUTERS` is empty, so **every figure is
`not_computed` today** — the shell must say so honestly, never a fabricated 0.

Design reference (approved, binding): `docs/design/slices/slice-9-analytics-1-dashboard-today.html` and
`docs/design/LOCK.md` § "Analytics face" (left menu in groups, Dashboard in the platform's order, head and plant head
open on Today, every figure shows its drill target, Money Matters heads/admin only; desktop first per SPEC §8, phone
is a reader). Build from the kit and patterns — no hand-built styling.

## What to build

1. **The face at `/analytics`**: the locked left-menu groups (Today, Machines, Breakdowns, Forecast & scorecard, PM,
   Cost, Reports, Guide); one route per group (`/analytics/<group>`); each screen renders its group's figures from
   `GET /api/v1/analytics/figures` — a tile per figure: label, the value when `status === 'ready'`, "Not computed
   yet" otherwise, and a **drill link** when `drill.ids` is non-empty. The drill link opens
   `/analytics/<group>?drill=<type>:<ids…>`; the shell then fetches
   `GET /api/v1/analytics/drill?type=<type>&ids=<ids>` (sibling packet 37a adds it; until it lands in main the shell
   must still compile and the e2e must not depend on a live drill) and shows the rows in a plain table of their
   identifying fields (a ticket's ref/machine/status, a machine's code/cell, a move's from/to/date).
2. **Entry points**: an **Analytics** item in the desk navigation (or account menu — follow the locked design) for
   head, plant_head and admin only, and a **Guide** entry in the face's menu: a static page listing each screen and
   its figures with their labels (the explanations arrive in ticket 45).
3. **The profile screen**: a generated `CrudPage` (`CrudSpec`) over `/api/v1/analytics-profile`, added as a page in
   `PLANT_PAGES` (`apps/web/src/screens/settings/Plant.tsx`), with the fields grouped exactly as `PROFILE_FIELDS`
   (`packages/shared/src/analytics.ts`): the money fields only for head/plant_head/admin; the server's 422 names the
   field to correct and the screen shows that message.
4. **Catalogue**: a new namespace `analytics.en.ts` + `analytics.gu.ts` registered in
   `packages/shared/src/i18n/index.ts`. Check how the newest namespaces do it (`company.en.ts`, `tasks.en.ts`) and use
   the same convention; a new namespace is outside the freeze list, so no `NEW_KEYS` edit is needed.

## Tests (red first)

- `apps/web/src/screens/settings/analytics-profile-spec.test.ts` — the D05 reply-key check copied from
  `lists-specs.test.ts` (every schema key is a field or declared hidden with a reason).
- `apps/web/e2e/analytics.spec.ts` — one journey: a head opens `/analytics`, sees the menu groups and the honest
  "Not computed yet" state, opens Settings → the analytics profile, saves one number and sees it persist, reloads and
  it holds; an operator gets no Analytics entry and is refused on the profile route. Keep to chromium unless the
  phone layout genuinely differs.

## Rails

Red test first, then green. Never delete, skip or weaken a test. Only the files named here (plus the one nav file and
`api.ts`). File ≤ 400 lines, function ≤ 60, screen files ≤ 300; no new dependency. Every visible string a catalogue
key in both languages; tokens and kit components only; no raw colours. Money only for head/plant_head/admin (hide what
the reply does not carry — never a second permission rule). Commit locally in small commits; **do not push, do not open
a PR**; report red output, green output for every command, and any deviation or question the plan leaves silent.

## Lead addendum (answers to the builder's two questions) — binding

**1. The locked menu groups and where each registry screen sits (final: the mapping that shipped).** The eight
groups are SPEC §8's (Today, Machines, Breakdowns, Forecast and scorecard, PM, Cost, Reports, Guide), and **every
registered figure belongs to exactly one group**; `groups.test.ts` fails when a registered figure is in no group or
in two. Shipped mapping: **Today** = `dashboard`, `action-center`, `team-focus`; **Machines** = `registers`,
`cell-change-log`, `a7-footprint`, `a8-age`, `machine-page`, `compare`, `a5-energy`, `data-checklist`;
**Breakdowns** = `breakdown-log`, `a1-bd-pm`, `a2-category-cell`, `a3-mttr-mtbf`, `a4-manpower`, `a6-why-why`,
`a10-problems`, `fix-finder`; **Forecast and scorecard** = `a9-bottleneck-forecast`, `forecast-lab`; **Cost** =
`money-matters` (the money screens' home until their figures land); **PM** = none until M4B (the entry says so
honestly); **Reports** = `monthly-report`, `annual-report`; **Guide** = static. The menu uses SPEC §8's group names
rather than the design HTML's own variant — a deliberate difference recorded in the PR.

**2. The Add button on the one-row profile screen.** The ruling: a control that can only fail is not shipped. Add an
optional `addable?: false` to `CrudSpec` (`apps/web/src/patterns/crud-spec.ts`) and make `CrudPage` render the Add
button/sheet only when it is not set to false; set `addable: false` on the analytics-profile spec. That pattern change
is **approved and in your scope** (one prop, one conditional, the existing generated screens are untouched). Test it
in the e2e: the profile screen has no Add button.

**Lead ruling (recorded):** (a) the menu groups are SPEC §8's names with the builder's screen mapping as shipped (Cost
= `money-matters` until the money screens arrive), a deliberate difference from the design HTML's own menu drawing;
(b) `addable: false` is the sanctioned way for a one-row generated screen to have no Add; (c) the analytics **profile**
page stays head/admin (Settings' own rule), while the Analytics face itself also opens for plant_head — deliberate.
