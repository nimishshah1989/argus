import { describe, expect, it } from 'vitest';
import type { Config, Ticket } from '../api.js';
import {
  buildReportBody,
  categoryOptions,
  initialReportValues,
  reportReady,
  type ReportValues,
} from './reportFields.js';

const LEAD = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

function values(patch: Partial<ReportValues> = {}): ReportValues {
  return {
    problem: 'Alarm on screen',
    observedBy: '',
    correctiveAction: '',
    doneBy: [LEAD, '', ''],
    supportedBy: '',
    downtimeMin: '76',
    responseMin: '12',
    repairMin: '46',
    breakdownCategory: 'E',
    maintCode: 'M1',
    spareUsed: '',
    handoverName: '',
    date: '2026-11-14',
    shiftCode: '1',
    ...patch,
  };
}

describe('reportReady', () => {
  it('needs the category and the maintenance code', () => {
    expect(reportReady(values())).toBe(true);
    expect(reportReady(values({ breakdownCategory: '' }))).toBe(false);
    expect(reportReady(values({ maintCode: ' ' }))).toBe(false);
  });

  it('needs the problem and the first Done By', () => {
    expect(reportReady(values({ problem: '  ' }))).toBe(false);
    expect(reportReady(values({ doneBy: ['', OTHER, ''] }))).toBe(false);
  });
});

describe('buildReportBody', () => {
  it('sends each person once and leaves empty boxes out', () => {
    const body = buildReportBody(values({ doneBy: [LEAD, OTHER, LEAD], supportedBy: OTHER }));
    expect(body.doneByPersonIds).toEqual([LEAD, OTHER]);
    expect(body.supportedByPersonIds).toEqual([OTHER]);
    expect(buildReportBody(values()).supportedByPersonIds).toBeUndefined();
  });

  it('sends the minutes as whole numbers', () => {
    expect(buildReportBody(values({ downtimeMin: '75.6' })).downtimeMin).toBe(76);
  });
});

const shifts = [
  { code: 'A', name: 'A', starts_at: '06:00', ends_at: '14:00', crosses_midnight: false },
  { code: 'B', name: 'B', starts_at: '14:00', ends_at: '22:00', crosses_midnight: false },
  { code: 'C', name: 'C', starts_at: '22:00', ends_at: '06:00', crosses_midnight: true },
];

function config(lists: Config['lists'] = {}): Config {
  return { timeZone: 'Asia/Kolkata', shifts, lists } as unknown as Config;
}

const ticket = { problem: 'Alarm', leadPersonId: LEAD } as unknown as Ticket;

describe('initialReportValues date and shift', () => {
  it('come from the chosen finish in the plant time zone', () => {
    // 18:40 UTC is 00:10 the next day in India: a new date, and the night shift.
    const v = initialReportValues(ticket, config(), undefined, new Date('2026-11-14T18:40:00Z'));
    expect(v.date).toBe('2026-11-15');
    expect(v.shiftCode).toBe('C');
    const earlier = initialReportValues(
      ticket,
      config(),
      undefined,
      new Date('2026-11-14T09:00:00Z'),
    );
    expect(earlier.date).toBe('2026-11-14');
    expect(earlier.shiftCode).toBe('B');
  });
});

describe('categoryOptions', () => {
  it('uses the plant list, keeping only codes the server accepts', () => {
    const list = ['E', 'M', 'Z'].map((code) => ({ code, label: `L ${code}`, active: true }));
    expect(categoryOptions(config({ breakdown_category: list }))).toEqual([
      { value: 'E', label: 'L E' },
      { value: 'M', label: 'L M' },
    ]);
  });

  it('falls back to the fixed four when the plant has no list', () => {
    expect(categoryOptions(config()).map((o) => o.value)).toEqual(['E', 'M', 'E/M', 'PM']);
  });
});
