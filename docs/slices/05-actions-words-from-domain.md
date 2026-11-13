# 05 — Actions and words from the domain

Issue: [#83](https://github.com/nimishshah1989/argus/issues/83) · Milestone M0 · Blocked by: 03 · Branch
`claude/t05-actions-words-domain`. One PR, labels `size:large` (the catalogue move and its frozen copy fixture
must land together) and `no-parity`. The PR body contains `Closes #83`.

**Status: READY.** The product questions are ruled (§10) and the plan-review findings are applied. The rules in
§4 are the rulings: a button is never added where it is hidden today unless the Spec and the server both allow
it, and never shown when the server refuses it.

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
5. **Catalogues move to `packages/shared/src/i18n/` (D7)**: per namespace one `<namespace>.en.ts` and one
   `<namespace>.gu.ts`, each under 250 lines, exported through a new subpath `"./i18n": "./src/i18n/index.ts"`.
   At runtime there is still one i18next namespace (`translation`) holding the merged catalogue, so every
   existing `t('…')` call is unchanged. Old `en.ts` and `kit.en.ts` text moves, never reworded.
   - Each catalogue is a named, un-annotated `export const` (for example `commonEn`), so its keys stay literal
     types. `index.ts` spreads them: `en = { ...commonEn, ...deskEn, … }`, `gu = { ...commonGu, … }`,
     `MessageKey = keyof typeof en`. An annotation such as `Record<string, string>` would widen `MessageKey` to
     `string`, so none is allowed.
   - Each `<namespace>.gu.ts` is `export const commonGu = blank(commonEn);` (`blank` is in `i18n/blank.ts`: same
     keys, every value `''`). Ticket 24 replaces the call with real strings, file by file.
   - Status is split finer: `status-ticket` (`status.open…cancelled`, `status.ticket.*`), `status-signal`
     (`status.severity.*`, `status.clock.*`, `status.forecast.*`), `status-flow` (`status.handback.*`,
     `status.pm.*`, `status.sync.*`). The 31 kit status labels keep their values.
   - **Gujarati proof limit:** until ticket 24 every `gu` value is empty and falls back to English. The `gujarati`
     e2e project therefore proves only that the tenant language is read from the seed and `/config` and that
     nothing regresses with `gu` active. It does not prove a Gujarati string renders.
   - The gallery's own `gallery` namespace (`apps/web/src/gallery/strings.ts`) is untouched.
6. **Label fields in `.ts` are typed `MessageKey`.** `ActionSpec.label` is `MessageKey` (new) and
   `StatusDef.label` becomes `MessageKey` (today `keyof typeof kitEn`, so its guard already holds). A type-level
   test with `@ts-expect-error` proves an English literal fails `pnpm typecheck` (W4). The board's `'Other'`
   literal (the only other English label in a `.ts` file) becomes the key `board.other`.
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

Each namespace has `<ns>.en.ts` (export `<ns>En`) and `<ns>.gu.ts` (export `<ns>Gu = blank(<ns>En)`, two lines).

| Namespace (export prefix)        | Keys (prefixes)                                                                                            | About |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----- |
| `common` (`common`)              | `nav`, `common`, `login`, `offline`, `drafts`, `account`, `notifications`, `share`, `role`, `close`, `kit` | 55    |
| `desk` (`desk`)                  | `desk`                                                                                                     | 30    |
| `floor` (`floor`)                | `floor`                                                                                                    | 25    |
| `ticket` (`ticket`)              | `ticket`, `timeline`, `figures`                                                                            | 58    |
| `sla` (`sla`)                    | `sla`                                                                                                      | 18    |
| `actions` (`actions`)            | `action` (28 existing + 11 new `action.label.*`, §5)                                                       | 42    |
| `report` (`report`)              | `report`                                                                                                   | 33    |
| `admin` (`admin`)                | `admin`                                                                                                    | 21    |
| `board` (`board`)                | `board`, `tile`, new `board.other`                                                                         | 21    |
| `settings` (`settings`)          | `settings`                                                                                                 | 41    |
| `tags` (`tags`)                  | `tags`                                                                                                     | 9     |
| `status-ticket` (`statusTicket`) | `status.open…cancelled`, `status.ticket.*`                                                                 | 16    |
| `status-signal` (`statusSignal`) | `status.severity.*`, `status.clock.*`, `status.forecast.*`                                                 | 14    |
| `status-flow` (`statusFlow`)     | `status.handback.*`, `status.pm.*`, `status.sync.*`                                                        | 14    |

| File                                              | Change                                                                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `i18n/blank.ts`                                   | New. `blank<T extends object>(source: T): { [K in keyof T]: string }`; every value `''`.                                                                              |
| `i18n/index.ts`                                   | New. `NAMESPACES` (`Record<string, Record<string, string>>`, name to catalogue, English), `en` (spread of the fourteen), `gu` (spread of the fourteen), `MessageKey`. |
| `packages/shared/test/fixtures/en-before-05.json` | Frozen copy of today's merged `en`, generated once from the unmoved `en.ts` before the move (`tsx -e` printing `JSON.stringify(en, null, 2)`). Test data for I3.      |
| `packages/shared/test/catalogue.test.ts`          | New. I1–I4. The shared tests live in `packages/shared/test/` like the existing ones.                                                                                  |

`packages/shared/package.json`: add `"./i18n": "./src/i18n/index.ts"` to `exports` (`"."` unchanged).

**Web**

| File                                              | Change                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/package.json`                           | Add the two workspace dependencies (decision 4). `pnpm-lock.yaml` follows.                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/web/src/components/actions.ts`              | **Deleted.**                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `apps/web/src/components/actions.test.ts`         | **Deleted after porting**: every test moves to `actionSpecs.test.ts` or `correctChanges.test.ts` (§6 mapping).                                                                                                                                                                                                                                                                                                                                    |
| `apps/web/src/components/actionSpecs.ts`          | New. `ActionSpec`, `actionSpecs`, `quickSpec`, `offers`, `actorFrom`, `crewFrom` (§4). Presentation only: label and primary.                                                                                                                                                                                                                                                                                                                      |
| `apps/web/src/components/actionSpecs.test.ts`     | New. W1–W7 and the ports.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web/src/components/correctChanges.ts`       | New. `CorrectChangeValues`, `buildCorrectChanges`, `hasCorrectChanges` moved verbatim.                                                                                                                                                                                                                                                                                                                                                            |
| `apps/web/src/components/correctChanges.test.ts`  | New. The four `buildCorrectChanges` tests moved verbatim.                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web/src/components/useTicketCommand.ts`     | New. `useTicketCommand` moved verbatim.                                                                                                                                                                                                                                                                                                                                                                                                           |
| `apps/web/src/components/ActionBar.tsx`           | Props `crew: string[]` → `crew: ActionCrewMember[]`, add `actor: ActorContext`; `legalActions(…)` → `actionSpecs(ticket, crew, actor)`; render `t(item.label)`. `FORM_ACTIONS` unchanged.                                                                                                                                                                                                                                                         |
| `apps/web/src/components/TicketCard.tsx`          | Import `ActionSpec` from `./actionSpecs.js`; render `t(quick.label)`.                                                                                                                                                                                                                                                                                                                                                                             |
| `apps/web/src/components/ReportForm.tsx`          | `PanelProps`: `crew: ActionCrewMember[]`, add `actor: ActorContext`; pass both to `ActionBar`. `ActionBar` stays inside `canEdit &&` (Q18: operator, plant head and board see no action bar).                                                                                                                                                                                                                                                     |
| `apps/web/src/components/AdminPanel.tsx`          | Imports only: `buildCorrectChanges`, `hasCorrectChanges` from `./correctChanges.js`, `useTicketCommand` from `./useTicketCommand.js`.                                                                                                                                                                                                                                                                                                             |
| `apps/web/src/screens/TicketDetail.tsx`           | `actor = me ? actorFrom(me) : null`; `crew = crewFrom(people)` (all people, left ones included); `canEdit = actor !== null && canWork(actor)` (domain `canWork`), used by `ReportPanel` and the one `TagsPanel` line (the `TagsPanel` file is not touched; that line is the only tags edit); the `ReportPanel` condition becomes `hasReportContext(config, personId) && actor !== null`, and `actor` is passed to it; imports from the new files. |
| `apps/web/src/screens/Desk.tsx`                   | Drop `canWork`/`canQuick`; `actor = me.data ? actorFrom(me.data.user) : null`; pass `actor` to `Board`; import `useTicketCommand` from the new file.                                                                                                                                                                                                                                                                                              |
| `apps/web/src/screens/desk/Board.tsx`             | Prop `canQuick: boolean` → `actor: ActorContext \| null` (both prop types); `quick={actor ? quickSpec(ticket, actor) : null}`.                                                                                                                                                                                                                                                                                                                    |
| `apps/web/src/screens/floor/MyComplaints.tsx`     | `const actor = me.data ? actorFrom(me.data.user) : null;` then `canCancelOwn(ticket, personId)` → `actor !== null && offers(ticket, actor, 'cancel')`; quick spec `{ action: 'cancel', label: 'action.cancel', primary: false }` (the label is rendered with `t(quick.label)` in `TicketCard`); import `useTicketCommand` from the new file.                                                                                                      |
| `apps/web/src/screens/floor/SentConfirmation.tsx` | Same `const actor = me.data ? actorFrom(me.data.user) : null;` and `offers(…, 'cancel')` swap; the `ticket` prop type becomes `Ticket`.                                                                                                                                                                                                                                                                                                           |
| `apps/web/src/api-types.ts`                       | `Ticket` gains `raisedLoginId: string` (the server already sends it: `ticketProjection` spreads the domain ticket).                                                                                                                                                                                                                                                                                                                               |
| `apps/web/src/screens/desk/views.test.ts`         | Ticket fixture gains `raisedLoginId` (type follows; no assertion changes).                                                                                                                                                                                                                                                                                                                                                                        |
| `apps/web/src/screens/board/data.ts`              | `SegmentSection` and `GroupSection` gain `other: boolean`; `SegmentSection.label` becomes `string \| null`. The catch-all segment section is `label: null, other: true`. In `toSection`, `key === '' ? null : key === 'other' ? 'Other' : (labels.get(key) ?? 'Other')` is replaced by `label: key === '' \|\| key === 'other' ? null : (labels.get(key) ?? null)` and `other: key === 'other'`.                                                  |
| `apps/web/src/screens/board/data.test.ts`         | New (none exists). Cases in §6 (B1, B2).                                                                                                                                                                                                                                                                                                                                                                                                          |
| `apps/web/src/screens/board/BoardSections.tsx`    | Render and `aria-label` use `x.other ? t('board.other') : x.label`.                                                                                                                                                                                                                                                                                                                                                                               |
| `apps/web/src/ui/status/index.ts`                 | `label: keyof typeof kitEn` → `label: MessageKey`; import from `@uptimo/shared/i18n`.                                                                                                                                                                                                                                                                                                                                                             |
| `apps/web/src/i18n/index.ts`                      | Import `en`, `gu` from `@uptimo/shared/i18n`; nothing else changes.                                                                                                                                                                                                                                                                                                                                                                               |
| `apps/web/src/i18n/en.ts`, `gu.ts`, `kit.en.ts`   | **Deleted** (moved, decision 5). The deletions are moves; no key or value is dropped (I3).                                                                                                                                                                                                                                                                                                                                                        |
| `apps/web/src/i18n/i18n.test.ts`                  | Keeps the fallback test (import paths only); the key-identity test moves to I4.                                                                                                                                                                                                                                                                                                                                                                   |
| `apps/web/src/i18n/message-key.test.ts`           | New. I5 (a regression guard: it passes before the change).                                                                                                                                                                                                                                                                                                                                                                                        |

**E2E and config**

| File                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/e2e/fixtures.ts`         | `seedStatements(passwordHash, language: 'en' \| 'gu' = 'en')`; the tenant insert writes `language`.                                                                                                                                                                                                                                                                                                                                                                                         |
| `apps/web/e2e/fixtures-actions.ts` | New (keeps `fixtures.ts` under 400 lines). Four fake people and personal logins: `sup` supervisor, `head` head, `ph` plant_head, `brd` board (fake names Sara, Hari, Pia, Bo; ids `scopedId('10000000-0000-0000-0000-00000000001c'…'1f')` people, `…20'…'23'` logins); two machines, A = VC-11 (`…18`) and B = VC-12 (`…19`); `actionMachines(projectName)`; `actionSeedStatements(passwordHash)`; `commandViaApi(token, ticketId, action, body)`. Imports from `fixtures.ts` one way only. |
| `apps/web/e2e/test.ts`             | Worker option `uiLanguage: ['en', { scope: 'worker', option: true }]`; seeds `[...seedStatements(hash, uiLanguage), ...actionSeedStatements(hash)]`.                                                                                                                                                                                                                                                                                                                                        |
| `apps/web/e2e/actions.spec.ts`     | New. E1–E3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `apps/web/e2e/i18n.spec.ts`        | New. E4.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `playwright.config.ts`             | `defineConfig<object, { uiLanguage: 'en' \| 'gu' }>`; project `gujarati` (`devices['Pixel 5']`, `uiLanguage: 'gu'`); `phone` and `gujarati` add `**/actions.spec.ts` to `testIgnore`.                                                                                                                                                                                                                                                                                                       |
| `tools/workspace.test.ts`          | New case X1 (web declares its `@uptimo` imports).                                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Records:** `changes/83-actions-words-domain.md` (§7, short, same format as the other fragments),
`docs/slices/05-pr-body.md` (the PR body draft: what changed for a user, tests, how to try, the ported-test list,
the follow-ups of §10), MILESTONES row 05, one line in `wiki/log.md`, top of `docs/HANDOFF.md`.

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

Rules (the rulings of §10). `W` = `canWork(actor)`; `live` = open, working or waiting; `onCrew` = an active crew
row (`leftAt` null) for `actor.personId`; `onTicket` = `onCrew` or `actor.personId === leadPersonId`.
**First rule: `actor.personId === null` returns `[]`** (the server refuses every action for a person-less
session: a personal login needs the body person to equal its own, a shared login needs a known person).
`canCancel` and `canClose` get a `TicketContext` built inside the file (`startedAt` → `Date | null`, `leftAt` →
`Date | undefined`).

| Action          | Rule                                                                                                               | Ruling                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| start           | open and W                                                                                                         | as today                                                    |
| resume          | waiting and W                                                                                                      | as today                                                    |
| update          | W and (working or waiting, or open and `handedOver`)                                                               | Q7 stays hidden                                             |
| pause           | working and W                                                                                                      | as today                                                    |
| transfer        | working and W                                                                                                      | as today                                                    |
| machine-running | W, `kind === 'stopped'`, working or waiting                                                                        | Q8, Q9 stay hidden                                          |
| machine-stopped | W, `machineRunningAt` set, working or waiting                                                                      | Q10 stays hidden                                            |
| join            | W, working or waiting, not `onTicket`                                                                              | Q1 hide on open; Q3 stays hidden for the lead               |
| leave           | W, live, `onCrew` (the lead without a crew row does not get Leave)                                                 | Q2 hide; Q4 stays shown; Q5 stays hidden                    |
| close           | working and `canClose(actor, ticket)`                                                                              | Q6 hide for a personal-login technician not lead or primary |
| cancel          | live and `canCancel(actor, ticket)` (operator: raised on the same login and not started; plant head, board: never) | Q12 show; Q13, Q15 hide; Q14 stays hidden; Q16 show         |

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
export const NAMESPACES: Record<string, Record<string, string>>; // the fourteen English catalogues, by file name
export const en = { ...commonEn /* … the fourteen, no type annotation */ };
export type MessageKey = keyof typeof en;
export const gu = { ...commonGu /* … the fourteen */ }; // every key, ''
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

## 6. Test cases (all fail first, except the marked regression guards)

**Domain — `packages/domain/test/actions.test.ts`**

- **T1** `never shows what the server refuses, and hides only the ruled rows`. Given each of the 7 roles × ticket
  variants built with `raiseTicket` + `transition` (open fresh; open handed over; working; waiting; closed
  report/no_report/done; cancelled from open unstarted; cancelled from working) × kinds stopped/support/general ×
  machine running or not × actor relation (lead; primary crew; support crew; left crew; not on ticket; same login
  or other; shared or personal; `personId` null), the oracle `serverAccepts(action, state, actor)` is:
  `actor.personId !== null` (models `resolveActingPerson`: a personal login without a matching person gets 403, a
  shared login with no known person gets 404, so neither can act) **and** (the action is in the route gate list
  `leave, pause, resume, transfer, update, machine-running, machine-stopped` ⇒ `canWork(actor)`) **and**
  `transition()` does not throw for the command built with `personId = actor.personId`: `start {pickup:
ticket.handedOver}`, `resume`, `update {text: 'x'}`, `pause {reason: 'spare'}`, `transfer {note: 'x'}`,
  `machineRunning`, `machineStopped`, `join {role: 'support'}`, `leave {reason: 'x'}`, `close {kind: 'done'}`,
  `cancel {reason: 'x'}`. Then (a) every action in `availableActions` is `serverAccepts` (never shown when
  refused), (b) every `serverAccepts` action that is absent matches a row of the test's `HIDDEN` table: Q3 (join
  by the lead), Q5 (leave on closed or cancelled), Q7 (update on open, not handed over), Q8, Q9 (machine-running
  on open, closed, cancelled), Q10 (machine-stopped on open, closed, cancelled), Q14 (operator cancel on an own
  cancelled ticket), and (c) `actor.personId === null` gives `[]`.
