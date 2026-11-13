# 05 — Actions and words from the domain

Issue: [#83](https://github.com/nimishshah1989/argus/issues/83) · Milestone M0 · Blocked by: 03 · Branch
`claude/t05-actions-words-domain`. One PR, labels `size:large` (the catalogue move and its frozen copy fixture
must land together) and `no-parity`. The PR body contains `Closes #83`.

**Status: BLOCKED on the product answers in §10.** The rules in §4 are the draft "the server as it is today"
(the ticket's own wording: "exactly the server's `availableActions`"). Each row that Nimish answers differently
changes the named rule, test expectation and ported test, and nothing else. The coder starts after §10 is
answered and the answers are written into §10.

## 1. Goal

The buttons a person sees on a ticket are exactly the ones the server will accept, and every button and label
reads from one catalogue that works in English and Gujarati.

## 2. Decisions (technical; the orchestrator records them)

1. **One rule function, in the domain.** `availableActions(ticket, actor)` is a new pure file
   `packages/domain/src/actions.ts`. It is built from the same predicates the command handlers use (`canWork`,
   `canCancel`, `canClose` in `permissions/ticket.ts`) plus the status checks each handler makes, plus the route
   gate in `apps/server/src/modules/tickets/mapper.ts` (`WORK_GATED` needs `canWork`). The server is not
   changed in this slice (parallel ticket 06 owns server code); a later ticket makes the server call
   `availableActions`. Until then the domain test proves parity against `transition()` (T1).
   - Rejected: a dry-run `transition()` from the web (needs events and segments the web does not have);
     keeping a web copy (the drift this ticket removes).
2. **Scope of "the card": the 11 live-work actions** — `start`, `resume`, `update`, `pause`, `transfer`,
   `machine-running`, `machine-stopped`, `join`, `leave`, `close`, `cancel`. These are every action the action
   bar, the desk card quick button and the floor cancel button offer today. `restore`, `correct`, `report` (late)
   and `upgrade-kind` are not on the card today; whether they join it is question Q17.
3. **One canonical order** gives today's button order for every status: `start, resume, update, pause,
transfer, machine-running, machine-stopped, join, leave, close, cancel`. The first listed action is primary
   (open: start, working: update, waiting: resume), exactly as today.
4. **Web imports the packages as workspace dependencies.** `apps/web/package.json` gains
   `"@uptimo/domain": "workspace:*"` and `"@uptimo/shared": "workspace:*"`; `pnpm install --offline` updates
   only the `apps/web` importer in `pnpm-lock.yaml`. No external dependency; `tools/check-deps.ts` exempts
   `@uptimo/*`; `tools/check-boundaries.ts` covers only `apps/server/src`, so nothing to register. The existing
   relative import of `packages/shared/src/tags.js` in `api.ts` is left alone (ticket 04 replaces `api-types`).
5. **Catalogues move to `packages/shared/src/i18n/` (ARCHITECTURE D7)**, one `<namespace>.en.ts` per group,
   each under 250 lines, exported through a new subpath `"./i18n": "./src/i18n/index.ts"`. At runtime there is
   still one i18next namespace (`translation`) holding the merged catalogue, so every existing `t('…')` call is
   unchanged. `MessageKey = keyof typeof en`.
   - The Gujarati placeholder stays one derived file (`gu.ts`, every key, empty value) until real Gujarati
     arrives (ticket 24), then it splits per namespace. Rejected now: twelve three-line `.gu.ts` copies.
   - The gallery's own `gallery` namespace (`apps/web/src/gallery/strings.ts`) is untouched.
6. **Label fields in `.ts` are typed `MessageKey`.** `ActionSpec.label` and `StatusDef.label` are `MessageKey`;
   a type-level test with `@ts-expect-error` proves an English literal fails `pnpm typecheck`. The board's
   `'Other'` literal (the only other English label in a `.ts` file) becomes the key `board.other`.
7. **Gujarati journeys:** a third Playwright project `gujarati` (Pixel 5) seeds its worker tenant with
   `language = 'gu'`, so the app applies Gujarati from `/config` like a real tenant. No server change; the
   existing `tenant.language` column is used. The action-matrix spec runs only in `chromium`.

## 3. Files

**Domain**

| File                                   | Change                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/domain/src/actions.ts`       | New. `TicketAction`, `ACTION_ORDER`, `ActionCrewMember`, `ActionTicket`, `availableActions`; one small predicate per action (§4). About 90 lines. |
| `packages/domain/src/index.ts`         | Add `export * from './actions.js';`                                                                                                               |
| `packages/domain/test/actions.test.ts` | New. T1–T5.                                                                                                                                       |

**Catalogues (`packages/shared/src/i18n/`, all new; keys and values moved verbatim from `apps/web/src/i18n/en.ts` and `kit.en.ts`)**

| File                         | Keys (prefixes)                                                                                                                                     | About |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `common.en.ts`               | `nav`, `common`, `login`, `offline`, `drafts`, `account`, `notifications`, `share`, `role`, `close`, `kit`                                          | 50    |
| `desk.en.ts`                 | `desk`                                                                                                                                              | 30    |
| `floor.en.ts`                | `floor`                                                                                                                                             | 25    |
| `ticket.en.ts`               | `ticket`, `timeline`, `figures`                                                                                                                     | 58    |
| `sla.en.ts`                  | `sla`                                                                                                                                               | 18    |
| `actions.en.ts`              | `action` (28 existing + 11 new `action.label.*`, §5)                                                                                                | 42    |
| `report.en.ts`               | `report`                                                                                                                                            | 33    |
| `admin.en.ts`                | `admin`                                                                                                                                             | 21    |
| `board.en.ts`                | `board`, `tile`, new `board.other`                                                                                                                  | 21    |
| `settings.en.ts`             | `settings`                                                                                                                                          | 41    |
| `tags.en.ts`                 | `tags`                                                                                                                                              | 9     |
| `status.en.ts`               | the 31 kit `status.*` labels and the 5 `status.open…cancelled` keys, values unchanged                                                               | 38    |
| `index.ts`                   | `en` (spread of the twelve), `EN_NAMESPACES`, `MessageKey`, `gu`                                                                                    | 35    |
| `fixtures/en-before-05.json` | Frozen copy of today's merged `en` (generated once from `main` before the move: `tsx -e` printing `JSON.stringify(en, null, 2)`). Test data for I3. | ~370  |
| `catalogue.test.ts`          | I1–I4.                                                                                                                                              |       |

`packages/shared/package.json`: add `"./i18n": "./src/i18n/index.ts"` to `exports` (`"."` unchanged).

**Web**

| File                                              | Change                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/package.json`                           | Add the two workspace dependencies (decision 4). `pnpm-lock.yaml` follows.                                                                                                                                                                                                                           |
| `apps/web/src/components/actions.ts`              | **Deleted.**                                                                                                                                                                                                                                                                                         |
| `apps/web/src/components/actions.test.ts`         | **Deleted after porting**: every test moves to `actionSpecs.test.ts` or `correctChanges.test.ts` (§6 mapping).                                                                                                                                                                                       |
| `apps/web/src/components/actionSpecs.ts`          | New. `ActionSpec`, `actionSpecs`, `quickSpec`, `offers`, `actorFrom`, `crewFrom` (§4). Presentation only: label and primary.                                                                                                                                                                         |
| `apps/web/src/components/actionSpecs.test.ts`     | New. W1–W7 and the ports.                                                                                                                                                                                                                                                                            |
| `apps/web/src/components/correctChanges.ts`       | New. `CorrectChangeValues`, `buildCorrectChanges`, `hasCorrectChanges` moved verbatim.                                                                                                                                                                                                               |
| `apps/web/src/components/correctChanges.test.ts`  | New. The four `buildCorrectChanges` tests moved verbatim.                                                                                                                                                                                                                                            |
| `apps/web/src/components/useTicketCommand.ts`     | New. `useTicketCommand` moved verbatim.                                                                                                                                                                                                                                                              |
| `apps/web/src/components/ActionBar.tsx`           | Props `crew: string[]` → `crew: ActionCrewMember[]`, add `actor: ActorContext`; `legalActions(…)` → `actionSpecs(ticket, crew, actor)`; render `t(item.label)`. `FORM_ACTIONS` unchanged.                                                                                                            |
| `apps/web/src/components/TicketCard.tsx`          | Import `ActionSpec` from `./actionSpecs.js`; render `t(quick.label)`.                                                                                                                                                                                                                                |
| `apps/web/src/components/ReportForm.tsx`          | `PanelProps`: `crew: ActionCrewMember[]`, add `actor: ActorContext`; pass both to `ActionBar`. Whether `ActionBar` stays inside `canEdit &&` follows Q18.                                                                                                                                            |
| `apps/web/src/components/AdminPanel.tsx`          | Imports only: `buildCorrectChanges`, `hasCorrectChanges` from `./correctChanges.js`, `useTicketCommand` from `./useTicketCommand.js`.                                                                                                                                                                |
| `apps/web/src/screens/TicketDetail.tsx`           | `actor = me ? actorFrom(me) : null`; `crew = crewFrom(people)` (all people, left ones included); `canEdit = actor !== null && canWork(actor)` (domain `canWork`) for `ReportPanel` and `TagsPanel` (the `TagsPanel` file is not touched); pass `actor` to `ReportPanel`; imports from the new files. |
| `apps/web/src/screens/Desk.tsx`                   | Drop `canWork`/`canQuick`; `actor = me.data ? actorFrom(me.data.user) : null`; pass `actor` to `Board`; import `useTicketCommand` from the new file.                                                                                                                                                 |
| `apps/web/src/screens/desk/Board.tsx`             | Prop `canQuick: boolean` → `actor: ActorContext \| null` (both prop types); `quick={actor ? quickSpec(ticket, actor) : null}`.                                                                                                                                                                       |
| `apps/web/src/screens/floor/MyComplaints.tsx`     | `canCancelOwn(ticket, personId)` → `actor !== null && offers(ticket, actor, 'cancel')`; quick spec `{ action: 'cancel', label: 'action.cancel', primary: false }`; import `useTicketCommand` from the new file.                                                                                      |
| `apps/web/src/screens/floor/SentConfirmation.tsx` | Same `offers(…, 'cancel')` swap; the `ticket` prop type becomes `Ticket`.                                                                                                                                                                                                                            |
| `apps/web/src/api-types.ts`                       | `Ticket` gains `raisedLoginId: string` (the server already sends it: `ticketProjection` spreads the domain ticket).                                                                                                                                                                                  |
| `apps/web/src/screens/desk/views.test.ts`         | Ticket fixture gains `raisedLoginId` (type follows; no assertion changes).                                                                                                                                                                                                                           |
| `apps/web/src/screens/board/data.ts`              | `SegmentSection` and `GroupSection` gain `other: boolean`; the catch-all section and group get `label: null, other: true` instead of `'Other'`; `SegmentSection.label` becomes `string \| null`.                                                                                                     |
| `apps/web/src/screens/board/BoardSections.tsx`    | Render and `aria-label` use `x.other ? t('board.other') : x.label`.                                                                                                                                                                                                                                  |
| `apps/web/src/ui/status/index.ts`                 | `label: keyof typeof kitEn` → `label: MessageKey`; import from `@uptimo/shared/i18n`.                                                                                                                                                                                                                |
| `apps/web/src/i18n/index.ts`                      | Import `en`, `gu` from `@uptimo/shared/i18n`; nothing else changes.                                                                                                                                                                                                                                  |
| `apps/web/src/i18n/en.ts`, `gu.ts`, `kit.en.ts`   | **Deleted** (moved, decision 5).                                                                                                                                                                                                                                                                     |
| `apps/web/src/i18n/i18n.test.ts`                  | Keeps the fallback test (import paths only); the key-identity test moves to I4.                                                                                                                                                                                                                      |
| `apps/web/src/i18n/message-key.test.ts`           | New. I5.                                                                                                                                                                                                                                                                                             |

**E2E and config**

| File                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/e2e/fixtures.ts`         | `seedStatements(passwordHash, language: 'en' \| 'gu' = 'en')`; the tenant insert writes `language`.                                                                                                                                                                                                                                                                                                                                                                  |
| `apps/web/e2e/fixtures-actions.ts` | New (keeps `fixtures.ts` under 400 lines). Four fake people and logins: `sup` supervisor, `head` head, `ph` plant_head, `brd` board (fake names Sara, Hari, Pia, Bo; ids `scopedId('10000000-0000-0000-0000-00000000001c'…'1f')` people, `…20'…'23'` logins); four machines VC-11…VC-14 (`…18'…'1b'`); `actionMachines(projectName)`; `actionSeedStatements(passwordHash)`; `commandViaApi(token, ticketId, action, body)`. Imports from `fixtures.ts` one way only. |
| `apps/web/e2e/test.ts`             | Worker option `uiLanguage: ['en', { scope: 'worker', option: true }]`; seeds `[...seedStatements(hash, uiLanguage), ...actionSeedStatements(hash)]`.                                                                                                                                                                                                                                                                                                                 |
| `apps/web/e2e/actions.spec.ts`     | New. E1–E3.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/web/e2e/i18n.spec.ts`        | New. E4.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `playwright.config.ts`             | `defineConfig<object, { uiLanguage: 'en' \| 'gu' }>`; project `gujarati` (`devices['Pixel 5']`, `uiLanguage: 'gu'`); `phone` and `gujarati` add `**/actions.spec.ts` to `testIgnore`.                                                                                                                                                                                                                                                                                |
| `tools/workspace.test.ts`          | New case X1 (web declares its `@uptimo` imports).                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Records:** `changes/83-actions-words-domain.md` (§7), MILESTONES row 05, one line in `wiki/log.md`, top of
`docs/HANDOFF.md`.

## 4. Interfaces

`packages/domain/src/actions.ts` (load-bearing):

```ts
export type TicketAction =
  | 'start'
  | 'resume'
  | 'update'
  | 'pause'
  | 'transfer'
  | 'machine-running'
  | 'machine-stopped'
  | 'join'
  | 'leave'
  | 'close'
  | 'cancel';

export const ACTION_ORDER: readonly TicketAction[]; // the order in decision 3

export interface ActionCrewMember {
  personId: string;
  role: 'primary' | 'support';
  leftAt: Date | string | null;
}

export interface ActionTicket {
  status: Status;
  kind: Kind;
  handedOver: boolean;
  machineRunningAt: Date | string | null;
  startedAt: Date | string | null;
  raisedLoginId: string;
  leadPersonId: string | null;
  crew: ActionCrewMember[]; // every crew row, left ones included (canClose reads them)
}

/** The actions this actor may take now, in ACTION_ORDER. Pure; same rules as the handlers and route gate. */
export function availableActions(ticket: ActionTicket, actor: ActorContext): TicketAction[];
```

Draft rules ("server today"; `W` = `canWork(actor)`; `onCrew` = an active crew row for `actor.personId`;
`live` = open, working or waiting). `canCancel` and `canClose` get a `TicketContext` built inside the file
(`startedAt` → `Date | null`, `leftAt` → `Date | undefined`):

| Action          | Rule                                                                                             | Rows in §10 that can change it |
| --------------- | ------------------------------------------------------------------------------------------------ | ------------------------------ |
| start           | open and W                                                                                       | —                              |
| resume          | waiting and W                                                                                    | —                              |
| update          | live and W                                                                                       | Q7                             |
| pause           | working and W                                                                                    | —                              |
| transfer        | working and W                                                                                    | —                              |
| machine-running | `kind === 'stopped'` and W (any status)                                                          | Q8, Q9                         |
| machine-stopped | `machineRunningAt` set and W (any status)                                                        | Q10                            |
| join            | working or waiting, W, `actor.personId` set, not `onCrew` (the lead without a crew row may join) | Q1, Q3                         |
| leave           | W, `actor.personId` set, `onCrew` (any status)                                                   | Q2, Q4, Q5                     |
| close           | working and `canClose(actor, ticket)`                                                            | Q6                             |
| cancel          | `canCancel(actor, ticket)` (operator: same login and not started, any status)                    | Q12–Q16                        |

`apps/web/src/components/actionSpecs.ts`:

```ts
export interface ActionSpec {
  action: TicketAction;
  label: MessageKey;
  primary: boolean;
}
export function actionSpecs(
  ticket: Ticket,
  crew: ActionCrewMember[],
  actor: ActorContext,
): ActionSpec[];
export function quickSpec(ticket: Ticket, actor: ActorContext): ActionSpec | null; // crew []
export function offers(ticket: Ticket, actor: ActorContext, action: TicketAction): boolean; // crew []
export function actorFrom(me: Me): ActorContext | null; // {role, loginId: me.id, personId: me.actingPersonId, shared}; unknown role → null
export function crewFrom(people: TicketPerson[]): ActionCrewMember[]; // rows with role primary/support
```

- Labels: `start` → `action.label.pickUp` when `handedOver`, else `action.label.start`; `cancel` →
  `action.cancel` (existing); every other action → `action.label.<camelCase>` (§5). `primary` is true only for
  the first spec.
- `quickSpec`: the first of `start`, `resume`, `machine-running` present in `availableActions`, where
  `machine-running` counts only when `machineRunningAt` is null (today's rule); `primary: false`.

`packages/shared/src/i18n/index.ts`:

```ts
export const EN_NAMESPACES: Record<string, Record<string, string>>; // the twelve, by file name
export const en: {/* spread of the twelve */};
export type MessageKey = keyof typeof en;
export const gu: Record<MessageKey, string>; // every key, ''
```

`apps/web/src/ui/status/index.ts`: `StatusDef.label: MessageKey`. E2E: `uiLanguage` worker option; helpers in
`fixtures-actions.ts` as listed in §3.

## 5. Data and exact strings

No schema change. Fields read, none written by product code:

| Field                                                                                            | Type                                                 | Where it lives                                                      |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `status`, `kind`, `handedOver`, `machineRunningAt`, `startedAt`, `raisedLoginId`, `leadPersonId` | as in `ActionTicket`                                 | ticket reply (`/state`, `/tickets`, `/tickets/:id`); `ticket` table |
| `personId`, `role`, `leftAt`                                                                     | string, `'primary' \| 'support'`, ISO string or null | `/tickets/:id` `people`; `crew_member`                              |
| `id` (login), `role`, `shared`, `actingPersonId`                                                 | string, role string, boolean, string                 | `/auth/me`                                                          |
| `tenant.language`                                                                                | `'en' \| 'gu' \| 'hi'`                               | written only by the e2e seed (fake tenant)                          |

New English keys (copy identical to today's literals): `action.label.start` Start · `action.label.pickUp`
Pick up · `action.label.resume` Resume · `action.label.update` Update · `action.label.pause` Pause ·
`action.label.transfer` Transfer · `action.label.machineRunning` Machine running ·
`action.label.machineStopped` Machine stopped · `action.label.join` Add me as support · `action.label.leave`
Leave · `action.label.close` Close · `board.other` Other. Every existing key and value is unchanged (I3),
including the 31 status labels.

## 6. Test cases (all fail first)

**Domain — `packages/domain/test/actions.test.ts`**

- **T1** `matches what the server accepts for every role, state and relation`. Given each of the 7 roles × ticket
  variants built with `raiseTicket` + `transition` (open fresh; open handed over; working; waiting; closed
  report/no_report/done; cancelled from open unstarted; cancelled from working) × kinds stopped/support/general ×
  machine running or not × actor relation (lead; primary crew; support crew; left crew; not on ticket; same login
  or other; shared or personal; `personId` null), when `availableActions` is compared with "the route gate
  (`canWork` for leave, pause, resume, transfer, update, machine-running, machine-stopped) passes and
  `transition()` does not throw" for each of the 11 actions, then they agree — except the rows §10 answers
  "hide", which are listed in the test as `HIDDEN` and must be absent while the server still accepts them.
- **T2** `lists actions in the canonical order`. Given a working stopped ticket with the machine running and a
  supervisor on support crew, then the list is `update, pause, transfer, machine-running, machine-stopped,
leave, close, cancel`.
- **T3** `offers nothing to operator, plant head and board on a started ticket`. Given a working ticket, then
  each gets `[]`.
- **T4** `reads ISO strings like dates`. Given the T2 ticket with `startedAt`, `machineRunningAt` and `leftAt`
  as ISO strings, then the result equals the Date version.
- **T5** `refuses close to a technician who is not lead or primary on a personal login` and allows it on a
  shared login (Q6 sets the expected value).

**Web — `apps/web/src/components/actionSpecs.test.ts`** (fixture: today's `ticket()` plus `raisedLoginId`)

- **W1** `labels and orders the working bar`: Given T2's case, then labels are `action.label.update`, `…pause`,
  `…transfer`, `…machineRunning`, `…machineStopped`, `…leave`, `…close`, `action.cancel`; only the first is
  primary.
- **W2** `says Pick up on a handed-over open ticket`: label `action.label.pickUp`, primary.
- **W3** `picks the quick action`: open → start; open handed over → pickUp; waiting → resume; working stopped
  not running → machineRunning; working running → null; operator → null.
- **W4** `rejects an English literal as a label`: `// @ts-expect-error` on
  `const s: ActionSpec = { action: 'start', label: 'Start', primary: true }` (fails `pnpm typecheck` if the
  literal were accepted).
- **W5** `maps me to an actor`: `actorFrom` copies login id, role, shared, acting person; unknown role → null.
- **W6** `keeps left crew rows for close`: `crewFrom` keeps `leftAt`.
- **W7** `offers the reporter's own cancel only while unstarted on the same login`: operator, `raisedLoginId`
  equal, open, `startedAt` null → true; started → false; other login → false.

Ports of `actions.test.ts` (none dropped; the expected value of a port marked Q follows that answer):

| Old test                                                                                                       | New test (same file)                                                             |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| offers join to a technician who is not on the crew (open)                                                      | `join on open` — Q1                                                              |
| offers leave to an active crew member instead of join                                                          | same name, working ticket                                                        |
| treats the lead as being on the crew                                                                           | `the lead and join/leave` — Q2, Q3                                               |
| offers join/leave on working and waiting tickets too                                                           | same name                                                                        |
| omits join/leave without an acting person or outside the live statuses                                         | same name; closed/cancelled expectations follow Q5, Q9                           |
| offers cancel from working (technician and above can cancel)                                                   | same name                                                                        |
| keeps cancel on open and waiting                                                                               | same name, technician actor                                                      |
| canCancelOwn: allows / refuses once started / refuses when not open / refuses someone else or no acting person | W7 plus `own cancel on a cancelled ticket` (Q14) and `shared login cancel` (Q12) |
| buildCorrectChanges × 4                                                                                        | `correctChanges.test.ts`, verbatim                                               |

**Catalogues — `packages/shared/src/i18n/catalogue.test.ts`**

- **I1** `keeps every namespace file under 250 lines`: Given every `*.en.ts` in the folder, then each has fewer
  than 250 lines.
- **I2** `has no key in two namespaces`: the sum of `EN_NAMESPACES` sizes equals `Object.keys(en).length`.
- **I3** `changes no existing copy`: every key in `fixtures/en-before-05.json` has the same value in `en`, and
  `en` has exactly those keys plus the 12 in §5.
- **I4** `keeps gu key-identical`: `gu` keys equal `en` keys; every value is `''`.
- **I5** (`apps/web/src/i18n/message-key.test.ts`) `rejects an English status label`: `// @ts-expect-error` on
  a `StatusDef` with `label: 'Stopped'`; `label: 'status.ticket.stopped'` compiles.
- `apps/web/src/i18n/i18n.test.ts` `falls back to English for an untranslated gu key` stays.

**Workspace — `tools/workspace.test.ts`**

- **X1** `declares every @uptimo import of the web`: every `@uptimo/<name>` imported in `apps/web/src` and
  `apps/web/e2e` (`.ts`, `.tsx`) is a `workspace:*` dependency of `apps/web/package.json`.

**Browser — `apps/web/e2e/actions.spec.ts`** (serial; `beforeAll` raises through the API: open stopped ticket
raised by `op` on machine A; working stopped ticket on machine B started by `asha` with `bina` joined as
support; general tickets: handed over (asha start, transfer), waiting (start, pause `spare`), closed (start,
close `done`), cancelled (cancel))

- **E1** `shows exactly availableActions on the ticket for every role and state`: Given each login (`asha`,
  `bina`, `op`, `sup`, `head`, `ph`, `brd`, `admin`) and each of the six tickets, when the login opens
  `/desk/<id>`, then the button names in the `Actions` region, in order, equal `actionSpecs(ticket,
crewFrom(people), actorFrom(me))` mapped through `en` (an empty list means no `Actions` region). Expected
  values for operator rows follow Q18.
- **E2** `shows the quick action on the desk card`: Given `asha` on `/desk`, then each open-board card's button
  equals `quickSpec` (Start on the open ticket, Resume on the waiting one, Machine running on the working one).
- **E3** `offers Cancel on My complaints exactly when the server would`: Given `op` on `/floor`, then the open
  unstarted ticket's card has Cancel and no other card does (Q13–Q15 may add rows).

**Browser — `apps/web/e2e/i18n.spec.ts`**

- **E4** `serves the project language`: Given the worker tenant, when `GET /api/v1/config` is called as
  `asha`, then `language` equals the project's `uiLanguage` (`gu` in `gujarati`).
- **E5** every existing spec passes in `chromium`, `phone` and `gujarati` (no spec edited except imports).

Commands: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm audit:lean && pnpm build`.

## 7. Changelog

`changes/83-actions-words-domain.md`:

```
- The ticket buttons come from one domain rule, `availableActions`, so a button is shown only when the server accepts it.
- Every label now comes from per-namespace catalogues with a typed `MessageKey`; journeys also run in Gujarati.
```

## 8. Regression risk

- **Behaviour change on the card** exactly where §10 rows differ; each is a named test.
- **Parity drift:** T1 restates the route gate list from `tickets/mapper.ts`; until the server calls
  `availableActions`, a server-side rule change must update T1. Named in HANDOFF.
- **Ticket 06 runs in parallel** and may edit `apps/web/src/i18n/en.ts` (tags keys). Whoever merges second
  moves those keys into `tags.en.ts` and regenerates nothing else; I3's fixture is taken from `main` at branch
  time.
- **CI time:** a third project adds about half the browser time; `globalTimeout` is 300 s across 2 shards. If
  the run exceeds it, the coder stops and returns to the planner (do not raise the timeout silently).
- **Stale cached tickets** without `raisedLoginId` hide the floor Cancel until refetch (`staleTime: 0` there).
- **i18n runtime:** still one `translation` namespace with the same flat keys; only import paths change.

## 9. Out of scope

- Any server change, including making the server call `availableActions` (later ticket); tag screens (06).
- `restore`, `correct`, late `report`, `upgrade-kind` on the card unless Q17 says otherwise.
- Shared Zod reply contracts and deleting `api-types.ts` (04).
- Real Gujarati and per-namespace `.gu.ts` files (24); the gallery namespace.
- English error strings in `.ts` that are not label fields (for example the `useTicketCommand` fallback).
- The machine-stopped follow-up (the handler keeps `machineRunningAt`, so "Machine stopped" stays offered after
  use; same today).

## 10. Product questions for the orchestrator (for Nimish; no answer is picked here)

Legend. **Today** = what the screen shows now. **Server** = what the server accepts now. **Spec** =
`docs/spec/DOMAIN.md` §2–§3. Work roles = technician, supervisor, head, admin. Where Server refuses, "show"
needs a server rule change in a later ticket; where Server accepts, "hide" makes the card narrower than the
server until a later ticket changes the server. Operator, plant head and board see nothing on the ticket page
today and the server accepts nothing for them there, except as listed.

| #   | Situation                                                                                                                                                                                                                 | Role              | Action                        | Today                                               | Server                                  | Spec                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------------- | --------------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Q1  | Open ticket (fresh or handed over), person not on crew                                                                                                                                                                    | work roles        | Add me as support (join)      | shown                                               | refused ("Can only join a live ticket") | join only from working or waiting                       |
| Q2  | Working or waiting, the lead (has no crew row)                                                                                                                                                                            | work roles        | Leave                         | shown                                               | refused ("Not on this ticket")          | lead may leave when a primary can take over             |
| Q3  | Working or waiting, the lead (has no crew row)                                                                                                                                                                            | work roles        | Add me as support             | hidden (Leave shown instead)                        | accepted (adds the lead as crew)        | "not already on the ticket"                             |
| Q4  | Open handed-over ticket, person still on crew (handover does not remove crew)                                                                                                                                             | work roles        | Leave                         | shown                                               | accepted                                | leave only from working or waiting                      |
| Q5  | Closed or cancelled ticket, person still on crew                                                                                                                                                                          | work roles        | Leave                         | hidden                                              | accepted                                | not allowed                                             |
| Q6  | Working ticket, technician on a personal login who is not lead or primary crew (support crew or not on it)                                                                                                                | technician        | Close                         | shown                                               | refused (403)                           | lead or primary only; anyone on a shared login          |
| Q7  | Open ticket not handed over                                                                                                                                                                                               | work roles        | Update                        | hidden                                              | accepted                                | update on open only when handed over                    |
| Q8  | Open stopped ticket                                                                                                                                                                                                       | work roles        | Machine running               | hidden                                              | accepted                                | working or waiting only                                 |
| Q9  | Closed or cancelled stopped ticket                                                                                                                                                                                        | work roles        | Machine running               | hidden                                              | accepted                                | not allowed                                             |
| Q10 | Open, closed or cancelled ticket whose machine was marked running                                                                                                                                                         | work roles        | Machine stopped               | hidden                                              | accepted                                | working or waiting only                                 |
| Q11 | Support ticket, any status (incl. closed, cancelled)                                                                                                                                                                      | work roles        | Upgrade to stopped            | never on the card (offered in the raise flow)       | accepted                                | open, working, waiting; offered when raising            |
| Q12 | Shared floor login; ticket raised on that login by another person; not started                                                                                                                                            | operator          | Cancel (My complaints, Sent)  | hidden                                              | accepted ("own" = same login)           | "raised from the same login"                            |
| Q13 | Personal login named as reporter on a ticket raised from another login                                                                                                                                                    | operator          | Cancel                        | shown                                               | refused (403)                           | own = raised from this login                            |
| Q14 | Own unstarted ticket that is already cancelled                                                                                                                                                                            | operator          | Cancel                        | hidden                                              | accepted (cancels again)                | cancel from open, working, waiting                      |
| Q15 | Own open unstarted ticket                                                                                                                                                                                                 | plant head        | Cancel (My complaints, Sent)  | shown                                               | refused (403)                           | plant head: no cancel                                   |
| Q16 | Own ticket already started (working, waiting, handed over) on My complaints / Sent                                                                                                                                        | work roles        | Cancel                        | hidden                                              | accepted                                | any active ticket                                       |
| Q17 | Does "the card" include admin Restore and Correct and the Fill report button? (Restore shows on any cancelled ticket; the server refuses after 7 days. Fill report is hidden for work requests; the server accepts them.) | admin; work roles | Restore, Correct, Fill report | as described                                        | as described                            | restore within 7 days; late report technician and above |
| Q18 | Operator opens the page of their own unstarted ticket                                                                                                                                                                     | operator          | Cancel on the ticket page     | hidden (whole action bar hidden for non-work roles) | accepted                                | own, not yet started                                    |

Rows that agree everywhere (no question): start, resume, pause, transfer for work roles; close for supervisor,
head, admin and for lead/primary or shared-login technicians; cancel by work roles on open, working, waiting;
nothing for plant head and board on the ticket page; nothing for operators on started tickets.
