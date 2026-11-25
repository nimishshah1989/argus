// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { answerKey, keyPage, realT } from '../printed-page/test-support.js';
import { annualReportModel, FIGURE } from './adapter.js';
import { SECTIONS } from './model.js';

/**
 * S24 Annual Report (#765). Critical tests only (ADR 0034): the figures each line carries, measured on the frozen
 * answer key (the 11 November plant, so the report is 2026 to 11 November), never the wording.
 */
const reply = answerKey('annual-report', FIGURE, 42);
const page = keyPage(reply);
const model = () => annualReportModel(reply, realT)!;
const line = (id: string) => model().takeaways[id]?.text ?? '';

describe('S24 Annual Report from the engine reply', () => {
  it('prints all 12 tables whole and both charts', () => {
    expect(model().tables.map((t) => t.rows.length)).toEqual(page.tables.map((t) => t.rows.length));
    expect(model().charts).toHaveLength(2);
  });

  it('captions the untitled table as the commentary form', () => {
    expect(model().tables.map((t) => t.title)).toContain('Management commentary and actions');
  });

  it('says the period and offers the PDF and the Excel downloads', () => {
    expect(model().period).toBe('2026 to 11 November');
    expect(model().links.map((l) => l.href)).toEqual([
      '/api/v1/reports/annual.pdf',
      '/api/v1/reports/workbook.xlsx',
    ]);
  });

  it('opens every table section with a takeaway', () => {
    expect(Object.keys(model().takeaways).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(line(id).length, id).toBeGreaterThan(0);
  });

  it('names the worst month and quarter, and the machine and cause that cost most', () => {
    for (const figure of ['June', '660.4']) expect(line('months')).toContain(figure);
    for (const figure of ['Q2', '1,112']) expect(line('quarters')).toContain(figure);
    for (const figure of ['TMC-2 SL30MC', '307.6', '10.1%', '44.8%'])
      expect(line('machines')).toContain(figure);
    for (const figure of ['E Electronics/Electrical', '688', '22.5%'])
      expect(line('causes')).toContain(figure);
  });

  it('compares cells, categories and age bands by hours per machine, not by size', () => {
    for (const figure of ['Cell 1', '70.3']) expect(line('cells')).toContain(figure);
    for (const figure of ['Turnmill', '88.0']) expect(line('categories')).toContain(figure);
    for (const figure of ['20+ yrs', '104.7']) expect(line('age')).toContain(figure);
  });

  it('names the busiest team, the PM peak, the longest breakdown and the machines added', () => {
    for (const figure of ['Person 11 Team', '197']) expect(line('team')).toContain(figure);
    for (const figure of ['Aug', '386.0']) expect(line('pm')).toContain(figure);
    for (const figure of ['TMC-2 SL30MC', '238.6', '1.5']) expect(line('long')).toContain(figure);
    for (const figure of ['25', 'Vertical Machining Center', '13'])
      expect(line('added')).toContain(figure);
  });
});
