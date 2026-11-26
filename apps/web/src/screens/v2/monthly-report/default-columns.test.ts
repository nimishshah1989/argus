// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { keyReply } from '../printed-page/key-reply.js';
import { answerKey, realT } from '../printed-page/test-support.js';
import { FIGURE, monthlyReportModel, sectionOf } from './adapter.js';
import { defaultTable } from './columns.js';

/**
 * S23 Monthly Report, late-review follow-up (ticket 763, findings 1, 2, 4, 5). Expected columns and orders are read off
 * the approved wireframe (design/wireframes/S23-monthly-report.html) and the frozen answer key, never recomputed here.
 */
const reply = answerKey('monthly-report', FIGURE, 42);
const model = () => monthlyReportModel(reply, realT)!;
const AGAINST = 'Against September';

const opened = (id: string) => {
  const table = model().tables.find((t) => sectionOf(t.title, t.header[0]?.label) === id);
  if (!table) throw new Error(`no ${id} table`);
  return defaultTable(id, table, AGAINST);
};
const heads = (id: string) => opened(id).header.map((h) => h.label);
const column = (id: string, label: string) => {
  const table = opened(id);
  const at = table.header.findIndex((h) => h.label === label);
  return table.rows.map((row) => row[at]?.text ?? '');
};
const hours = (id: string) => column(id, 'Hours').map(Number);

describe('S23 Monthly Report: each section opens on the wireframe’s default columns', () => {
  it('the four rankings show name, Hours, the change against the month before and Breakdowns', () => {
    expect(heads('machine')).toEqual(['Machine', 'Hours', AGAINST, 'Breakdowns']);
    expect(heads('cell')).toEqual(['Cell', 'Hours', AGAINST, 'Breakdowns']);
    expect(heads('category')).toEqual(['Category', 'Hours', AGAINST, 'Breakdowns']);
    expect(heads('code')).toEqual(['Code', 'Hours', AGAINST, 'Breakdowns']);
  });

  it('the longest breakdowns show Hours, the measure their takeaway quotes, and leave "Done by" to open in place', () => {
    expect(heads('longest')).toEqual(['Date', 'Machine', 'Problem', 'Hours']);
    expect(column('longest', 'Hours')[0]).toBe('16.0');
  });

  it('the team shows name, breakdowns attended, Hours and average repair', () => {
    expect(heads('team')).toEqual(['Name', 'Breakdowns attended', 'Hours', 'Avg repair (hrs)']);
  });

  it('the machines added show the fleet at start and end and the change against the month before', () => {
    expect(heads('added')).toEqual([
      'Category',
      'Fleet at start',
      'Added this period',
      AGAINST,
      'Fleet at end',
    ]);
    expect(column('added', AGAINST)[0]).toBe('▲ +3');
  });

  it('keeps every row (the View collapses the tail)', () => {
    for (const id of ['machine', 'cell', 'category', 'code', 'longest', 'team', 'added'])
      expect(opened(id).rows.length, id).toBeGreaterThan(4);
    expect(opened('added').rows).toHaveLength(15);
    expect(opened('team').rows).toHaveLength(13);
  });
});

describe('S23 Monthly Report: every table worst first', () => {
  it('ranks the rankings and the longest breakdowns by hours, most first', () => {
    for (const id of ['machine', 'cell', 'category', 'code', 'longest']) {
      const values = hours(id);
      expect(values, id).toEqual([...values].sort((a, b) => b - a));
    }
  });

  it('ranks the machines added by "Added this period", ties in the engine’s order, the Total row last', () => {
    const names = column('added', 'Category');
    expect(names.slice(0, 4)).toEqual([
      'Turning Center',
      'Vertical Machining Center',
      'Vertical Turning Lathe',
      'Turnmill',
    ]);
    expect(names.at(-1)).toBe('Total CNC machines');
  });

  it('ranks the team by average repair, slowest first (as the wireframe draws it)', () => {
    expect(column('team', 'Name').slice(0, 3)).toEqual(['Person 49', 'Person 53', 'Person 02']);
    expect(column('team', 'Name').at(-1)).toBe('Person 55');
  });
});

describe('S23 Monthly Report: ranking takeaways', () => {
  it('knows the month before, for the "Against September" heading', () => {
    expect(model().previous).toBe('September');
  });

  it('prints the change with its unit', () => {
    expect(model().takeaways.machine?.text).toContain('▲ 18.0 h');
  });

  it('drops the comparison when there is no change to compare (the engine prints "—")', () => {
    const value = structuredClone(reply.figures[0]!.value) as {
      pages: { tables: { title: string; header: string[]; rows: string[][] }[] }[];
    };
    const machines = value.pages[0]!.tables.find((t) => t.header[0] === 'Machine')!;
    machines.rows[0]![3] = '—';
    machines.rows[0]![4] = '—';
    const text =
      monthlyReportModel(keyReply(FIGURE, 42, value as never), realT)!.takeaways.machine?.text ??
      '';
    expect(text).toContain('VC-16 CVM1160');
    expect(text).toContain('25.9 h');
    expect(text).not.toContain('—');
    expect(text).not.toContain('September');
  });
});
