# M2-31b — Acknowledge in the bar, escalation history and escalation state

Milestone M2 (Accountability), tickets 31 (goal 2, browser half) and 33 (goal 2). Frozen plan: one writer, the
files named below. Read `docs/LEAN.md`, `docs/TESTING.md`, `apps/web/src/components/Timeline.tsx`,
`apps/web/src/components/actionSpecs.ts`, `apps/server/src/modules/accountability/acks.ts` (the part is
`ack.ts`) and `packages/shared/src/ticket-reply.ts` before writing anything.

## What already exists (do not rebuild)

- The server already answers **whether this session may acknowledge this ticket**: the `canAcknowledge` ticket
  part (`apps/server/src/modules/accountability/ack.ts`, `loadCanAcknowledge`) is loaded into every ticket
  reply and every list row (`packages/shared/src/replies.ts` line ~77). The `acknowledge` command is
  `POST /api/v1/tickets/:id/acknowledge`.
- Every escalation step is already a `escalate` history event with a structured payload
  (`escalationStepSchema` in `packages/shared/src/ticket-reply.ts`): `ruleId, trigger, episode, level, attempt,
channel, channelFallback?, toldCount, noLadder?, toldPersonIds`. The server also gives the actor's pending
  escalation levels for the acknowledge-escalation action (`pendingLevels` in
  `apps/server/src/modules/tickets/mapper.ts`, domain `packages/domain/src/escalation.ts`).
- The browser shows none of it: no acknowledge slot in `actionSpecs.ts`, `Timeline.tsx` prints only
  `event.text`, the desk card (`apps/web/src/components/TicketCard.tsx`) has no escalation state, and no list
  row carries the escalation state at all.

## The contract (freeze it exactly)

### Server — the escalation state on every ticket reply

Add one ticket part in `apps/server/src/modules/accountability/` (new file `escalation-state.ts` + its repo
query next to `repo/escalation.ts`), contributed like the others in `index.ts`:

```ts
escalation: {
  pendingLevels: string[];   // levels whose chain has told someone and no acknowledge at that level or above covers it
  lastLevel: string | null;  // the newest `escalate` event's level, null when never escalated
  lastAt: string | null;     // that event's time (ISO), null when never escalated
}
```

- Computed from the ticket's `escalate` and `acknowledge` events by the **existing domain functions**
  (`pendingLevels(events)`; the ack event carries `payload.level`), never re-implemented in SQL logic.
- Loaded for a page of tickets with **one query** (`ticket_event WHERE type IN ('escalate','acknowledge') AND
ticket_id = ANY($2)`), so `/state` gains no N+1; `afterWrite` returns the fresh value like the `sla` part.
- `packages/shared/src/ticket-reply.ts` + `replies.ts`: the schema and the field on the shared ticket reply.

### Browser

