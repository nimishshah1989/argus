import type { TFunction } from 'i18next';
import { pmCalendarItemSchema, pmCalendarReplySchema, type PmCalendarReply } from '@uptimo/shared';
import { en } from '@uptimo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { mapPmPlans, PM_WORKBOOK_AS_OF } from '../../../../../server/src/seed/pm-plans.js';
import { PM_COMPLIANCE_EXPECTED } from '../../../../../../packages/domain/test/pm-compliance-expected.js';
import input from '../../../../../../fixtures/answer-key/input.json' with { type: 'json' };
import { ApiError } from '../../../data/index.js';
import { pmCalendarModel, REPLY_FIELDS, type PmCalendarInput } from './adapter.js';
import { createMover, MoveFailed, type SendMove } from './move.js';
import plans from './plans.json' with { type: 'json' };
import { COMPLIANCE, TODAY, calendarFor, standInSend } from './stand-in.js';

/** The catalogue's English with its `{{name}}` slots filled, so a test reads the words a reader would. */
const t = ((key: string, values: Record<string, unknown> = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(values[name] ?? ''),
  )) as unknown as TFunction;

const WIDE = { from: '2026-01-01', to: '2027-12-31' };
const GRID = { from: '2027-01-25', to: '2027-03-07' };
const ask = (over: Partial<PmCalendarInput> = {}, calendar: PmCalendarReply = calendarFor(GRID)) =>
  pmCalendarModel({ calendar, compliance: COMPLIANCE, asOf: TODAY, canMove: true, ...over }, t);

describe('the gallery PM calendar is the engine on the workbook', () => {
  it('holds the plans the seed makes from the 11 November workbook, one per machine', () => {
    const mapped = mapPmPlans(input as never, { asOf: PM_WORKBOOK_AS_OF }).plans;
    expect(plans).toEqual(
      mapped.map((p) => [p.machineId, p.intervalDays, p.lastDoneOn, p.anchorOn]),
    );
    expect(calendarFor(WIDE).items).toHaveLength(plans.length);
  });

  it('holds the compliance figure the engine proves by hand (50b)', () => {
    expect(COMPLIANCE).toEqual(PM_COMPLIANCE_EXPECTED.value);
  });
});

describe('every field of the calendar reply is shown, or kept for the write', () => {
  it('lists exactly the reply and item fields the schema has', () => {
    const listed = (group: { shown: readonly string[]; handle: readonly string[] }) =>
      [...group.shown, ...group.handle].sort();
    expect(listed(REPLY_FIELDS.reply)).toEqual(Object.keys(pmCalendarReplySchema.shape).sort());
    expect(listed(REPLY_FIELDS.item)).toEqual(Object.keys(pmCalendarItemSchema.shape).sort());
  });

  it('prints every item with each of its fields, ids kept only as handles', () => {
    const reply = calendarFor(GRID);
    const model = ask({}, reply);
    expect(model.jobs).toHaveLength(reply.items.length);
    reply.items.forEach((item, at) => {
      const job = model.jobs[at]!;
      expect(job.machine).toMatchObject({ kind: 'machine', id: item.machineCode });
      expect(job.title).toBe(item.title);
      expect([job.planned.iso, job.due.iso]).toEqual([item.scheduledOn, item.dueOn]);
      expect(job.tolerance.value).toBe(item.toleranceDays);
      expect([job.status, job.crowded, job.movable]).toEqual([
        item.status,
        item.crowded,
        item.movable,
      ]);
      expect(job.suggested?.iso ?? null).toBe(item.suggestedOn);
      expect(job.handle).toEqual({
        machineId: item.machineId,
        planId: item.planId,
        ticketId: item.ticketId,
      });
      expect(JSON.stringify([job.planned, job.due, job.tolerance, job.statusWord])).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-/,
      );
      expect(model.events[at]).toMatchObject({ code: item.machineCode, day: item.scheduledOn });
    });
    expect([model.range, model.today]).toEqual([{ from: reply.from, to: reply.to }, reply.today]);
  });

  it('prints dates as DD-MMM-YYYY and a tolerance as plus or minus days', () => {
    const job = ask().jobs[0]!;
    expect(job.planned.shown).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{4}$/);
    expect(job.tolerance.shown).toBe(`±${job.tolerance.value} days`);
  });
});

