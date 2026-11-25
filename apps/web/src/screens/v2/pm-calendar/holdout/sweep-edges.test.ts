import type { TFunction } from 'i18next';
import { en } from '@uptimo/shared/i18n';
import { describe, expect, it } from 'vitest';
import type { PmJob } from '../model.js';
import { pmSheets } from '../sweep.js';
import { pmCalendarWords } from '../words.js';

/** Sweep #706 (#690), batch D, hidden: the PM sheets at the edges. */

const t = ((key: string, values: Record<string, unknown> = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(values[name] ?? ''),
  )) as unknown as TFunction;
const words = pmCalendarWords(t, { jobs: 0, spread: 0 });
const day = (shown: string, value: number) => ({ iso: '', shown, value });
const job = (code: string, planned: number, over: Partial<PmJob> = {}): PmJob => ({
  id: code,
  machine: { kind: 'machine', id: code, label: code },
  title: `PM ${code}`,
  planned: day(`0${planned}-Feb-2027`, planned),
  due: day('09-Feb-2027', 9),
  tolerance: { shown: '±0 days', value: 0 },
  status: 'planned',
  statusWord: 'Planned',
  crowded: true,
  movable: false,
  suggested: null,
  moveAria: '',
  handle: { machineId: code, planId: null, ticketId: null },
  ...over,
});

describe('pmSheets at the edges', () => {
  it('with no jobs: no spread sheet, and the jobs sheet holds its header only', () => {
    expect(pmSheets({ spread: [], monthJobs: [], words })).toEqual([
      {
        name: 'Jobs this month',
        rows: [['Machine', 'Job', 'Planned for', 'Due on', 'Tolerance', 'State']],
      },
    ]);
  });

  it('says a crowded job with no free day in the words the page prints', () => {
    const [spread] = pmSheets({ spread: [job('A', 2)], monthJobs: [job('A', 2)], words });
    expect(spread!.rows[1]).toEqual(['A', '02-Feb-2027', 'No free day inside its tolerance.']);
  });

  it('orders by planned day, ties keeping their order, and writes a zero tolerance as 0', () => {
    const jobs = [job('B', 3), job('A', 1), job('C', 3)];
    const sheets = pmSheets({ spread: jobs, monthJobs: jobs, words });
    expect(sheets[0]!.rows.slice(1).map((r) => r[0])).toEqual(['A', 'B', 'C']);
    expect(sheets[1]!.rows.slice(1).map((r) => [r[0], r[4]])).toEqual([
      ['A', 0],
      ['B', 0],
      ['C', 0],
    ]);
  });
});
