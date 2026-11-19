import { describe, expect, it } from 'vitest';
import type { PmPlanForJob } from '@uptimo/shared/pm';
import {
  draftReadings,
  emptyDraft,
  isTicked,
  METER_KEY,
  planItems,
  pmCloseBody,
  pmReady,
  readingValue,
  setReading,
  setTicked,
  type PmDraft,
} from './pmDraft.js';

/** The journey's plan: three points and one measured reading, with a 500-unit meter (49c). */
const PLAN: PmPlanForJob = {
  id: 'b0000000-0000-0000-0000-000000000001',
  title: 'VC-17 preventive maintenance',
  machineId: 'a0000000-0000-0000-0000-000000000001',
  category: null,
  intervalDays: 182,
  meterInterval: 500,
  meterTolerance: 50,
  lastMeterReading: 1000,
  lastDoneOn: '2026-05-01',
  checklist: [
    { id: '1', kind: 'tick', point: 1 },
    { id: '2', kind: 'tick', point: 2 },
    { id: '3', kind: 'tick', point: 3 },
    { id: '4.bx', kind: 'reading', point: 4, metric: 'bx', label: 'Backlash X', unit: 'mm' },
  ],
  active: true,
};

const AT = new Date('2026-11-19T06:00:00Z');

describe('the PM close draft (49c)', () => {
  it('starts with every point ticked and nothing typed', () => {
    const draft = emptyDraft();
    expect(planItems(PLAN).ticks.map((item) => item.id)).toEqual(['1', '2', '3']);
    expect(planItems(PLAN).readings.map((item) => item.id)).toEqual(['4.bx']);
    expect(planItems(PLAN).meter).toBe(true);
    expect(draft).toEqual({ undone: [], readings: {}, comments: '' });
    expect(isTicked(draft, '2')).toBe(true);
  });

  it('unticks a point into undone and ticks it back out', () => {
    const off = setTicked(emptyDraft(), '2', false);
    expect(off.undone).toEqual(['2']);
    expect(isTicked(off, '2')).toBe(false);
    expect(setTicked(off, '2', true).undone).toEqual([]);
  });

  it('reads a typed box as a number, or nothing when blank or not a number', () => {
    expect(readingValue('0.01')).toBe(0.01);
    expect(readingValue(' 1200 ')).toBe(1200);
    expect(readingValue('')).toBeNull();
    expect(readingValue('abc')).toBeNull();
  });

  it('sends only the boxes with a number in them', () => {
    const draft = setReading(setReading(emptyDraft(), '4.bx', '0.01'), METER_KEY, '1200');
    expect(draftReadings(PLAN, draft)).toEqual({ '4.bx': 0.01, meter: 1200 });
    expect(draftReadings(PLAN, setReading(emptyDraft(), '4.bx', ''))).toEqual({});
  });

  it('needs a meter reading on a meter plan and a number in every typed box', () => {
    const blank = emptyDraft();
    expect(pmReady(PLAN, blank)).toBe(false);
    expect(pmReady(PLAN, blank, true)).toBe(false);
    const meter = setReading(blank, METER_KEY, '1200');
    expect(pmReady(PLAN, meter)).toBe(true);
    expect(pmReady(PLAN, setReading(meter, '4.bx', 'oops'))).toBe(false);
    expect(pmReady(PLAN, meter, true)).toBe(false);
    // A plan without a meter needs only the points ticked.
    expect(pmReady({ ...PLAN, meterInterval: null }, blank)).toBe(true);
  });

  it('builds the close body with the plan id and the server’s placeholders', () => {
    const draft: PmDraft = {
      undone: ['2'],
      readings: { '4.bx': '0.01', meter: '1200' },
      comments: '  Guard refitted  ',
    };
    expect(pmCloseBody(PLAN, draft, AT)).toEqual({
      kind: 'report',
      at: AT.toISOString(),
      report: {
        pmReport: {
          planId: PLAN.id,
          total: 0,
          undone: ['2'],
          readings: { '4.bx': 0.01, meter: 1200 },
          comments: 'Guard refitted',
          doneBy: null,
        },
      },
    });
  });

  it('closes a job whose plan is gone with a comment and no plan id', () => {
    const body = pmCloseBody(null, { ...emptyDraft(), comments: 'Plan missing' }, AT) as {
      report: { pmReport: Record<string, unknown> };
    };
    expect(pmReady(null, emptyDraft())).toBe(true);
    expect(body.report.pmReport).toEqual({
      total: 0,
      undone: [],
      readings: {},
      comments: 'Plan missing',
      doneBy: null,
    });
    expect(body.report.pmReport).not.toHaveProperty('planId');
  });
});
