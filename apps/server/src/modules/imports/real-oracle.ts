import type { RealEvent, RealTicket } from './bhavin-export.js';

/**
 * The arithmetic of Bhavin's `worker.js` (every elapsed time is `Math.round` of whole minutes), recomputed from a
 * ticket's own events. It is the proof that the numbers kept on an imported ticket are his, not a guess:
 * - `equal`: the oracle reproduces the stored number from the events alone;
 * - `edit`: an `/api/edit` line changed that quantity, the oracle applies the line and then agrees;
 * - `rule`: the worker's rule for support downtime changed on 6 Nov (v10.x); older tickets hold hands-on minutes;
 * - `timing`: a stretch is within a second of a half minute, and `worker.js` stamps the state and the event row with
 *   two different clock reads, so the rounding can fall either way;
 * - `unexplained`: anything else (the import fails on it).
 */

export type Verdict = 'equal' | 'edit' | 'rule' | 'timing' | 'unexplained';
export interface FigureCheck {
  ref: string;
  figure: string;
  stored: number | null;
  oracle: number | null;
  verdict: Verdict;
  /** The edit line, rule or timing note that explains a difference. */
  detail?: string;
}

/** Support tickets closed before this hold hands-on minutes as downtime; later ones hold 0 (data: 23 vs 11, no overlap). */
export const SUPPORT_RULE_CHANGE = '2026-11-06T00:00:00.000Z';

const ms = (iso: string): number => Date.parse(iso);
const raw = (from: string, to: string): number => (ms(to) - ms(from)) / 60000;
const mins = (from: string, to: string): number => Math.max(0, Math.round(raw(from, to)));
const nearHalf = (from: string, to: string): boolean =>
  Math.abs((raw(from, to) % 1) - 0.5) * 60 < 1;
const VENDOR = /vendor/i;

interface EditLine {
  what: string;
  to: number | null;
  line: string;
}

/** What `/api/edit` wrote, by quantity: `reported @A > @B`, `started`, `closed`, `work X > Y min`, `waiting X > Y min`. */
function editLines(events: RealEvent[]): EditLine[] {
  return events
    .filter((e) => e.type === 'edit')
    .flatMap((e) =>
      e.spare.split('; ').map((part) => {
        const what = /^(reported|started|closed|work|waiting)\b/.exec(part)?.[1] ?? 'other';
        const to = /> (\d+) min$/.exec(part)?.[1];
        return { what, to: to === undefined ? null : Number(to), line: `${e.at} ${part}` };
      }),
    );
}

interface Walked {
  active: number;
  wait: number;
  vendor: number;
  handover: number;
  handoverNearHalf: boolean;
  downAcc: number;
  stopPoint: string;
}

interface Open {
  paused: { at: string; vendor: boolean } | null;
  transferAt: string | null;
}

function closeHandover(w: Walked, o: Open, to: string): void {
  if (o.transferAt === null) return;
  w.handover += mins(o.transferAt, to);
  w.handoverNearHalf ||= nearHalf(o.transferAt, to);
  o.transferAt = null;
}

function closeWait(w: Walked, o: Open, waited: (p: { at: string }) => number): void {
  if (!o.paused) return;
  const minutes = waited(o.paused);
  w.wait += minutes;
  if (o.paused.vendor) w.vendor += minutes;
  o.paused = null;
}

/** One step of his log, applied the way `worker.js` applied it. */
function step(x: RealTicket, w: Walked, o: Open, e: RealEvent): void {
  if (e.type === 'segment' && e.text === '') w.active += e.mins ?? 0;
  if (e.type === 'pause') o.paused = { at: e.at, vendor: VENDOR.test(e.spare) };
  if (e.type === 'resume') closeWait(w, o, () => e.mins ?? 0);
  if (e.type === 'transfer') o.transferAt = e.at;
  if (e.type === 'pickup') closeHandover(w, o, e.at);
  if (e.type === 'running') w.downAcc += mins(w.stopPoint, e.eta);
  if (e.type === 'stopped') w.stopPoint = e.eta;
  if (e.type === 'close' && x.closedAt) {
    const closedAt = x.closedAt;
    closeWait(w, o, (p) => mins(p.at, closedAt));
    closeHandover(w, o, closedAt);
  }
}

