# M2-34b — the waiting feed (oldest first) and sign-off turnaround on live tickets

Milestone M2 (Accountability), ticket 34 (browser half, part 2: the feed left by PR #261/#262). Frozen plan:
one writer, the files named below. Read `docs/LEAN.md`, `docs/TESTING.md`,
`apps/server/src/modules/accountability/signoff-feed.ts`,
`apps/server/src/modules/tickets/repo/signoff.ts`, `apps/web/src/components/SignoffPanel.tsx`,
`apps/web/src/screens/desk/Board.tsx` and `docs/design/slices/slice-6-signoff.html` (frames "Waiting for
production's OK") before writing anything.

## What already exists (do not rebuild)

- `GET /api/v1/board/signoff` (accountability's `signoff-feed.ts`) already returns the closed tickets still
  waiting for production's answer: `{ ticketId, ref, machine, cell, closedAt, requestedAt, dueAt }`, page cap
  `SIGNOFF_FEED_MAX`, machines off the board left out, timed-out tickets dropped.
- The query behind it (`closedAwaitingSignoff` in `apps/server/src/modules/tickets/repo/signoff.ts`) returns
  **newest close first** and pages with a `(closed_at, id)` cursor.
- `SignoffPanel.tsx` already shows the turnaround both ways on the ticket (`signoff.turnaround`: "Maintenance
  took {{maintenance}} · you answered in {{production}}"). Nothing in the browser renders the feed.

## What this ticket adds

### 1. Server: the feed is oldest first

- `apps/server/src/modules/tickets/repo/signoff.ts`: `closedAwaitingSignoff` returns **oldest close first**
  (`ORDER BY t.closed_at ASC, t.id ASC`; the cursor predicate flips to `(t.closed_at, t.id) > ($4, $5)`), and
  its doc comment says "oldest close first (the longest wait at the top)".
- `signoff-feed.ts`: the page-collection comment stays true (it now walks forward from the oldest); keep
  `MAX_PAGES` and the same dropping rules, so the feed is still a page of live waiting tickets.
- No route change, no reply change, no migration.

### 2. Browser: the waiting feed, on the desk

- `apps/web/src/api.ts`: `getSignoffFeed(): Promise<SignoffFeed>` (a plain `getJson`-style helper like the
  other board reads; poll it every 30 s with `refetchInterval` as the board does).
- `apps/web/src/components/SignoffFeed.tsx` (new): a section for the desk Open screen.
  - Heading from the catalogue: "Waiting for production's OK" (`signoff.deskWaiting`, already exists) and the
    count when there is one, e.g. "Waiting for production's OK (3)".
  - One row per ticket, **oldest first as the server sends it**, each row a `Link` to `/desk/<id>` showing the
    ref, the machine code (or "Work request" when there is no machine), the cell, and how long it has waited
    (from `closedAt`/`requestedAt` to `now`, using the existing minute formatter); a timed-out row is never
    shown (the server already drops it).
  - Empty state: "Nothing is waiting for production." Four view states (loading, empty, error, ready) as the
    kit's `StateNotice`/`viewState` do.
  - read permissions are the server's: a 403 answers the same empty/neutral state the board uses; do not
    invent a second permission check.
- `apps/web/src/screens/desk/Board.tsx`: render `<SignoffFeed />` on the Open screen, after the counts strip and
  before the breakdown lists (a split breakdown with a fixed 360 px phone width in mind; kit pieces only).
- `apps/web/src/components/signoff-feed.ts` (new, pure) + `signoff-feed.test.ts`: `waitedMinutes(now, item)`
  and `feedRows(items, now, names)` ordering/formatting used by the component, so the oldest-first reading is
  unit-tested without a browser.
- Catalogues **both languages** (`packages/shared/src/i18n/signoff.en.ts` + `signoff.gu.ts`): the count line,
  the empty line, the row's "waiting {{time}}", "Work request", and any error line not already present.

## Tests — red first, then green

1. **Red (server):** `apps/server/test/signoff-board.test.ts` — a new
   `it('the waiting feed puts the longest wait first')`: two closed tickets waiting for sign-off, the older
   close listed first; a confirmed one is absent; a timed-out one is absent; the page cap holds. Change the
   existing ordering expectation (this is the ticket's behaviour change) and say so in the PR body; do not
   weaken any assertion.
2. **Red (web unit):** `apps/web/src/components/signoff-feed.test.ts` — oldest first from unsorted input, the
   waited minutes from the plant's clock, a ticket with no machine reads "Work request", the count line.
3. **Red (browser):** `apps/web/e2e/signoff-feed.spec.ts` — seed two waiting sign-offs (the older one first in
   the seeding), open `/desk`, see the section, assert the older ticket's ref appears before the newer one's,
   and clicking a row opens that ticket. One test, chromium and phone.

Green commands (run them and paste the output):

```bash
pnpm install --prefer-offline
pnpm exec vitest run apps/server/test/signoff-board.test.ts
pnpm exec vitest run apps/web/src/components/signoff-feed.test.ts
pnpm exec playwright test apps/web/e2e/signoff-feed.spec.ts --project=chromium
pnpm lint && pnpm typecheck && pnpm precheck
```

## Rails (do not break)

- Never delete, skip or weaken a test; the one changed assertion is the ticket's own ordering rule and gets a
  clearer expectation, not a weaker one.
- One writer on these files only; no file outside the list above. Do not touch
  `apps/web/src/components/Timeline.tsx`, `actionSpecs.ts` or the settings screens.
- Lean budgets: file ≤ 400 lines, function ≤ 60, no new dependency, no literal visible string (catalogue keys
  and `t()` only), tokens/kit components only; the screen file stays under 300 lines.
- No real names or phone numbers in tests or fixtures.
- Commit locally in small ordered commits. **Do not push, do not open a PR.**
- Report back: files changed, the red output, the green output of every command above, and anything the plan
  left silent (stop and ask instead of guessing).

## Addendum (Lead, same session) — binding

1. **Design reference (approved):** `docs/design/slices/slice-6-signoff.html` frames "Waiting for production's
   OK · light/dark" (rows show the ref, the machine, "Waiting 38 min" / "Waiting 1 h 14 min") and
   `docs/design/LOCK.md` § "Sign-off". Kit pieces only.
2. **Add one companion fix:** the desk **Team** tab's Waiting list must be oldest-wait first (sort by
   `waitSince` ascending like `openLists.ts:56-60`), not the server's newest-first order — file
   `apps/web/src/screens/desk/TeamPanel.tsx`, with an assertion next to the existing desk tests.
3. **Evidence for the PR:** save one committed screenshot (360×800) of the desk Open screen showing the
   waiting feed oldest first: `docs/slices/m2-34-side-by-side/waiting-feed.png`.
