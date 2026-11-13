import type { ImportedTicketRow } from '../tickets/index.js';
import type { RealEvent, RealTicket } from './bhavin-export.js';

type Seg = ImportedTicketRow['segments'][number];
type Ev = ImportedTicketRow['events'][number];
const ENDS = new Set(['pause', 'transfer', 'close', 'cancel', 'leave']);

/** The time a step took effect: a close is stamped with the ticket's own `closedAt`, the rest with the event row. */
function effectiveAt(x: RealTicket, e: RealEvent): string {
  return e.type === 'close' && x.closedAt ? x.closedAt : e.at;
}

/**
 * `segment` events are his work stretches: written when the stretch ends, with whole minutes. The stretch is
 * [end − minutes, end], and ends at the next real step (pause, transfer, close, cancel or leave).
 */
export function toSegments(x: RealTicket, personOf: (name: string) => string | null): Seg[] {
  const out: Seg[] = [];
  x.events.forEach((e, i) => {
    const person = personOf(e.by);
    if (e.type !== 'segment' || !person || !e.mins || e.text === 'correction') return;
    const next = x.events.slice(i + 1).find((n) => n.type !== 'segment');
    const end = new Date(next ? effectiveAt(x, next) : e.at);
    const role = e.text === 'primary' || e.text === 'support' ? e.text : 'lead';
    out.push({
      personId: person,
      role,
      startedAt: new Date(end.getTime() - e.mins * 60000),
      endedAt: end,
      endReason: next && ENDS.has(next.type) ? (next.type as Seg['endReason']) : null,
    });
  });
  const leadId = personOf(x.startedBy);
  if (x.status === 'working' && x.segStart && leadId) {
    out.push({
      personId: leadId,
      role: 'lead',
      startedAt: x.segStart,
      endedAt: null,
      endReason: null,
    });
  }
  for (const c of x.crew) {
    const id = personOf(c.name);
    if (x.status === 'working' && c.running && c.segStart && !c.left && id) {
      out.push({
        personId: id,
        role: c.role === 'support' ? 'support' : 'primary',
        startedAt: c.segStart,
        endedAt: null,
        endReason: null,
      });
    }
  }
  return out;
}

const VENDOR = /vendor/i;

type Payload = (e: RealEvent, x: RealTicket, previous: string) => Record<string, unknown>;
const role: Payload = (e) => ({ role: e.spare || null });
const note: Payload = (e) => ({ note: e.spare || null });
const clock: Payload = (e) => ({ at: e.eta });
const PAYLOAD: Record<string, Payload> = {
  pause: (e) => ({
    reason: e.spare,
    expectedBackAt: e.eta || null,
    isVendor: VENDOR.test(e.spare),
  }),
  resume: (e) => ({ waitedMin: e.mins }),
  transfer: (e) => ({ to: e.spare || null, toShift: null }),
  update: (e) => ({ spare: e.spare || null, expectedBackAt: e.eta || null }),
  join: role,
  leave: role,
  close: (_e, x) => ({ kind: x.closeKind }),
  cancel: (_e, _x, previous) => ({ previousStatus: previous }),
  running: clock,
  stopped: clock,
  restore: note,
  edit: note,
};

/** His events in his order and with his names (`lead` and `task` kept); `segment` rows become work segments. */
export function toEvents(x: RealTicket, personOf: (name: string) => string | null): Ev[] {
  let status = 'open';
  let beforeCancel = 'open';
  const events: Ev[] = [];
  for (const e of x.events) {
    if (e.type === 'segment') continue;
    const at = e.type === 'down' ? x.downAt : effectiveAt(x, e);
    events.push({
      type: e.type,
      at,
      actingPersonId: personOf(e.by),
      text: e.text || null,
      payload: (PAYLOAD[e.type] ?? (() => ({})))(e, x, status),
    });
    if (['start', 'pickup', 'resume'].includes(e.type)) status = 'working';
    else if (e.type === 'pause') status = 'waiting';
    else if (e.type === 'transfer') status = 'open';
    else if (e.type === 'cancel') [beforeCancel, status] = [status, 'cancelled'];
    else if (e.type === 'restore') status = beforeCancel;
  }
  return events;
}
