import type { TFunction } from 'i18next';
import { en } from '@uptimo/shared/i18n';
import { describe, expect, it } from 'vitest';
import type { PmJob } from './model.js';
import { pmSheets } from './sweep.js';
import { pmCalendarWords } from './words.js';

/** Sweep #706 (#690), batch D: the PM calendar's two tables as Excel sheets, as shown. */

const t = ((key: string, values: Record<string, unknown> = {}) =>
  ((en as Record<string, string>)[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(values[name] ?? ''),
  )) as unknown as TFunction;
const words = pmCalendarWords(t, { jobs: 2, spread: 1 });

const day = (iso: string, shown: string, value: number) => ({ iso, shown, value });
const job = (over: Partial<PmJob> & { code: string }): PmJob => ({
  id: over.code,
  machine: { kind: 'machine', id: over.code, label: over.code },
  title: `PM ${over.code}`,
  planned: day('2027-02-03', '03-Feb-2027', 3),
  due: day('2027-02-05', '05-Feb-2027', 5),
  tolerance: { shown: '±3 days', value: 3 },
  status: 'planned',
  statusWord: 'Planned',
  crowded: false,
  movable: true,
  suggested: null,
  moveAria: '',
  handle: { machineId: over.code, planId: null, ticketId: null },
  ...over,
});

describe('pmSheets', () => {
  it('writes the crowded days, then every job of the month, each header first', () => {
    const crowded = job({
      code: 'VC-28',
      crowded: true,
      suggested: { ...day('2027-02-04', '04-Feb-2027', 4), moveLabel: 'Move', text: 'x' },
    });
    const calm = job({
      code: 'TC-5',
      planned: day('2027-02-01', '01-Feb-2027', 1),
      status: 'open',
      statusWord: 'Open job',
    });
    const sheets = pmSheets({ spread: [crowded], monthJobs: [crowded, calm], words });
    expect(sheets).toEqual([
      {
        name: 'Spread the load',
        rows: [
          ['Machine', 'Planned for', 'Nearest free day'],
          ['VC-28', '03-Feb-2027', '04-Feb-2027'],
        ],
      },
      {
        name: 'Jobs this month',
        rows: [
          ['Machine', 'Job', 'Planned for', 'Due on', 'Tolerance', 'State'],
          ['TC-5', 'PM TC-5', '01-Feb-2027', '05-Feb-2027', 3, 'Open job'],
          ['VC-28', 'PM VC-28', '03-Feb-2027', '05-Feb-2027', 3, 'Planned · Crowded day'],
        ],
      },
    ]);
  });
});
