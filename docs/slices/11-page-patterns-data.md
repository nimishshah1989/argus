# 11 — Page patterns: data, queue, detail, form

Issue: [#86](https://github.com/nimishshah1989/argus/issues/86) · Milestone M0 · Blocked by: 04 (merged), 10 (merged) ·
Branch `claude/t11-page-patterns`. One PR, labels `no-parity` (no v3 behaviour row changes; floor and desk look and
behave exactly as today) and `size:large` (the data layer, its guard, three patterns and their gallery states must
land together to be usable; the 12 PNG baselines are binary). The PR body contains `Closes #86`.

## 1. Goal

Every request the app makes to the server goes through one data layer that keeps offline work safe, and Nimish can
open `/gallery` on a phone to see a list, a detail page and a form sheet in their loading, empty, error and offline
states, in English and placeholder Gujarati.

| Label  | Ticket text (MILESTONES "11")                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G1** | [Browser] `defineResource` and `useCommand` are the only fetch path; an offline command queues, replays on reconnect, and a 409 becomes a draft; the sync status shows online, offline, sending and draft. |
| **G2** | [Browser] `QueuePage` (with cursor paging), `DetailPage` and `FormSheet` are in the gallery with loading, empty, error and offline states, axe clean at 360 px.                                            |

**Two readings of "the only fetch path".** (a) Every screen calls TanStack hooks from a resource (screens rewritten
now); (b) every network request is made by the data layer, reached only through a `defineResource` object or
`useCommand`, while screens keep their existing `useQuery` calls and `api.ts` wrappers, which become thin callers of
resources. Chosen: **(b)**. Screens are rebuilt on patterns in 15 and 16; rewriting ~20 `useQuery` sites now would
touch every floor and desk screen for no user-visible change.

## 2. Decisions (technical)

1. **`apps/web/src/data/` is the data layer (ARCHITECTURE §5 "Data").** Files: `client.ts` (the one `fetch`),
   `resource.ts` (`defineResource`), `command.ts` (`useCommand`), `sync.ts` (sync status), `index.ts` (the only
   way in from outside `data/`). `http` (today's `api()`) is **not** exported from `index.ts`.
2. **`api.ts` keeps its exported names; its bodies move.** `api()` moves verbatim into `data/client.ts` as `http()`,
   with `ApiError`, `parseError`, the token functions, `isOffline` and `idempotencyKey`. `command()` and
   `sendCommand()` move to `data/command.ts`. Every remaining wrapper (`getConfig`, `getState`, `getTicket`,
   `listTickets`, `getMe`, `raiseTicket`, `put*`) becomes a one-line caller of a resource defined at the top of
   `api.ts` (§3). `api.ts` re-exports `ApiError, clearToken, getToken, isOffline, sendCommand, setToken` from
   `./data/index.js`, so screens, `i18n/index.ts`, `offline/replay.ts` and `replay.test.ts` keep their imports.
3. **The guard is a vitest test**, `apps/web/src/data/fetch-guard.test.ts` (it runs in `fast-tests.sh`). For every
   `.ts`/`.tsx` under `apps/web/src` except `*.test.ts`, outside the allowed files, it reports:
   - `raw fetch outside data/`: a line matching `/\bfetch\(|XMLHttpRequest|\bsendBeacon\(/` (`refetch(` and
     `fetchNextPage(` do not match);
   - `data/ reached past data/index`: an import specifier matching `/(?:^|\/)data\/(?!index\.js$)/` (specifier text
     only, from `from '…'` or `import('…')`);
   - `sendCommand outside the outbox replay`: a line matching `/\bsendCommand\(/`.

   Allowed files: anything under `data/` (permanent), `sw.ts` (permanent: the service worker serves the app shell,
   outside the page) and `offline/replay.ts` (permanent: the outbox replay is the one caller of `sendCommand`).
   **Dated exceptions** (whole file, shrinking; an exception whose file is clean is itself an error, like
   `tools/check-boundaries.ts`):

   | File                         | Until                                                                                      |
   | ---------------------------- | ------------------------------------------------------------------------------------------ |
   | `screens/Login.tsx`          | ticket 21: sign-in becomes a `WizardPage`; a 401 there must show the message, not redirect |
   | `screens/desk/MinePanel.tsx` | ticket 18: the day-report PDF download reads a blob, not JSON                              |

   Per site: `api.ts:87` moves (decision 2); `ShareButton.tsx` and `push.ts` move to resources (§3); `Login.tsx`
   and `MinePanel.tsx` are the two dated exceptions (moving them changes behaviour: `http` redirects on 401 and
   parses JSON); `sw.ts` is permanent.

4. **`defineResource` (D6), smallest form.** Plain promise methods `one`, `list`, `create`, `update` (the existing
   callers need all four) plus two hooks, `useOne` (TanStack `useQuery`) and `useList` (`useInfiniteQuery` with
   cursor paging). `useCreate`, `useUpdate`, `useDisable` arrive with `CrudPage` in 12 (no caller now).
   - **D:** no response parsing. `apps/web` has no `zod` and ticket 04 (decision 8) kept the web type-only; adding
     a runtime parse would add a dependency or pull `zod` into the bundle. Types come from `@uptimo/shared`.
   - **`transport`** (optional, default `http`) is the one seam: the gallery feeds fake data through the same
     resource and hooks, and vitest passes a recording fake. Two real uses, so it is not speculative.
   - URL rule: no id → `path`; `path` contains `:id` → replaced by `encodeURIComponent(id)`; otherwise
     `` `${path}/${encodeURIComponent(id)}` ``. `list` serialises like today's `listTickets` (skip `undefined` and
     `''`, arrays joined with `,`, `URLSearchParams`).
   - Query keys: `[key, 'one', id ?? null]` and `[key, 'list', query ?? {}]`, so today's prefix invalidations
     (`['tickets']`, `['config']`) still match when screens migrate.
5. **`useCommand` (D6) is today's `useTicketCommand`, moved.** **D:** it takes no `action` argument; `run(ticketId,
action, body)` picks the action at tap time, as the desk and floor do now (one hook per button would be needed
   otherwise). The optimistic update for one ticket (D6) is not in this ticket's goals and is left to 17.
   `components/useTicketCommand.ts` is deleted and its four importers switch to `useCommand` from
   `data/index.js`.
6. **Offline reuses the M1b outbox unchanged.** Only ticket commands queue (`close`, `report`, `isQueueable`), and
   their path is always `/api/v1/tickets/:id/:action`, so `QueueEntry` needs no `path`/`method` and IndexedDB stays
   `uptimo-offline` version 1 with the same two stores. `replay.ts`, `outbox.ts`, `cache.ts`, `OfflineBanner.tsx`,
   `Drafts.tsx` and `replay.test.ts` are not edited. Replay still runs on app open and on `online` (`main.tsx`).
7. **Sync status.** `syncId({ online, queued, drafts })` (pure) returns, first match wins: `offline` when not
   online; `sending` when the queue is not empty (replay pending or in flight); `draft` when drafts exist;
   otherwise `online`. `useSyncStatus()` reads `useOnline()` plus `queueLength()` and `listDrafts()`, refreshed on
   mount, on `online`/`offline` and every 3 s (the `OfflineBanner` rhythm); an IndexedDB failure counts as 0.
   `OnlineContext` (default `null` = follow the browser) lets the gallery force offline for one example.
   - The component `SyncStatus` lives in `patterns/sync-status.tsx` (patterns may import `ui/` and `data/`; `data/`
     may not import `ui/`). It is shown in the header of `QueuePage` and `DetailPage`, so in the gallery, and in
     every screen later built on them. **Not** added to floor or desk now: `OfflineBanner` and `Drafts` stay as
     they are (question 2 for Nimish).
   - The `status.sync.*` labels already exist (`packages/shared/src/i18n/status-flow.en.ts`; `gu` is blank, so
     English shows).
8. **Patterns (`apps/web/src/patterns/`)** render a `<section>` with an `<h2>` and the sync pill, never `<main>`
   (the face wraps them in `Page`; a nested `<main>` fails axe). Strings arrive translated from the caller (the
   gallery uses its own namespace), except the six shared pattern messages (§5). The view state is one pure function
   (`viewState`) so the four states are unit-tested without a DOM:
   - data present → `empty` if no items, else `ready` (cached data offline still shows, with the Offline pill);
   - an `ApiError` → `empty` when its code is `not_found` (a detail that no longer exists), else `error`;
   - not online, or any other error (a network failure) → `offline`;
   - otherwise `loading`.

   `FormSheet` is the kit `Sheet` plus labelled `Input`s; it reads `useOnline()` and takes `pending`, `error` and
   `onSubmit` from the caller (in a face: from `useCommand`). No schema validation (no `zod` in web, decision 4);
   `required` fields only. A failed "load more" leaves the button to tap again.

9. **Gallery.** Pattern examples run under their own `QueryClient` (`retry: false`, `staleTime: Infinity`), so the
   error state shows at once and nothing refetches. Fake transports return fixed data (no dates, no randomness, no
   names). Offline examples are wrapped in `<OnlineContext.Provider value={false}>` with a transport that never
   settles. FormSheet examples are closed until their trigger is pressed (the existing sheet test expects exactly
   one `dialog`).

## 3. Files

Write area: `apps/web/**`, the plan, `changes/86-page-patterns-data.md`, and **one shared catalogue file**
(`packages/shared/src/i18n/common.en.ts`, question 1 for the orchestrator). Not touched: `apps/server/**`,
`packages/db/**`, `packages/shared/src/config.ts`, `tools/**`, `docs/plan/**`, any migration, any `package.json`
(no new dependency), `offline/*`, `OfflineBanner.tsx`, `Drafts.tsx`, every existing test and baseline.

**Data layer (`apps/web/src/data/`, all new)**

| File                  | Content                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`           | Moved verbatim from `api.ts` lines 36-107: `TOKEN_KEY`, `getToken`, `setToken`, `clearToken`, `ApiError`, `parseError`, `api` renamed `http`, `isOffline`, `idempotencyKey` (now exported). The only `fetch` in the page code. About 85 lines.                                                                                                    |
| `resource.ts`         | `Transport`, `ListQuery`, `CursorPage`, `ResourceSpec`, `Resource`, `defineResource` (§4, decision 4). About 90 lines.                                                                                                                                                                                                                            |
| `command.ts`          | `sendCommand` and `runCommand` (today's `api.ts` `sendCommand` and `command`, moved verbatim, `runCommand` renamed), `CommandHandle`, `useCommand` (today's `useTicketCommand` body verbatim, including the English fallback `'Could not save. Try again.'`). About 75 lines.                                                                     |
| `sync.ts`             | `SyncId`, `syncId`, `OnlineContext`, `useOnline`, `useSyncStatus` (decision 7). About 65 lines.                                                                                                                                                                                                                                                   |
| `index.ts`            | `export { ApiError, clearToken, getToken, idempotencyKey, isOffline, setToken } from './client.js';` `export { defineResource } from './resource.js';` and its types; `export { sendCommand, useCommand } from './command.js';` and `CommandHandle`; `export { OnlineContext, syncId, useOnline, useSyncStatus } from './sync.js';` and `SyncId`. |
| `fetch-guard.test.ts` | Decision 3; tests F1-F3.                                                                                                                                                                                                                                                                                                                          |
| `resource.test.ts`    | R1-R2.                                                                                                                                                                                                                                                                                                                                            |
| `command.test.ts`     | C1-C3.                                                                                                                                                                                                                                                                                                                                            |
| `sync.test.ts`        | S1.                                                                                                                                                                                                                                                                                                                                               |

**Existing web files (minimal edits; no visible change)**

| File                                                                                                          | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.ts`                                                                                                      | Delete lines 36-107 and `sendCommand`/`command` (moved). Add `import { defineResource, idempotencyKey } from './data/index.js';` and `export { ApiError, clearToken, getToken, isOffline, sendCommand, setToken } from './data/index.js';`. Remove the now-unused `enqueue`/`isQueueable` import. Define the resources: `config` `<Config>` `'/api/v1/config'`; `state` `<State>` `'/api/v1/state'`; `tickets` `<TicketDetail, Ticket>` `'/api/v1/tickets'`; `me` `<{ user: Me }>` `'/api/v1/auth/me'`; `brand` `<{ company: string }>` `'/api/v1/brand'`; `settings` `'/api/v1/settings'`; `criticality` `'/api/v1/machines/:id/criticality'`; `waitReasons` `'/api/v1/lists/wait_reason'` (keys `config`, `state`, `tickets`, `me`, `brand`, `settings`, `machines`, `lists`). Bodies: `load: () => config.one()`, `() => state.one()`, `getTicket = (id) => tickets.one(id)`, `listTickets = (query = {}) => tickets.list(query)`, `getMe = () => me.one()`, new `getBrand = () => brand.one()`, `raiseTicket = (body) => tickets.create<{ ticket: Ticket }>(body, { idempotencyKey: idempotencyKey() })`, `putSeverityMatrix = (value) => settings.update<{ ok: boolean }>('severity_matrix', { value })`, `putSlaPolicies = (body) => settings.update<{ ok: boolean }>('sla-policies', body)`, `putMachineCriticality = (id, c) => criticality.update<{ ok: boolean }>(id, { criticality: c })`, `putWaitReason(item)` → `waitReasons.update<{ ok: boolean }>(item.code, { …today's object… })`. `TicketListQuery` becomes a `type` alias (same fields) so it fits `ListQuery`. Every exported type and name otherwise unchanged. |
| `components/ShareButton.tsx`                                                                                  | Import `getBrand` instead of `api`; `queryFn: getBrand`. Nothing else.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `push.ts`                                                                                                     | Replace `import { api } from './api.js'` with `import { defineResource } from './data/index.js'`; `const push = defineResource<KeyResponse>({ key: 'push', path: '/api/v1/push' });` `serverKey`: `await push.one('key')`; `bind`: `await push.create({ subscription: subscription.toJSON(), actingPersonId }, { id: 'subscribe' })`; `disablePush`: `await push.create({ endpoint: subscription.endpoint }, { id: 'unsubscribe' })`. Same paths, methods and bodies.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `components/useTicketCommand.ts`                                                                              | **Deleted** (moved to `data/command.ts`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `components/AdminPanel.tsx`, `screens/floor/MyComplaints.tsx`, `screens/Desk.tsx`, `screens/TicketDetail.tsx` | The `useTicketCommand` import becomes `import { useCommand } from '<rel>/data/index.js';` and each `useTicketCommand()` call becomes `useCommand()` (AdminPanel has two). Nothing else.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Patterns (`apps/web/src/patterns/`, all new; each under 150 lines, every function under 60)**

| File                 | Content                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `view-state.ts`      | `ViewState`, `viewState`, `offlineNotice` (§4). Pure.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `view-state.test.ts` | V1-V2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `sync-status.tsx`    | `SyncStatus`: `<span role="status" data-testid="sync-status"><StatusPill group="sync" id={useSyncStatus()} /></span>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `frame.tsx`          | `PatternFrame` (`useId()` heading id; `<section aria-labelledby>` → `Stack gap={3}` → `Inline gap={2}` with `<h2 className="text-title3 font-semibold">` and `<SyncStatus />`, then children) and `StateNotice` (§4): loading `<p role="status" className="text-body text-neutral-600">{t('common.loading')}</p>`; empty `<p className="text-body text-neutral-600">{empty}</p>`; error `Stack gap={2}` with `<p role="alert" className="text-body text-danger">{t('kit.pattern.error')}</p>` and a secondary `Button` `t('kit.pattern.retry')` calling `onRetry`; offline `<p role="status" className="text-body text-neutral-600">{t('kit.pattern.offline')}</p>`. |
| `queue-page.tsx`     | `QueuePage` (§4): `resource.useList(query)`, items = all pages' `items` flattened; `ready` → `<ul className="flex flex-col gap-3">` of `<li key={rowKey(item)}>{row(item)}</li>`, then, if `hasNextPage`, a secondary `Button` (`disabled={isFetchingNextPage}`, text `isFetchingNextPage ? t('common.loading') : t('kit.pattern.more')`, `onClick` `fetchNextPage()`); other states → `StateNotice` with `onRetry` = `refetch()`.                                                                                                                                                                                                                                   |
| `detail-page.tsx`    | `DetailPage` (§4): `resource.useOne(id)`; `ready` → `<dl className="grid grid-cols-2 gap-2">` with `<dt className="text-footnote text-neutral-600">` / `<dd className="text-body">` per fact, one `Card title={s.title}` per section, then `actions?.(item)` inside `Inline gap={2}`; other states → `StateNotice` (`empty` for `ready` with no data cannot occur; `viewState` gets `isEmpty: false`).                                                                                                                                                                                                                                                               |
| `form-sheet.tsx`     | `FormSheet` (§4): `Sheet` → `<form aria-label={title} onSubmit>` → `Stack`; per field `Label htmlFor` + `Input id required value onChange`; `offlineNotice(online, offlineAllowed)` key shown as `<p role="status" className="text-footnote text-neutral-600">`; `error` as `<p role="alert" className="text-body text-danger">`; primary `Button type="submit"`, `disabled={pending \|\| missing \|\| notice === 'kit.form.needsConnection'}` (`missing` = a required field trims to `''`), text `pending ? t('common.sending') : submitLabel`. Submit: `preventDefault`; `if (await onSubmit(values)) { setValues({}); onOpenChange(false); }`.                    |

**Gallery (`apps/web/src/gallery/`)**

| File                         | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `patterns-data.ts` (new)     | §4 gallery data: `EXAMPLES`, `GalleryRow`, `GalleryDetail`, `ROWS` (5 rows), `DETAIL`, the transports and `queueResources` / `detailResources` (one `defineResource` per state, key `gallery-queue-<state>` / `gallery-detail-<state>`, path `/gallery/tickets`). No JSX.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `patterns-section.tsx` (new) | `const galleryQueries = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })` at module level. `PatternsSection` wraps two sections in `<QueryClientProvider client={galleryQueries}>`: `data-testid="gallery-queue"` (`h2` `t('section.queue')`) and `data-testid="gallery-detail"` (`h2` `t('section.detail')`), each holding one `<div data-testid="gallery-queue-<state>">` / `gallery-detail-<state>` per state in `EXAMPLES` order, the `offline` one inside `<OnlineContext.Provider value={false}>`. Title `t('example', { name: t('queue.name'), state: t('state.<state>') })` (detail: `detail.name`). Queue row: `<Card title={row.ref}><p className="text-body">{t(row.problemKey)}</p></Card>`; `rowKey` `row.id`; `empty` `t('queue.empty')`. Detail: id `'gallery-1'`; facts machine / reported / problem (`t('detail.fact.*')` labels; values `d.machine`, `d.reported`, `t(d.problemKey)`); one section `t('detail.history')` with a `<ul>` of `t(key)` per `d.historyKeys`; `actions` = one primary `Button` `t('detail.action')` (no handler); `empty` `t('detail.empty')`. |
| `form-section.tsx` (new)     | `data-testid="gallery-forms"`, `h2` `t('section.forms')`, `useState<'loading' \| 'empty' \| 'error' \| 'offline' \| null>(null)`. For each of the four states a secondary `Button data-testid="gallery-form-open-<state>"` (`t('form.open', { state: t('state.<state>') })`) and a `FormSheet` with `open={open === state}`, `title={t('form.name')}`, `submitLabel={t('form.submit')}`, `fields=[{ name: 'note', label: t('form.note'), required: true }]`, `offlineAllowed`, `onSubmit={async () => true}`; `pending={state === 'loading'}`; `error={state === 'error' ? t('form.error') : null}`; the `offline` one inside `<OnlineContext.Provider value={false}>`.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `Gallery.tsx`                | Import and render `<PatternsSection />` and `<FormSection />` after `<StatusSection />`. Nothing else.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `strings.ts`                 | `galleryEn` gains the §5 keys (`galleryGu` derives them).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

**Shared catalogue**: `packages/shared/src/i18n/common.en.ts` gains the six `kit.pattern.*` / `kit.form.*` keys (§5)
after `kit.notFound`. `common.gu.ts` is `blank(commonEn)`, so it is unchanged.

**Browser tests and baselines**

- `apps/web/e2e/gallery/gallery.spec.ts`: append G1-G4 (§6). Existing tests 7-12 are not edited.
- `apps/web/e2e/gallery/__screenshots__/` (12 new, from `pnpm gallery:update:docker`): `queue-{en,gu}.png`,
  `detail-{en,gu}.png`, `form-{loading,empty,error,offline}-{en,gu}.png`. The 10 existing PNGs must come out
  byte-identical (the new sections sit below `gallery-status`; `sheet-open-*` is a viewport shot of the page top).
  If `git diff --stat` shows any of the 10 changed, the coder stops and returns the question.

**Records**: `changes/86-page-patterns-data.md` (new, §7). MILESTONES, ledger, HANDOFF and `wiki/log.md` are the
orchestrator's.

## 4. Interfaces

```ts
// data/client.ts (moved from api.ts; signatures unchanged except the rename)
export function getToken(): string | null;
export function setToken(token: string): void;
export function clearToken(): void;
export class ApiError extends Error {
  code: string;
  field?: string;
  constructor(code: string, message: string, field?: string);
}
export async function http<T>(path: string, init?: RequestInit): Promise<T>; // was api(); NOT re-exported by index.ts
export function isOffline(): boolean;
export function idempotencyKey(): string; // now exported

// data/resource.ts
export type Transport = (path: string, init?: RequestInit) => Promise<unknown>;
export type ListQuery = Record<string, string | number | readonly string[] | undefined>;
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
} // TicketPage's shape
export interface ResourceSpec {
  key: string; // first query-key segment
  path: string; // e.g. '/api/v1/tickets' or '/api/v1/machines/:id/criticality'
  transport?: Transport; // default http
}
export interface Resource<TOne, TItem> {
  key: string;
  one(id?: string): Promise<TOne>; // GET url(id)
  list(query?: ListQuery): Promise<CursorPage<TItem>>; // GET path?query
  create<R = unknown>(
    body: unknown,
    options?: { id?: string; idempotencyKey?: string },
  ): Promise<R>; // POST url(options.id), JSON body, Idempotency-Key header when given
  update<R = unknown>(id: string | undefined, body: unknown): Promise<R>; // PUT url(id), JSON body
  useOne(id?: string): UseQueryResult<TOne, Error>; // queryKey [key, 'one', id ?? null]
  useList(
    query?: ListQuery,
  ): UseInfiniteQueryResult<InfiniteData<CursorPage<TItem>, string | undefined>, Error>;
  // queryKey [key, 'list', query ?? {}]; initialPageParam undefined; queryFn list({ ...query, cursor: pageParam });
  // getNextPageParam page => page.nextCursor ?? undefined
}
export function defineResource<TOne = unknown, TItem = never>(
  spec: ResourceSpec,
): Resource<TOne, TItem>;

// data/command.ts (CommandAction, CommandBody, CommandResult, Ticket: type imports from '../api.js')
export function sendCommand(
  ticketId: string,
  action: CommandAction,
  body: object,
  key: string,
): Promise<{ ticket: Ticket }>;
export async function runCommand(
  ticketId: string,
  action: CommandAction,
  body: CommandBody,
): Promise<CommandResult>;
export interface CommandHandle {
  run(ticketId: string, action: CommandAction, body: CommandBody): Promise<boolean>; // true = sent or queued
  error: string | null;
  pending: boolean;
}
export function useCommand(): CommandHandle; // invalidates ['state'], ['ticket'], ['tickets'] after success, as today

// data/sync.ts
export type SyncId = 'online' | 'offline' | 'sending' | 'draft'; // = keys of ui/status/sync.ts
export function syncId(input: { online: boolean; queued: number; drafts: number }): SyncId;
export const OnlineContext: React.Context<boolean | null>; // null = follow the browser
export function useOnline(): boolean; // context value ?? useSyncExternalStore(online/offline events, () => navigator.onLine, () => true)
export function useSyncStatus(): SyncId;

// patterns/view-state.ts
export type ViewState = 'ready' | 'empty' | 'loading' | 'error' | 'offline';
export function viewState(input: {
  online: boolean;
  hasData: boolean;
  isEmpty: boolean;
  error: unknown;
}): ViewState;
export function offlineNotice(
  online: boolean,
  offlineAllowed: boolean,
): 'kit.form.offlineQueued' | 'kit.form.needsConnection' | null;

// patterns/frame.tsx
export function PatternFrame(p: { title: string; children: ReactNode }): JSX.Element;
export function StateNotice(p: {
  state: Exclude<ViewState, 'ready'>;
  empty: string;
  onRetry: () => void;
}): JSX.Element;

// patterns/sync-status.tsx
export function SyncStatus(): JSX.Element;

// patterns/queue-page.tsx
export interface QueuePageProps<Row> {
  title: string;
  resource: Resource<unknown, Row>;
  query?: ListQuery;
  row: (item: Row) => ReactNode;
  rowKey: (item: Row) => string;
  empty: string; // translated
}
export function QueuePage<Row>(p: QueuePageProps<Row>): JSX.Element;

// patterns/detail-page.tsx
export interface DetailFact {
  label: string;
  value: string;
}
export interface DetailSection {
  title: string;
  body: ReactNode;
}
export interface DetailPageProps<T> {
  title: string;
  resource: Resource<T, unknown>;
  id: string;
  facts: (item: T) => DetailFact[];
  sections?: (item: T) => DetailSection[];
  actions?: (item: T) => ReactNode; // the action bar slot (availableActions in 16)
  empty: string; // shown for a not_found answer
}
export function DetailPage<T>(p: DetailPageProps<T>): JSX.Element;

// patterns/form-sheet.tsx
export interface FormField {
  name: string;
  label: string;
  required?: boolean;
}
export interface FormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  submitLabel: string;
  fields: FormField[];
  offlineAllowed: boolean;
  pending: boolean;
  error: string | null;
  onSubmit: (values: Record<string, string>) => Promise<boolean>; // true closes and clears
}
export function FormSheet(p: FormSheetProps): JSX.Element;

// gallery/patterns-data.ts
export const EXAMPLES = ['ready', 'loading', 'empty', 'error', 'offline'] as const;
export type Example = (typeof EXAMPLES)[number];
export interface GalleryRow {
  id: string;
  ref: string;
  problemKey: string;
}
export interface GalleryDetail {
  ref: string;
  machine: string;
  reported: string;
  problemKey: string;
  historyKeys: string[];
}
export const queueResources: Record<Example, Resource<unknown, GalleryRow>>;
export const detailResources: Record<Example, Resource<GalleryDetail, unknown>>;
// gallery/patterns-section.tsx, gallery/form-section.tsx
export function PatternsSection(): JSX.Element;
export function FormSection(): JSX.Element;
```

Gallery transports (`patterns-data.ts`, all `Transport`):

- `ROWS`: ids `gallery-1`…`gallery-5`, refs `BD-0101`…`BD-0105`, `problemKey` `queue.problem.1`…`5`.
- `DETAIL`: `{ ref: 'BD-0101', machine: 'CNC-07', reported: '08:30', problemKey: 'queue.problem.1', historyKeys:
['detail.history.1', 'detail.history.2'] }`.
- queue `ready`: reads `cursor` from `new URL(path, 'http://gallery.invalid')`; none → `{ items: ROWS[0..2],
nextCursor: 'page-2' }`; `'page-2'` → `{ items: ROWS[3..4], nextCursor: null }`.
- queue `empty` → `{ items: [], nextCursor: null }`. detail `ready` → `DETAIL`. detail `empty` → rejects
  `new ApiError('not_found', 'Not found')`.
- `error` (both) → rejects `new ApiError('internal', 'Sample error')`.
- `loading` and `offline` (both) → `new Promise(() => undefined)` (never settles).

## 5. Data and exact strings

No table, column, migration, API route or contract change. No new IndexedDB store, key or version. Browser state
read or written:

- IndexedDB `uptimo-offline` v1, stores `queue` and `drafts` (`QueueEntry`/`DraftEntry`, unchanged): written by
  `runCommand` (enqueue) and `replay.ts` (as today); read by `useSyncStatus` (`queueLength`, `listDrafts`).
- `localStorage` `uptimo_token` (read by `http`), `uptimo.cache.state` / `uptimo.cache.config` (unchanged).
- `navigator.onLine` and the `online`/`offline` events (`useOnline`).
- TanStack Query cache: the new keys above; the gallery's keys live only in its own `QueryClient`.

No personal data: gallery data is fake machine codes, refs and problem phrases.

**`common.en.ts` (+6):** `kit.pattern.more` Load more · `kit.pattern.error` Could not load. Try again. ·
`kit.pattern.retry` Try again · `kit.pattern.offline` You are offline. This will load when you reconnect. ·
`kit.form.offlineQueued` You are offline. This will send when you reconnect. · `kit.form.needsConnection` You are
offline. Connect to send this. (Reused: `common.loading` Loading…, `common.sending` Sending…, `status.sync.*`.)

**`galleryEn` (+31):**

- `section.queue` Queue page · `section.detail` Detail page · `section.forms` Form sheet
- `example` {{name}}: {{state}}
- `state.ready` loaded · `state.loading` loading · `state.empty` empty · `state.error` error · `state.offline` offline
- `queue.name` Open tickets · `queue.empty` No open tickets.
- `queue.problem.1` Spindle noise on start-up · `.2` Coolant leak at the chuck · `.3` Hydraulic pressure low ·
  `.4` Door switch not closing · `.5` Chip conveyor jammed
- `detail.name` Ticket · `detail.empty` This ticket no longer exists. · `detail.fact.machine` Machine ·
  `detail.fact.reported` Reported · `detail.fact.problem` Problem · `detail.history` History ·
  `detail.history.1` Reported from the floor · `detail.history.2` Work started · `detail.action` Start work
- `form.open` Open form: {{state}} · `form.name` Close the ticket · `form.note` Note · `form.submit` Close ticket ·
  `form.error` The ticket changed while you were away. Check it and try again.

`galleryGu` derives `ક ખ ગ · <English>` for each, as today.

## 6. Test cases (each fails first)

Order: write each test, see it red, then build. Vitest runs in the node environment (no DOM): hooks are thin and
their logic sits in the tested pure functions. Where a test needs browser globals it uses `vi.stubGlobal` for
`fetch`, `localStorage` (a `Map`-backed `getItem`/`setItem`/`removeItem`), `navigator` (`{ onLine }`) and `window`
(`{ location: { assign: vi.fn() } }`), with `vi.unstubAllGlobals()` in `afterEach`.

**G1: one fetch path, offline, sync status**

`apps/web/src/data/fetch-guard.test.ts`, `describe('fetch guard')`. Helpers in the file: `readSrc(root)` walks
`apps/web/src` (resolved from `import.meta.url`) returning `{ path, text }` with `/` separators relative to
`src`, skipping `*.test.ts`; `fetchErrors(files, exceptions)` returns `"<path>:<line>: <rule>"` per hit and
`"<path>: EXCEPTIONS lists it but it is clean; remove it"` per stale exception; `EXCEPTIONS` is decision 3's table
as `{ file, until }[]`. Write `fetchErrors` as a stub returning `[]` first, so F2 and F3 are red too. Keep each
callback under 60 lines (split `describe` blocks if needed).

1. **F1 `defineResource and useCommand are the only fetch path in apps/web/src`.** Given the real tree, when
   checked with `EXCEPTIONS`, then the result is `[]`. Red on `main`: `api.ts:87`.
2. **F2 `flags a planted raw fetch, a deep data import and a direct sendCommand`.** Given in-memory files
   `screens/x.tsx` = `const r = await fetch('/api/v1/x');`, `faces/y.ts` = `import { http } from '../data/client.js';`
   and `components/z.ts` (line 2) = `sendCommand(id, 'close', {}, key);`, plus `data/client.ts`, `sw.ts` and
   `offline/replay.ts` each containing `fetch(` and `sendCommand(`, and `gallery/a.tsx` =
   `import { defineResource } from '../data/index.js'; q.refetch(); q.fetchNextPage();`, when checked with `[]`,
   then the result is exactly `['screens/x.tsx:1: raw fetch outside data/', 'faces/y.ts:1: data/ reached past
data/index', 'components/z.ts:2: sendCommand outside the outbox replay']`.
3. **F3 `honours a dated exception and reports a stale one`.** Given `screens/Login.tsx` containing `fetch(` and
   `screens/desk/MinePanel.tsx` containing none, with both in the exceptions, when checked, then the result is
   exactly `['screens/desk/MinePanel.tsx: EXCEPTIONS lists it but it is clean; remove it']`.

`apps/web/src/data/resource.test.ts`, `describe('defineResource')`

4. **R1 `one, list, create and update build the request through the transport`.** Given a recording transport
   resolving `{}` and `defineResource({ key: 'x', path: '/api/v1/x', transport })`, when called, then the
   recorded `(path, init)` are:
   - `one()` → `/api/v1/x`, no method; `one('a b')` → `/api/v1/x/a%20b`;
   - `list({ status: ['open', 'waiting'], limit: 50, machineId: '', cursor: undefined })` →
     `/api/v1/x?status=open%2Cwaiting&limit=50`;
   - `create({ a: 1 }, { id: 'subscribe', idempotencyKey: 'k-1' })` → `/api/v1/x/subscribe`, `method: 'POST'`,
     `body: '{"a":1}'`, `new Headers(init.headers).get('Idempotency-Key') === 'k-1'`;
   - `update('code-1', { b: 2 })` → `/api/v1/x/code-1`, `method: 'PUT'`, `body: '{"b":2}'`;
   - with `path: '/api/v1/m/:id/criticality'`, `update('m-1', {})` → `/api/v1/m/m-1/criticality`.
5. **R2 `the default transport is the one http client: bearer token, JSON, ApiError on 409`.** Given
   `localStorage` holding `uptimo_token` = `tok-1` and `fetch` stubbed to answer `{ ok: true }` (status 200), when
   `defineResource({ key: 'k', path: '/api/v1/k' }).one()` runs, then `fetch` got `/api/v1/k` with
   `Authorization: Bearer tok-1` and the call resolved `{ ok: true }`; and when `fetch` answers status 409 with
   `{ error: { code: 'conflict', message: 'Ticket changed' } }`, then `create({})` rejects with an `ApiError` whose
   `code` is `conflict` and `message` is `Ticket changed`.

`apps/web/src/data/command.test.ts`, `describe('runCommand')`. `vi.mock('../offline/outbox.js')` keeping the
original module but replacing `enqueue` (resolves `{ id: 'q-1' }`), as `replay.test.ts` does.

6. **C1 `an offline close is queued with its key and nothing is sent`.** Given `navigator.onLine` false, when
   `runCommand('t-1', 'close', { personId: 'p-1', kind: 'done' })`, then `enqueue` got `{ action: 'close',
ticketId: 't-1', body, idempotencyKey: <non-empty string>, at: <ISO string> }`, `fetch` was not called, and the
   result is `{ queued: true, id: 'q-1' }`.
7. **C2 `an offline start is not queued`.** Given offline and `fetch` rejecting `new TypeError('Failed to
fetch')`, when `runCommand('t-1', 'start', { personId: 'p-1' })`, then `enqueue` was not called and the call
   rejects with that `TypeError`.
8. **C3 `online, a command posts to the ticket action with an Idempotency-Key`.** Given online and `fetch`
   answering 200 `{ ticket: { id: 't-1' } }`, when `runCommand('t-1', 'close', body)`, then `fetch` got
   `/api/v1/tickets/t-1/close`, `method: 'POST'`, a non-empty `Idempotency-Key`, `body` = `JSON.stringify(body)`,
   and the result is `{ ticket: { id: 't-1' } }`.

`apps/web/src/data/sync.test.ts`, `describe('syncId')`

9. **S1 `shows offline, sending, draft and online in that order of precedence`.** Given each input, then:
   `{ online: false, queued: 1, drafts: 1 }` → `offline`; `{ true, 1, 0 }` → `sending`; `{ true, 1, 1 }` →
   `sending`; `{ true, 0, 2 }` → `draft`; `{ true, 0, 0 }` → `online`.

`apps/web/e2e/gallery/gallery.spec.ts` (the gallery config; no database)

10. **G4 `sync status: online, offline, sending, then draft after a 409 replay`.**
    - Given `page.route('**/api/v1/tickets/*/close', …)` that waits for a `release` promise, then fulfils 409
      `application/json` `{"error":{"code":"conflict","message":"Ticket changed"}}`, and `/gallery?lang=en`;
    - `pill = page.getByTestId('gallery-queue-ready').getByTestId('sync-status')` has text `Online`;
    - `await page.evaluate((u) => import(u).then((m) => { (window as unknown as { outbox: unknown }).outbox = m; }), '/src/offline/outbox.ts')`
      (loaded while online);
    - when `page.context().setOffline(true)`, then `pill` has text `Offline`;
    - when the page calls `outbox.enqueue({ action: 'close', ticketId: 'gallery-1', ref: 'BD-0101', body: {
personId: 'p-1', kind: 'done' }, idempotencyKey: 'gallery-key-1' })` and then `setOffline(false)`, then
      `pill` has text `Sending` (the replay from `main.tsx` is held by the route);
    - when `release()` runs, then within 10 s `pill` has text `Draft`, and `outbox.listDrafts()` returns one entry
      with `reason` `Ticket changed` and `ref` `BD-0101` (kept, not dropped), and `outbox.queueLength()` is 0.

    The full real-stack proof that a desk close made offline goes through `useCommand`, queues, replays and
    turns a 409 into a visible draft is the existing `apps/web/e2e/offline.spec.ts` (`queues an offline close and
replays it to Closed`; `shows a draft when a queued close replays onto an already-closed ticket`), which must
    stay green unchanged.

**G2: patterns in the gallery**

`apps/web/src/patterns/view-state.test.ts`

11. **V1 `viewState picks ready, empty, loading, error and offline`.** Given each input, then:
    `{ online: true, hasData: true, isEmpty: false, error: null }` → `ready`; same with `isEmpty: true` → `empty`;
    `{ online: false, hasData: true, isEmpty: false, error: null }` → `ready`;
    `{ online: true, hasData: false, isEmpty: false, error: new ApiError('not_found', 'x') }` → `empty`;
    `… error: new ApiError('internal', 'x') }` → `error`; `… error: new TypeError('Failed to fetch') }` →
    `offline`; `{ online: false, hasData: false, isEmpty: false, error: null }` → `offline`;
    `{ online: true, hasData: false, isEmpty: false, error: null }` → `loading`.
12. **V2 `offlineNotice: queued when allowed, needs a connection otherwise`.** `(true, true)` and `(true, false)` →
    `null`; `(false, true)` → `kit.form.offlineQueued`; `(false, false)` → `kit.form.needsConnection`.

`apps/web/e2e/gallery/gallery.spec.ts`

13. **G1 `patterns <lang>: queue and detail show every state at 360 px, axe clean`** (en, gu: 2 tests). Given
    `/gallery?lang=<lang>`, then:
    - `gallery-queue-ready` has 3 `li` and a button `Load more` (gu: `Load more`, English fallback);
    - `gallery-queue-loading` and `gallery-detail-loading` contain `Loading…`;
    - `gallery-queue-empty` contains `No open tickets.`; `gallery-detail-empty` contains `This ticket no longer
exists.`;
    - `gallery-queue-error` and `gallery-detail-error` each have a `role=alert` with `Could not load. Try again.`
      and a button `Try again`;
    - `gallery-queue-offline` and `gallery-detail-offline` contain `You are offline. This will load when you
reconnect.` and their `sync-status` has text `Offline`;
    - `gallery-detail-ready` contains `CNC-07` and `Reported from the floor`;
    - `gallery-queue` matches `queue-<lang>.png` and `gallery-detail` matches `detail-<lang>.png`;
    - `AxeBuilder.withTags(AXE_TAGS)` on the page finds 0 violations.
14. **G2 `queue pages by cursor`.** Given `/gallery?lang=en`, when `Load more` in `gallery-queue-ready` is
    clicked, then it has 5 `li`, the last containing `BD-0105`, and no `Load more` button.
15. **G3 `form sheet <state> <lang>`** (4 states × en, gu: 8 tests). Given `/gallery?lang=<lang>`, when
    `gallery-form-open-<state>` is clicked, then the one `dialog` is visible with focus inside it, and:
    - `empty`: the `Close ticket` button is disabled; after filling `Note` with `Belt replaced` it is enabled;
    - `loading`: the submit button reads `Sending…` and is disabled;
    - `error`: a `role=alert` in the dialog contains `The ticket changed while you were away.`;
    - `offline`: the dialog contains `You are offline. This will send when you reconnect.`;

    (Before the `empty` fill step) the page matches `form-<state>-<lang>.png`, axe finds 0 violations, and
    Escape closes the dialog.

**Must stay green, unchanged:** `apps/web/src/offline/replay.test.ts`, `push.test.ts`, the i18n tests; gallery
tests 7-13 of slice 10 (their axe runs now cover the new sections too: wider, not weaker); and the real-stack
browser smoke `pnpm test:e2e`, in particular `floor.spec.ts`, `desk.spec.ts`, `offline.spec.ts`,
`settings-severity.spec.ts` (PUT through `settings.update`), `admin.spec.ts` and `actions.spec.ts` (commands
through `useCommand`).

**Commands.** Red first: `pnpm exec vitest run apps/web/src`, then `pnpm gallery:test`. Then `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm ui:check`, `pnpm size`, `pnpm pii:scan`, `pnpm build`, `pnpm test:e2e`,
`pnpm gallery:update:docker` (commit the 12 new PNGs; the 10 old ones unchanged), `pnpm gallery:test`,
`pnpm format:check`, `pnpm verify`.

## 7. Changelog

`changes/86-page-patterns-data.md`:

```
- One data layer: every server call goes through `defineResource` or `useCommand`; a test fails on a raw `fetch` anywhere else (two dated exceptions: sign-in until 21, day-report PDF until 18).
- Offline commands still queue, replay on reconnect and turn a refusal into a draft; a sync status shows online, offline, sending and draft.
- `/gallery` shows the queue, detail and form-sheet patterns in their loading, empty, error and offline states.
```

## 8. Regression risk

- **`api()` moves and is renamed:** every wrapper keeps its path, method, headers and body (R1, R2), and the 401
  sign-out is moved verbatim. Covered by `pnpm test:e2e` across floor, desk, settings and admin.
- **`useTicketCommand` → `useCommand`:** same body, same invalidations; four import lines change. Covered by
  `actions.spec.ts`, `admin.spec.ts`, `offline.spec.ts`.
- **Push:** same three requests; only reachable with VAPID keys, so covered by typecheck and code review.
- **`TicketListQuery` interface → type:** same fields; typecheck.
- **Bundle:** `data/` joins the main bundle (small); `patterns/` is imported only by the gallery chunk, which the
  production build drops (slice 10's T13 still guards it).
- **Gallery baselines:** 12 new; the 10 existing must not change. **PR size:** above 800 lines → `size:large`.

## 9. Out of scope

- Moving any screen onto `QueuePage`, `DetailPage` or `FormSheet`, or replacing screens' `useQuery` calls (15, 16).
- Showing `SyncStatus` on floor or desk, or changing `OfflineBanner` / `Drafts` (question 2).
- `useCreate`, `useUpdate`, `useDisable`, `CrudPage`, `WizardPage`, `BoardPage`, `DashboardPage`, charts (12).
- Response parsing with the shared schemas; optimistic updates (17); a message on a failed "load more" (16).
- Generalising `QueueEntry` beyond ticket commands; any IndexedDB change; Background Sync.
- Real Gujarati (24); sign-in and the PDF download (the dated exceptions, 21 and 18).

## 10. Questions

**For the orchestrator (technical rulings to record):**

1. The six pattern messages belong in the shared catalogue (`packages/shared/src/i18n/common.en.ts`, D7), which is
   outside the stated `apps/web` write area. Please allow that one file (6 added lines; `common.gu.ts` derives).
2. Deviations marked **D**: `useCommand()` takes no action (decision 5); no response parsing (decision 4); no
   optimistic update yet (decision 5).
3. Reading (b) of "the only fetch path" (§1), with two dated exceptions (decision 3).

**For Nimish (plain English, not blocking):**

1. The new messages say: "Load more", "Could not load. Try again.", "Try again", "You are offline. This will load
   when you reconnect.", "You are offline. This will send when you reconnect." and "You are offline. Connect to send
   this." Are these the words you want?
2. The small "Online / Offline / Sending / Draft" marker will sit at the top of every list and detail page as they
   are rebuilt. Should it also replace today's orange offline strip on the floor and desk now, or wait for the
   rebuilt screens (my suggestion: wait)?