- **T2** `lists actions in the canonical order`. Given a working stopped ticket with the machine running and a
  supervisor on support crew, then the list is `update, pause, transfer, machine-running, machine-stopped,
leave, close, cancel`.
- **T3** `offers nothing to operator, plant head and board on a started ticket`. Given a working ticket, then
  each gets `[]`.
- **T4** `reads ISO strings like dates`. Given the T2 ticket with `startedAt`, `machineRunningAt` and `leftAt`
  as ISO strings, then the result equals the Date version.
- **T5** `refuses close to a technician who is not lead or primary on a personal login` (Q6): hidden; still
  shown on a shared login and to the lead and to primary crew.
- **T6** `follows the rulings Q1, Q2, Q12, Q13, Q15, Q16`: Q1 open ticket, technician not on crew: no `join`; Q2
  working, lead without crew row: no `leave`; Q12 shared-login operator, ticket raised on that login by another
  person, unstarted: `cancel`; Q13 personal-login operator, ticket raised from another login: none; Q15 plant head
  on an own unstarted open ticket: none; Q16 technician, own started working ticket: `cancel` present.

**Web — `apps/web/src/components/actionSpecs.test.ts`** (fixture: today's `ticket()` plus `raisedLoginId`)

- **W1** `labels and orders the working bar`: Given T2's case, then labels are `action.label.update`, `…pause`,
  `…transfer`, `…machineRunning`, `…machineStopped`, `…leave`, `…close`, `action.cancel`; only the first is
  primary.
- **W2** `says Pick up on a handed-over open ticket`: label `action.label.pickUp`, primary.
- **W3** `picks the quick action`: open → start; open handed over → pickUp; waiting → resume; working stopped
  not running → machineRunning; working running → null; operator → null.
- **W4** `rejects an English literal as a label`: `// @ts-expect-error` on
  `const s: ActionSpec = { action: 'start', label: 'Start', primary: true }` (fails `pnpm typecheck` if the
  literal were accepted). Carries the "English literal fails typecheck" goal for action labels.
- **W5** `maps me to an actor`: `actorFrom` copies login id, role, shared, acting person; unknown role → null.
- **W6** `keeps left crew rows for close`: `crewFrom` keeps `leftAt`.
- **W7** `offers the reporter's own cancel only while unstarted on the same login`: operator, `raisedLoginId`
  equal, open, `startedAt` null → true; started → false; other login → false.

Ports of `actions.test.ts` (none dropped; a port whose expectation changes by a ruling says which, and is listed
in the PR body draft):

| Old test                                                                                                       | New test (same file)                                                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| offers join to a technician who is not on the crew (open)                                                      | `offers join to a technician who is not on the crew` on a working ticket; the open half becomes `hides join on an open ticket` (Q1); `start` is still offered                                                                                                                       |
| offers leave to an active crew member instead of join                                                          | same name, open and working tickets (Q4 keeps Leave on open)                                                                                                                                                                                                                        |
| treats the lead as being on the crew                                                                           | `treats the lead as on the ticket`: no join (Q3) and no leave (Q2, was offered)                                                                                                                                                                                                     |
| offers join/leave on working and waiting tickets too                                                           | same name                                                                                                                                                                                                                                                                           |
| omits join/leave without an acting person or outside the live statuses                                         | same name; `personId` null gives `[]`; closed and cancelled give `[]` for a technician                                                                                                                                                                                              |
| offers cancel from working (technician and above can cancel)                                                   | same name                                                                                                                                                                                                                                                                           |
| keeps cancel on open and waiting                                                                               | same name, technician actor                                                                                                                                                                                                                                                         |
| canCancelOwn: allows / refuses once started / refuses when not open / refuses someone else or no acting person | W7, `refuses an operator on a started or closed ticket`, `refuses the operator named reporter on another login` (Q13), `offers a technician cancel on an own started ticket` (Q16), `offers a shared-login operator cancel` (Q12), `refuses own cancel on a cancelled ticket` (Q14) |
| buildCorrectChanges × 4                                                                                        | `correctChanges.test.ts`, verbatim                                                                                                                                                                                                                                                  |

**Board — `apps/web/src/screens/board/data.test.ts`**

- **B1** `labels a machine with no segment as other`: Given a machine with no segment, then the section is
  `other: true, label: null`.
- **B2** `labels a machine in an unknown group as other`: Given a segment with groups and a machine whose
  `group_id` is not one of them, then the group is `id: 'other'`, `other: true`, `label: null`; a configured
  group keeps its name and `other: false`.

**Catalogues — `packages/shared/test/catalogue.test.ts`**

- **I1** `keeps every catalogue file under 250 lines`: Given every `*.en.ts` and `*.gu.ts` in `src/i18n/`, then
  each has fewer than 250 lines.
- **I2** `has no key in two namespaces`: the sum of `NAMESPACES` sizes equals `Object.keys(en).length`.
- **I3** `changes no existing copy`: every key in `test/fixtures/en-before-05.json` has the same value in `en`, and
  `en` has exactly those keys plus the 12 in §5 (including all 31 `status.*` kit labels, unchanged).
- **I4** `keeps gu key-identical`: `gu` keys equal `en` keys; every value is `''`.
- **I5** (`apps/web/src/i18n/message-key.test.ts`, **regression guard: passes today**, `StatusDef.label` is already
  `keyof typeof kitEn`) `rejects an English status label`: `// @ts-expect-error` on a `StatusDef` with
  `label: 'Stopped'`; `label: 'status.ticket.stopped'` compiles.
- `apps/web/src/i18n/i18n.test.ts` `falls back to English for an untranslated gu key` stays.

**Workspace — `tools/workspace.test.ts`**

- **X1** `declares every @uptimo import of the web`: every `@uptimo/<name>` imported in `apps/web/src` and
  `apps/web/e2e` (`.ts`, `.tsx`) is a `workspace:*` dependency of `apps/web/package.json`; the set of imports
  found is not empty; and `apps/web/package.json` lists both `@uptimo/domain` and `@uptimo/shared` as
  `workspace:*`.

**Browser — `apps/web/e2e/actions.spec.ts`** (serial, `chromium` only; `beforeAll` raises through the API. Six
tickets: **open stopped**, machine A (VC-11), raised by `op`; **working stopped**, machine B (VC-12), raised
and started by `asha`, `bina` joined as support; four general tickets (no machine) raised by `asha`:
**handed over** (`asha` start, `asha` transfer), **waiting** (`asha` start, pause `spare`), **closed** (`asha`
start, close `done`); and **cancelled**, raised by `op`, cancelled by `op`. `afterAll` cancels the live ones as
`admin` so later specs on the worker see none)

- **E1** `shows exactly availableActions on the ticket for every role and state`: Given each login (`asha`,
  `bina`, `op`, `sup`, `head`, `ph`, `brd`, `admin`) and each of the six tickets, when the login opens
  `/desk/<id>`, then the button names in the `Actions` region, in order, equal the domain
  `availableActions(ticket, actor)` for that login (computed in the test from the API reply and `/auth/me`) mapped
  through a literal English label table (`start` Start, `start` on a handed-over ticket Pick up, `join` Add me as
  support, …), not through `actionSpecs`. Operator, plant head and board expect no `Actions` region (Q18). Three
  rows also assert a literal list: `asha` on the working ticket (Update, Pause, Transfer, Machine running, Close,
  Cancel: asha is lead without a crew row, so no Leave), `bina` on it (Update, Pause, Transfer, Machine running,
  Leave, Cancel; no Close, Q6), `asha` on the open ticket (Start, Cancel).
- **E2** `shows the quick action on the desk card` (**regression guard: passes today**): Given `asha` on
  `/desk`, then Start is on the open ticket's card, Resume on the waiting one, Machine running on the working
  one.
- **E3** `offers Cancel on My complaints exactly when the server would` (**regression guard: passes today**):
  Given `op` on `/floor`, then the open unstarted ticket's card has Cancel and no other card does.

**Browser — `apps/web/e2e/i18n.spec.ts`**

- **E4** `serves the project language`: Given the worker tenant, when `GET /api/v1/config` is called as
  `asha`, then `language` equals the project's `uiLanguage` (`gu` in `gujarati`). Proves the seed and the
  config only (decision 5, Gujarati proof limit).
- **E5** every existing spec passes in `chromium`, `phone` and `gujarati` (no spec edited except imports).

Commands: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e && pnpm audit:lean && pnpm build`.

## 7. Changelog

`changes/83-actions-words-domain.md`, same format as the neighbouring fragments (checked by `pnpm changelog:check`):

```
- The ticket buttons come from one domain rule, `availableActions`, so a button is shown only when the server accepts it.
- Every label now comes from per-namespace catalogues with a typed `MessageKey`; journeys also run in Gujarati.
```

## 8. Regression risk

- **Behaviour change on the card** exactly where §10 rules a change; each is a named test (T6, T5, W7, ports).
- **Existing specs that exercise the changed screens**, which must stay green: `desk.spec.ts` (action bar, quick
  buttons, "Needs report" count 0, bina joins then leaves as support on a working ticket), `floor.spec.ts` (My
  complaints cancel), `admin.spec.ts`, `board.spec.ts` (section and group labels), `gallery.spec.ts` (the 31
  status pills), and the unit tests `apps/web/src/i18n/i18n.test.ts` and `apps/web/src/screens/desk/views.test.ts`.
- **Parity drift:** T1 restates the route gate list from `tickets/mapper.ts` and models `resolveActingPerson`;
  until the server calls `availableActions`, a server-side rule change must update T1. Named in HANDOFF.
- **Ticket 06 runs in parallel and deletes the tags code entirely.** The second PR to merge deletes
  `tags.en.ts`, `tags.gu.ts`, their entries in `index.ts` and `NAMESPACES`, the fixture keys it removed from the
  frozen JSON only if it removes them from `en`, and the `TagsPanel` line in `TicketDetail.tsx`. If 06 merges
  first, 05 drops the `tags` namespace and that line while rebasing. I3's fixture is taken from `main` at branch
  time.
- **CI time:** a third project adds about half the browser time; `globalTimeout` is 300 s across 2 shards. If
  the run exceeds it, the coder stops and returns to the planner (do not raise the timeout silently).
- **Stale cached tickets** without `raisedLoginId` hide the floor Cancel until refetch (`staleTime: 0` there).
- **i18n runtime:** still one `translation` namespace with the same flat keys; only import paths change.
- **Worker tenant pollution:** `actions.spec.ts` adds people, machines and tickets to the worker's tenant; its
  `afterAll` cancels the live tickets, and the full e2e run must stay green.

## 9. Out of scope

- Any server change, including making the server call `availableActions` (later ticket); tag screens (06).
- `restore`, `correct`, late `report` and `upgrade-kind` on the card (Q17 ruled: unchanged, out of scope).
- The operator action bar on the ticket page (Q18: stays hidden).
- Shared Zod reply contracts and deleting `api-types.ts` (04).
- Real Gujarati strings (24); the gallery namespace.
- English error strings in `.ts` that are not label fields (for example the `useTicketCommand` fallback).
- The machine-stopped follow-up (the handler keeps `machineRunningAt`, so "Machine stopped" stays offered after
  use; same today).

## 10. Rulings (binding; the orchestrator ruled the product questions)

Principle: floor and desk keep Bhavin's v3 buttons, order and copy. `availableActions` never adds a button hidden
today unless the Spec (`docs/spec/DOMAIN.md`) and the server both allow it, and never shows one the server
refuses. Work roles = technician, supervisor, head, admin.

| #      | Ruling                                                                                                        | Effect                                   |
| ------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Q1     | Open ticket, work roles: no "Add me as support" (the server refuses)                                          | build as the server                      |
| Q2     | Lead without a crew row: no Leave (the server refuses)                                                        | build as the server                      |
| Q6     | Personal-login technician who is not lead or primary: no Close on a working ticket                            | build as the server                      |
| Q12    | Shared floor login, operator, other person's unstarted ticket: Cancel on My complaints and Sent               | build as the server                      |
| Q13    | Personal-login operator named reporter, ticket raised from another login: no Cancel                           | build as the server                      |
| Q15    | Plant head: no Cancel                                                                                         | build as the server                      |
| Q16    | Own started ticket on My complaints and Sent, work roles: Cancel shown (the server accepts any active ticket) | build as the server                      |
| Q3     | Lead without a crew row: Join stays hidden                                                                    | stays hidden; follow-up (server accepts) |
| Q4     | Open handed-over ticket, person still on crew: Leave stays shown                                              | stays as today                           |
| Q5     | Leave on closed or cancelled: stays hidden                                                                    | stays hidden; follow-up                  |
| Q7     | Update on an open ticket not handed over: stays hidden                                                        | stays hidden; follow-up                  |
| Q8, Q9 | Machine running on open, closed, cancelled: stays hidden                                                      | stays hidden; follow-up                  |
| Q10    | Machine stopped on open, closed, cancelled: stays hidden                                                      | stays hidden; follow-up                  |
| Q14    | Cancel on an own, unstarted, already cancelled ticket: stays hidden                                           | stays hidden; follow-up                  |
| Q17    | Restore, Correct and Fill report unchanged; Upgrade-kind out                                                  | out of scope                             |
| Q18    | Operator ticket-page action bar stays hidden                                                                  | out of scope; follow-up                  |

Q3, Q4, Q5, Q7, Q8, Q9, Q10, Q14 and Q18 are the "Follow-up: server accepts what the Spec forbids (or the web
hides what the server accepts)" section of `docs/slices/05-pr-body.md`.
