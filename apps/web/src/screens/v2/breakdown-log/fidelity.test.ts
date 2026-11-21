import { describe, expect, it } from 'vitest';
import { realT } from '../printed-page/test-support.js';
import { logFromFigures, printedLog } from './live.js';
import { EMPTY_QUERY, type LogQuery } from './model.js';
import { workbookLog } from './source.js';

const LOG = printedLog(workbookLog, realT)!;
const ask = (query: Partial<LogQuery> = {}) =>
  logFromFigures(workbookLog, { ...EMPTY_QUERY, ...query }, realT)!;
const filter = (patch: Partial<LogQuery['filters']>) => ({
  filters: { ...EMPTY_QUERY.filters, ...patch },
});
const names = (printed: string) =>
  printed
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== '' && n !== '—');

describe('the Breakdown Log keeps what Bhavin’s log shows', () => {
  it('filters by month and year, newest month first, and never narrows the log’s own count', () => {
    const model = ask();
    const [newest] = model.options.month;
    expect(newest).toMatch(/^\d{4}-\d{2}$/);
    expect(model.options.month).toEqual([...model.options.month].sort().reverse());
    const [year, month] = newest!.split('-');
    const inMonth = LOG.rows.filter((r) => r[3]!.endsWith(`${month}-${year}`));
    const narrowed = ask(filter({ month: newest! }));
    expect(narrowed.matching).toBe(inMonth.length);
    expect(narrowed.count).toBe(LOG.rows.length);
    expect(narrowed.rows.length).toBeGreaterThan(0);
  });

  it('keeps two years’ March apart, as Bhavin’s year-less month list could not', () => {
    const marches = ask().options.month.filter((m) => m.endsWith('-03'));
    const years = new Set(marches.map((m) => m.slice(0, 4)));
    expect(years.size).toBe(marches.length);
  });

  it('filters by team member on Done By or on Supported By', () => {
    const detail = LOG.detail;
    const supporter = detail.flatMap((d) => names(d.supportedBy)).find((n) => n !== '')!;
    expect(ask().options.person).toContain(supporter);
    const expected = LOG.rows.filter(
      (row, at) =>
        names(row[7]!).includes(supporter) || names(detail[at]!.supportedBy).includes(supporter),
    );
    const found = ask(filter({ person: supporter }));
    expect(found.matching).toBe(expected.length);
    expect(found.count).toBe(LOG.rows.length);
    const onlyDoneBy = LOG.rows.filter((row) => names(row[7]!).includes(supporter)).length;
    expect(found.matching).toBeGreaterThan(onlyDoneBy);
  });

  it('prints who supported a job on its row, as person chips', () => {
    const at = LOG.detail.findIndex((d) => d.supportedBy !== '');
    const srNo = LOG.rows[at]![1]!;
    const row = ask({ query: '', sort: { key: 'srNo', dir: 'desc' } }).rows.find(
      (r) => r.srNo === srNo,
    );
    const page = row ?? ask(filter({ person: names(LOG.detail[at]!.supportedBy)[0]! })).rows[0]!;
    expect(page.supportedBy.length).toBeGreaterThan(0);
    expect(page.supportedBy[0]).toMatchObject({ kind: 'person' });
  });

  it('searches Supported By too', () => {
    const supporter = LOG.detail.flatMap((d) => names(d.supportedBy))[0]!;
    const hits = ask({ query: supporter });
    expect(hits.matching).toBeGreaterThan(0);
  });

  it('says where an imported entry came from instead of a dash', () => {
    const imported = ask({ sort: { key: 'srNo', dir: 'asc' } }).rows[0]!;
    expect(imported.ticket).toBe('Imported');
  });

  it('tags only the exceptions: over 4 hours a long stop, over 1 hour a stop to watch', () => {
    const all = LOG.rows.map((row) => (row[8] === '—' ? 0 : Number(row[8])));
    const model = ask({ sort: { key: 'hours', dir: 'desc' } });
    const long = model.rows.filter((r) => r.severity === 'long');
    expect(long.length).toBeGreaterThan(0);
    expect(long.every((r) => Number(r.hours) > 4)).toBe(true);
    const calm = ask({ sort: { key: 'hours', dir: 'asc' } }).rows.filter(
      (r) => r.hours !== '—' && Number(r.hours) <= 1,
    );
    expect(calm.length).toBeGreaterThan(0);
    expect(calm.every((r) => r.severity === null)).toBe(true);
    expect(all.some((h) => h > 1 && h <= 4)).toBe(true);
    const watch = ask({ sort: { key: 'hours', dir: 'desc' }, page: 40 }).rows;
    expect(watch.filter((r) => r.severity !== null).every((r) => Number(r.hours) > 1)).toBe(true);
  });

  it('keeps a NO DT dash untagged and gives each code the plant’s own description', () => {
    const noDt = ask(filter({ code: 'NO DT' })).rows[0]!;
    expect(noDt.hours).toBe('—');
    expect(noDt.severity).toBeNull();
    const model = ask();
    expect(model.codeLabels.E).toBe('Electronics/Electrical');
    const row = ask(filter({ code: 'E' })).rows[0]!;
    expect(row.codeLabel).toBe('Electronics/Electrical');
  });

  it('shows a row’s type (E, M, E/M) only when it adds to the code', () => {
    const rows = ask(filter({ code: 'AX' })).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.type !== '')).toBe(true);
    expect(rows.every((r) => r.type !== r.code)).toBe(true);
  });

  it('still opens a log saved before the engine sent the detail', () => {
    const figure = workbookLog.figures[0]!;
    const value = { ...(figure.value as object), extra: undefined };
    const old = { ...workbookLog, figures: [{ ...figure, value }] };
    const model = logFromFigures(old, EMPTY_QUERY, realT)!;
    expect(model.rows).toHaveLength(10);
    expect(model.rows.every((r) => r.supportedBy.length === 0 && r.codeLabel === null)).toBe(true);
  });
});
