import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { figures, type FigureInput, type TicketEvent } from '@uptimo/domain';
import { parseBhavinExport, type RealTicket } from '../src/modules/imports/bhavin-export.js';
import { checkTicketFigures } from '../src/modules/imports/real-oracle.js';
import { toSegments } from '../src/modules/imports/real-events.js';

const FILE = new URL('./fixtures/bhavin-export.pseudonymised.json', import.meta.url);
const exported = parseBhavinExport(JSON.parse(readFileSync(FILE, 'utf8')) as unknown);

const at = (iso: string) => new Date(iso);
const MIN = 60000;

/** What a ticket raised on Uptimo would hold if its events carried the times his steps carry. */
function asFigureInput(x: RealTicket): FigureInput {
  const events: TicketEvent[] = [];
  let pausedAt: Date | null = null;
  let started = false;
  for (const e of x.events) {
    if (e.type === 'segment' || e.type === 'down' || e.type === 'edit') continue;
    let when = at(e.at);
    if (e.type === 'running' || e.type === 'stopped') when = at(e.eta);
    if (e.type === 'close' && x.closedAt) when = at(x.closedAt);
    if (e.type === 'start' && !started && x.startedAt) when = at(x.startedAt);
    if (e.type === 'start') started = true;
    if (e.type === 'pause') pausedAt = when;
    // he stores the minutes waited on the resume row; our events carry the time itself
    if (e.type === 'resume' && pausedAt) when = new Date(pausedAt.getTime() + (e.mins ?? 0) * MIN);
    events.push({
      type: e.type as TicketEvent['type'],
      at: when,
      isVendor: /vendor/i.test(e.spare),
    });
  }
  // a few of his rows carry no events at all; the start is on the ticket itself
  if (x.startedAt && !events.some((e) => e.type === 'start'))
    events.unshift({ type: 'start', at: at(x.startedAt) });
  const edit = (what: string) =>
    checkTicketFigures(x).find((c) => c.figure === what && c.verdict === 'edit')?.oracle;
  return {
    reportedAt: at(x.downAt),
    kind: x.kind,
    selfStarted: x.selfStarted,
    events,
    segments: toSegments(x, (name) => name || null).map((s) => ({
      personId: s.personId,
      role: s.role,
      startedAt: new Date(s.startedAt as Date),
      endedAt: s.endedAt ? new Date(s.endedAt) : undefined,
    })),
    overrides: {
      ...(edit('activeMin') != null ? { handsOnOverrideMin: edit('activeMin') as number } : {}),
      ...(edit('waitMin') != null ? { waitingOverrideMin: edit('waitMin') as number } : {}),
    },
    now: at(x.closedAt ?? x.eta ?? x.downAt),
    closedAt: x.status === 'closed' && x.closedAt ? at(x.closedAt) : undefined,
  };
}

/**
 * A ticket that was cancelled and restored does not count the cancelled time (Nimish's ruling, 14 Nov 2026); his app does.
 * These are the only differences from `worker.js` in his export, each caused by that ruling.
 */
const CANCELLED_TIME_RULING: Record<string, string> = {
  'BD-0077 handoverWaitMin: his 263, ours 11':
    'cancelled 09:48, restored 14:00: 252 minutes not counted',
  'BD-0077 downtimeMin: his 366, ours 114': 'the same 252 cancelled minutes',
};

const FIGURES = {
  responseMin: 'responseMin',
  activeMin: 'activeMin',
  waitMin: 'waitMin',
  vendorMin: 'vendorMin',
  handoverWaitMin: 'handoverWaitMin',
  downAcc: 'downAccMin',
  repairMin: 'repairMin',
  followMin: 'followMin',
  downtimeMin: 'downtimeMin',
} as const;

describe('a new ticket gets the minutes his worker.js gives', () => {
  it('matches the repair, waiting, vendor and downtime minutes of every ticket in his export', () => {
    const wrong: string[] = [];
    let compared = 0;
    for (const ticket of exported.tickets) {
      const got = figures(asFigureInput(ticket)) as unknown as Record<string, number | null>;
      for (const check of checkTicketFigures(ticket)) {
        compared += 1;
        const key = FIGURES[check.figure as keyof typeof FIGURES];
        const his = check.oracle ?? (key === 'repairMin' ? 0 : null); // never started: his null, our 0
        if (got[key] !== his)
          wrong.push(`${check.ref} ${check.figure}: his ${his}, ours ${got[key]}`);
      }
    }
    expect(compared).toBeGreaterThan(2000);
    const explained = Object.keys(CANCELLED_TIME_RULING);
    expect(wrong.filter((line) => !explained.includes(line))).toEqual([]);
    expect(explained.filter((line) => !wrong.includes(line))).toEqual([]); // a ruling entry that no longer differs is stale
  });
});