describe('the figures and how the jobs were judged', () => {
  it('opens the answer with both rates and the crowded jobs, from the engine', () => {
    const model = ask();
    const crowded = calendarFor(GRID).items.filter((i) => i.crowded).length;
    expect(crowded).toBeGreaterThan(0);
    expect(model.verdict.headline.map((s) => s.text).join('')).toBe(
      `PM compliance is 25.0 % and schedule compliance is 27.3 %. ${crowded} PM jobs share a day with another one.`,
    );
    expect(model.figures.map((f) => [f.label, f.value, f.sub])).toEqual([
      ['PM compliance', '25.0 %', '2 of 8 PM jobs on time'],
      ['Schedule compliance', '27.3 %', '3 of 11 planned jobs done by their week'],
      ['Crowded PM jobs', String(crowded), expect.stringContaining('days hold more than one PM')],
      ['PM jobs in view', String(model.jobs.length), 'At most 1 PM a day'],
    ]);
  });

  it('shows every count the compliance figure carries, not two of the twelve', () => {
    const [pm, schedule] = ask().judged;
    expect(pm!.counts.map((c) => c.text)).toEqual([
      'On time 2',
      'Early 1',
      'Late 2',
      'Overdue 2',
      'Cancelled 1',
      'Still inside tolerance 1',
    ]);
    expect(schedule!.counts.map((c) => c.text)).toEqual([
      'Done by their week 3',
      'Missed 8',
      'Still inside their week 0',
    ]);
    expect([pm!.rate, schedule!.rate]).toEqual(['25.0 %', '27.3 %']);
  });

  it('says so, with a dash and never 0 %, when nothing has been judged', () => {
    const zero = { ...COMPLIANCE, pm: { ...COMPLIANCE.pm, eligible: 0, pct: null } };
    const none = ask({
      compliance: { ...zero, schedule: { ...COMPLIANCE.schedule, eligible: 0, pct: null } },
    });
    expect(none.figures[0]!.value).toBe('—');
    expect(none.figures[0]!.sub).toBe('No PM work orders in this window.');
    expect(none.judged).toEqual([]);
  });

  it('says the figure is not computed when the engine sent none, and still draws the calendar', () => {
    const model = ask({ compliance: undefined });
    expect(model.figures[1]).toMatchObject({
      value: '—',
      sub: 'The compliance figure is not computed yet.',
    });
    expect(model.verdict.why[0]![0]!.text).toBe('The compliance figure is not computed yet.');
    expect(model.events.length).toBeGreaterThan(0);
  });
});

describe('the states of the calendar', () => {
  it('is a calm calendar, not an error, when no PM is due in the range', () => {
    const empty = { ...calendarFor(GRID), items: [] };
    const model = ask({}, empty);
    expect([model.jobs, model.events, model.spread, model.monthJobs]).toEqual([[], [], [], []]);
    expect(model.verdict.headline.map((s) => s.text).join('')).toContain(
      'No PM day is crowded in this view.',
    );
  });

  it('lists the crowded jobs apart, with the nearest free day the engine found', () => {
    const model = ask();
    expect(model.spread.length).toBeGreaterThan(0);
    expect(model.spread.every((j) => j.crowded)).toBe(true);
    const free = model.spread.find((j) => j.suggested)!;
    expect(free.suggested!.moveLabel).toMatch(/^Move to \d{2}-[A-Z][a-z]{2}-\d{4}$/);
  });

  it('lists the jobs of the month the grid shows, not the edge days of its neighbours', () => {
    const model = ask();
    expect(model.month).toBe('2027-02');
    expect(model.monthJobs.length).toBeGreaterThan(0);
    expect(model.monthJobs.every((j) => j.planned.iso.startsWith('2027-02'))).toBe(true);
    expect(model.jobs.length).toBeGreaterThan(model.monthJobs.length);
  });

  it('carries who may move a job: a head or an admin, nobody else', () => {
    expect(ask({ canMove: true }).canMove).toBe(true);
    expect(ask({ canMove: false }).canMove).toBe(false);
    expect(ask({ canMove: false }).calendarSub).not.toMatch(/Drag/);
  });

  it('has no money anywhere on it', () => {
    expect(JSON.stringify(ask())).not.toMatch(/₹|rupee|lakh|crore/i);
  });
});