- `apps/web/src/components/actionSpecs.ts`: `TicketAction` gains `'acknowledge'` (a presentation-only slot; the
  domain's `availableActions` does not offer it). `actionSpecs` puts it **first** when
  `ticket.canAcknowledge` is true and the actor has a person — it is the primary button. `Start` (or `Resume`)
  stays available beside it.
- `apps/web/src/components/ActionBar.tsx`: the acknowledge button and the start button sit in one two-column
  row (the existing `Grid columns={2}` branch — pair `acknowledge` with `start`/`resume` in `rowsOf`). It runs
  `onRun('acknowledge', {})`.
- `apps/web/src/components/escalation-history.ts` (new, pure) + `escalation-history.test.ts`:
  `escalationLines(events, names, t)` → one line per `escalate` event:
  - level and trigger ("L2 · no acknowledgement"),
  - who was told: names from `toldPersonIds` (via the `names` map), or the catalogue's "heads and admins" when
    `noLadder` is true and `toldPersonIds` is empty,
  - channel ("Push"; "Push (WhatsApp has no sender yet)" when `channelFallback` is set),
  - repeats: nothing on attempt 1, "repeat {{attempt}}" above it,
  - **acknowledgement speed**: the first later `acknowledge` event at that level or above →
    "acknowledged after {{minutes}} min"; the timer itself is not re-derived — minutes come from the two event
    times, using the existing `formatMinutes`/`formatTime` helpers, and a test fixes them;
  - when `noLadder` is true the line reads exactly **"Escalation due, nobody told"** (catalogue key
    `escalation.nobodyTold`).
- `apps/web/src/components/Timeline.tsx`: keeps its current rows; an `escalate` row shows its event text plus
  the escalation line from the helper (one extra detail, no second section).
- `apps/web/src/screens/TicketDetail.tsx`: under the SLA timers, the acknowledge facts: the newest
  `acknowledge` event → "Acknowledged by {{who}} · {{time}}" (catalogue key `sla.acknowledgedBy`), nothing
  when it never happened.
- `apps/web/src/components/TicketCard.tsx`: one extra line on the desk card from `ticket.escalation`:
  "Escalation · L2 waiting" when `pendingLevels` is not empty, "Escalation · L2 told" when it is empty but
  `lastLevel` is set, nothing when never escalated. Tone: `hold`/`danger` from the kit's `TONE_TEXT`.
- Catalogues **both languages**: `packages/shared/src/i18n/sla.en.ts` + `sla.gu.ts` (acknowledge facts and
  escalation lines) and `detail.en.ts` + `detail.gu.ts` where the history line belongs. Every key in both.
- `apps/web/src/api.ts` is generated from the shared schemas; do not hand-edit types — re-export from shared
  if needed.

## Tests — red first, then green

1. **Red (server):** in `apps/server/test/escalation.test.ts`:
   `it('a ticket reply carries the escalation state and clears it when the level is acknowledged')` — after a
   breached ack clock tells L2, `GET /api/v1/tickets/:id` and `GET /api/v1/state` both carry
   `escalation: { pendingLevels: ['L2'], lastLevel: 'L2', lastAt: <the step time> }`; after the rostered person
   acknowledges, `pendingLevels` is `[]` and the history shows the ack. A ticket never escalated has
   `{pendingLevels: [], lastLevel: null, lastAt: null}`. Assert the list row too (the no-N+1 requirement is
   met by construction; the test proves the field is on the list reply).
2. **Red (web unit):** `apps/web/src/components/actionSpecs.test.ts` — acknowledge is first and primary when
   `canAcknowledge` is true, start is second; nothing when false; `quickSpec` never offers acknowledge.
3. **Red (web unit):** `apps/web/src/components/escalation-history.test.ts` — the six cases above, including
   the exact "Escalation due, nobody told" line and the minutes of the acknowledgement speed.
4. **Red (browser):** `apps/web/e2e/escalation-history.spec.ts` — with the seeded roster (a person on duty for
   the running shift) and a rule, breach the ack clock so one L2 step is in the history; the desk card shows
   "Escalation · L2 waiting"; the on-duty person's ticket detail shows **Acknowledge** as the first button with
   **Start** beside it; an off-roster person sees neither as primary. Click Acknowledge → the button is gone and
   "Acknowledged by" shows. A second seeded ticket whose rule is switched off (no ladder) shows
   "Escalation due, nobody told". Keep to two tests, chromium and phone.

Green commands (run them and paste the output):

```bash
pnpm install --prefer-offline
pnpm exec vitest run apps/server/test/escalation.test.ts apps/server/test/acknowledge.test.ts
pnpm exec vitest run apps/web/src/components/actionSpecs.test.ts apps/web/src/components/escalation-history.test.ts
pnpm exec playwright test apps/web/e2e/escalation-history.spec.ts --project=chromium
pnpm lint && pnpm typecheck && pnpm precheck
```

## Rails (do not break)

- Never delete, skip or weaken a test. A new behaviour gets a new test.
- One writer on these files only; no file outside the list above. Do not touch `apps/web/src/screens/settings/`
  or `apps/server/src/modules/tickets/repo/signoff.ts`.
- Lean budgets: file ≤ 400 lines, function ≤ 60, no new dependency, no literal visible string (catalogue keys
  and `t()` only), tokens/kit components only.
- No real names or phone numbers in tests or fixtures.
- Commit locally in small ordered commits. **Do not push, do not open a PR.**
- Report back: files changed, the red output, the green output of every command above, and anything the plan
  left silent (stop and ask instead of guessing).

## Addendum (Lead, same session) — binding

1. **Design reference (approved):** `docs/design/slices/slice-8-escalation-roster-lockout.html` and
   `docs/design/slices/README.md` § "Slice 8" — frames "Acknowledge: on duty / acknowledged / not on duty",
   "History: escalated and acknowledged / repeats and levels / no ladder" (phone and desktop).
   `docs/design/LOCK.md` § "Slice 8" is the rule list ("the acknowledgement says who and how fast; a repeat is
   its own entry; no ladder reads 'Escalation due, nobody told' with 'Set the ladder' for head and admin").
2. **Correction — acknowledgement speed:** the chain acknowledgement is the **`acknowledge-escalation`**
   command, which appends an `escalation_ack` event carrying `payload.level`
   (`apps/server/src/modules/tickets/builders.ts:76-80`, read by `packages/domain/src/escalation.ts:118-165`).
   The ticket's `acknowledge` command is the ack-clock one (event type `acknowledge`, no level). So:
   - "acknowledged after N min" = the first later `escalation_ack` event whose level rank covers the step's
     level, naming that person and the minutes;
   - `pendingLevels` = the domain's `pendingEscalationLevels(events)`; `lastLevel`/`lastAt` from the newest
     `escalate` event;
   - `Timeline` labels both kinds (`timeline.escalate`, `timeline.escalationAck`, en+gu).
     Nothing of this is re-derived in SQL.
3. **Evidence for the PR:** save two committed screenshots (360×800):
   `docs/slices/m2-31-side-by-side/acknowledge.png` (Acknowledge first with Start beside it) and
   `docs/slices/m2-31-side-by-side/escalation-history.png`.