function walk(x: RealTicket): Walked {
  const w: Walked = {
    active: 0,
    wait: 0,
    vendor: 0,
    handover: 0,
    handoverNearHalf: false,
    downAcc: 0,
    stopPoint: x.downAt,
  };
  const open: Open = { paused: null, transferAt: null };
  for (const e of x.events) step(x, w, open, e);
  for (const line of editLines(x.events)) {
    if (line.what === 'work' && line.to !== null) w.active = line.to;
    if (line.what === 'waiting' && line.to !== null) w.wait = line.to;
  }
  return w;
}

function downtimeAtClose(x: RealTicket, w: Walked, closedAt: string): number {
  if (x.kind === 'support') return 0;
  if (x.kind === 'general') return w.active;
  return w.downAcc + (x.runningAt !== null ? 0 : mins(w.stopPoint, closedAt));
}

/** The figures `worker.js` holds for this ticket; null means "not computed at this status". */
function oracleFigures(x: RealTicket, w: Walked): Record<string, number | null> {
  const closedAt = x.status === 'closed' ? x.closedAt : null;
  const running = x.runningAt;
  return {
    responseMin: x.selfStarted || !x.startedAt ? null : mins(x.downAt, x.startedAt),
    activeMin: w.active,
    waitMin: w.wait,
    vendorMin: w.vendor,
    handoverWaitMin: w.handover,
    downAcc: w.downAcc,
    repairMin: closedAt === null || !x.startedAt ? null : mins(x.startedAt, running ?? closedAt),
    followMin: closedAt !== null && running !== null ? mins(running, closedAt) : null,
    downtimeMin: closedAt === null ? null : downtimeAtClose(x, w, closedAt),
  };
}

const EDIT_WORDS: Record<string, string[]> = {
  responseMin: ['reported', 'started'],
  repairMin: ['started', 'closed'],
  downtimeMin: ['reported', 'closed', 'work'],
  activeMin: ['work'],
  waitMin: ['waiting'],
  vendorMin: ['waiting'],
  followMin: ['closed'],
};
const CLOSED_ONLY = new Set(['repairMin', 'followMin', 'downtimeMin']);

interface Case {
  x: RealTicket;
  w: Walked;
  figure: string;
  oracle: number | null;
  stored: number | null;
}

function explain({ x, w, figure, oracle, stored }: Case) {
  if (
    figure === 'downtimeMin' &&
    x.kind === 'support' &&
    (x.closedAt as string) < SUPPORT_RULE_CHANGE &&
    stored === w.active
  ) {
    return {
      verdict: 'rule' as const,
      detail: 'support downtime held hands-on minutes before 6 Nov',
    };
  }
  const off = oracle !== null && stored !== null && Math.abs(oracle - stored) === 1;
  if (figure === 'handoverWaitMin' && w.handoverNearHalf && off) {
    return {
      verdict: 'timing' as const,
      detail: 'a handover stretch is within a second of a half minute',
    };
  }
  return null;
}

export function checkTicketFigures(x: RealTicket): FigureCheck[] {
  const w = walk(x);
  const edits = editLines(x.events);
  const checks: FigureCheck[] = [];
  for (const [figure, oracle] of Object.entries(oracleFigures(x, w))) {
    if (x.status !== 'closed' && CLOSED_ONLY.has(figure)) continue;
    const stored = (x as unknown as Record<string, number | null>)[figure] ?? null;
    const base = { ref: x.ref, figure, stored, oracle };
    const edit = edits.find((e) => (EDIT_WORDS[figure] ?? []).includes(e.what));
    if (stored === oracle) {
      checks.push(
        edit ? { ...base, verdict: 'edit', detail: edit.line } : { ...base, verdict: 'equal' },
      );
    } else {
      const why = explain({ x, w, figure, oracle, stored });
      checks.push(why ? { ...base, ...why } : { ...base, verdict: 'unexplained' });
    }
  }
  return checks;
}