describe('the move, as the drag and the keyboard both send it', () => {
  const model = ask();
  const words = model.words.move;
  const job = model.monthJobs[0]!;
  const request = { ...job.handle, machineCode: job.machine.label, scheduledOn: '2027-02-10' };
  const landed = {
    ticketId: job.handle.machineId,
    ref: 'PM-1',
    scheduledOn: '2027-02-10',
    created: true,
  };

  it('writes only the ids and the day, and says where the job landed', async () => {
    const sent: unknown[] = [];
    const send: SendMove = (body) => (sent.push(body), Promise.resolve(landed));
    const line = await createMover(send, words)(request);
    expect(sent).toEqual([
      {
        machineId: job.handle.machineId,
        planId: job.handle.planId,
        ticketId: job.handle.ticketId,
        scheduledOn: '2027-02-10',
      },
    ]);
    expect(line).toBe(`${job.machine.label} moved to 10-Feb-2027.`);
  });

  it('puts the server’s refusal in its own words and starts a fresh attempt after it', async () => {
    const keys: string[] = [];
    const send: SendMove = (_, key) => (
      keys.push(key),
      Promise.reject(new ApiError('validation', 'PM jobs are scheduled Monday to Saturday'))
    );
    const move = createMover(send, words);
    const failure = await move(request).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(MoveFailed);
    expect(failure).toMatchObject({
      message: 'PM jobs are scheduled Monday to Saturday',
      retry: false,
    });
    await move(request).catch(() => undefined);
    expect(new Set(keys).size).toBe(2);
  });

  it('says it is not saved when the connection is down, and retries as the same single write', async () => {
    const keys: string[] = [];
    let down = true;
    const send: SendMove = (_, key) => {
      keys.push(key);
      return down ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve(landed);
    };
    const move = createMover(send, words);
    const failure = await move(request).catch((e: unknown) => e);
    expect(failure).toMatchObject({ message: words.offline, retry: true });
    down = false;
    await move(request);
    expect(keys[1]).toBe(keys[0]);
  });
});

describe('the gallery write refuses what the server refuses and lands what it accepts', () => {
  const free = (day: string) => calendarFor(WIDE).items.every((i) => i.scheduledOn !== day);
  const item = calendarFor(WIDE).items.find((i) => i.machineCode === 'VC-13')!;
  const body = (scheduledOn: string) => ({
    machineId: item.machineId,
    planId: item.planId,
    ticketId: null,
    scheduledOn,
  });

  it.each([
    ['a Sunday', '2026-11-15', 'PM jobs are scheduled Monday to Saturday'],
    ['the past', '2026-11-10', 'A PM job cannot be scheduled in the past'],
    ['a day outside the tolerance', '2027-06-01', 'That date is outside the plan tolerance'],
    ['a day that holds a PM', '2026-11-14', 'That day already has a PM job'],
  ])('refuses %s', async (_, day, message) => {
    await expect(standInSend(body(day), 'k')).rejects.toMatchObject({ message });
  });

  it('lands a move on a free working day and the calendar then holds it as an open job', async () => {
    expect(free('2026-11-18')).toBe(true);
    const reply = await standInSend(body('2026-11-18'), 'k');
    expect(reply).toMatchObject({ scheduledOn: '2026-11-18', created: true });
    const moved = calendarFor(WIDE).items.find((i) => i.machineCode === 'VC-13')!;
    expect([moved.scheduledOn, moved.status]).toEqual(['2026-11-18', 'open']);
  });
});
