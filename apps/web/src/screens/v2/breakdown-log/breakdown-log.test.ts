import { describe, expect, it } from 'vitest';
import { realT, testT } from '../printed-page/test-support.js';
import { everyMatchOf, logFromFigures, printedLog } from './live.js';
import { EMPTY_QUERY, type LogQuery } from './model.js';
import { workbookLog } from './source.js';

const LOG = printedLog(workbookLog, testT)!;
const ask = (query: Partial<LogQuery> = {}) =>
  logFromFigures(workbookLog, { ...EMPTY_QUERY, ...query }, testT)!;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayOf = (shown: string) => {
  const [d, m, y] = shown.split('-');
  return Number(`${y}${String(MONTHS.indexOf(m!) + 1).padStart(2, '0')}${d}`);
};

describe('the Breakdown Log pages on the server and never holds more than one page', () => {
  it('answers with ten entries and the count of the whole log', () => {
    const model = ask();
    expect(model.rows).toHaveLength(10);
    expect(model.matching).toBe(LOG.rows.length);
    expect(model.count).toBe(LOG.rows.length);
    expect(model.rows[0]!.srNo).toBe(LOG.rows[0]![1]);
  });

  it('moves to the next page in the engine order, newest first', () => {
    const second = ask({ page: 2 });
    expect(second.rows.map((r) => r.srNo)).toEqual(LOG.rows.slice(10, 20).map((r) => r[1]));
  });

  it('keeps the count of the whole log when a filter narrows it, and offers only printed values', () => {
    const machine = ask().options.machine.find((m) => m.startsWith('VC-'))!;
    const model = ask({ filters: { ...EMPTY_QUERY.filters, machine } });
    expect(model.matching).toBe(LOG.rows.filter((r) => r[5] === machine).length);
    expect(model.count).toBe(LOG.rows.length);
    expect(model.rows.every((r) => r.machine.label === machine)).toBe(true);
    expect(model.options.machine).toContain(machine);
    expect(model.options.shift.length).toBeGreaterThan(0);
  });

  it('sorts the whole log by hours and puts the dash last whichever way', () => {
    const lastPage = Math.ceil(LOG.rows.length / 10);
    for (const dir of ['asc', 'desc'] as const) {
      const sort = { key: 'hours' as const, dir };
      expect(ask({ sort, page: lastPage }).rows.at(-1)!.hours).toBe('—');
      expect(ask({ sort }).rows.some((r) => r.hours === '—')).toBe(false);
    }
  });

  it('sorts dates as days, not as text', () => {
    const days = ask({ sort: { key: 'date', dir: 'asc' } }).rows.map((r) => r.date);
    expect(days).toEqual([...days].sort((a, b) => dayOf(a) - dayOf(b)));
  });

  it('searches every column of the entry', () => {
    const model = ask({ query: 'spindle' });
    expect(model.matching).toBeGreaterThan(0);
    expect(model.matching).toBeLessThan(LOG.rows.length);
  });

  it('prints dates DD-MMM-YYYY, a person and a machine as chips, and a ticket number only when it is one', () => {
    const [first] = ask().rows;
    expect(first!.date).toMatch(/^\d{2}-[A-Z][a-z]{2}-\d{4}$/);
    expect(first!.machine).toMatchObject({ kind: 'machine' });
    expect(first!.doneBy[0]).toMatchObject({ kind: 'person' });
    expect(first!.ticket).toBe(LOG.rows[0]![2]);
    // An imported entry carries its workbook id there: never printed as a ticket number, said as where it came from.
    const imported = ask({ sort: { key: 'srNo', dir: 'asc' } }).rows[0]!;
    expect(imported.ticket).toBe('Imported');
    expect(imported.ticket).not.toBe(LOG.rows.find((r) => r[1] === imported.srNo)![2]);
  });

  it('opens the answer with the engine count and how far the records run, in v1’s words', () => {
    const model = logFromFigures(workbookLog, EMPTY_QUERY, realT)!;
    expect(model.verdict.headline[0]!.text).toBe('1,343 rows · Records to 11-Nov-2026');
  });

  it('exports the whole narrowed log, not just the page shown', () => {
    const query = { ...EMPTY_QUERY, filters: { ...EMPTY_QUERY.filters, shift: '2' } };
    const { header, rows } = everyMatchOf(workbookLog, query, testT);
    expect(header[1]).toBe('Sr No');
    // The engine's own columns, then Supported By.
    expect(rows.map((r) => r.slice(0, 10))).toEqual(LOG.rows.filter((r) => r[4] === '2'));
    expect(header.at(-1)).toBe('Supported by');
    expect(rows.length).toBeGreaterThan(10);
  });

  it('never links an entry to a ticket by the position of its drill id, because the engine sorts them', () => {
    const ids = workbookLog.figures[0]!.drill.ids;
    expect(ids).toEqual([...ids].sort());
    expect(ids[0]).not.toBe(LOG.rows[0]![2]);
  });

  it('links every entry to the ticket the engine printed beside it, on any page, sort or filter', () => {
    const { rows, rowTicketIds } = (
      workbookLog.figures[0]!.value as {
        pages: { tables: { rows: string[][]; rowTicketIds: string[] }[] }[];
      }
    ).pages[0]!.tables[0]!;
    const own = new Map(rows.map((row, at) => [row[1], rowTicketIds[at]]));
    const queries: Partial<LogQuery>[] = [
      {},
      { page: 3 },
      { sort: { key: 'machine', dir: 'asc' }, page: 3 },
      { sort: { key: 'hours', dir: 'desc' } },
      { filters: { ...EMPTY_QUERY.filters, shift: '2' }, page: 2 },
    ];
    for (const query of queries) {
      const page = ask(query).rows;
      expect(page.length).toBeGreaterThan(0);
      for (const row of page) expect(row.ticketId).toBe(own.get(row.srNo));
    }
  });

  it('is empty when the engine printed no log', () => {
    const none = {
      ...workbookLog,
      figures: [{ ...workbookLog.figures[0]!, status: 'not_computed' as const }],
    };
    expect(logFromFigures(none, EMPTY_QUERY, testT)).toBeNull();
  });
});
