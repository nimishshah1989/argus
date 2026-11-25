// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { answerKey, keyPage, realT } from '../printed-page/test-support.js';
import { FIGURE, monthlyReportModel } from './adapter.js';
import { SECTIONS } from './model.js';

/**
 * S23 Monthly Report (#763). Critical tests only (ADR 0034): the figures each line carries, measured on the frozen
 * answer key (the 11 November plant, so the report is October 2026), never the wording.
 */
const reply = answerKey('monthly-report', FIGURE, 42);
const page = keyPage(reply);
const model = () => monthlyReportModel(reply, realT)!;
const line = (id: string) => model().takeaways[id]?.text ?? '';

describe('S23 Monthly Report from the engine reply', () => {
  it('keeps all 8 tables whole (the View sorts and collapses; the model keeps every row)', () => {
    expect(model().tables.map((t) => t.rows.length)).toEqual(page.tables.map((t) => t.rows.length));
  });

  it('captions the untitled table as the commentary form', () => {
    expect(model().tables.map((t) => t.title)).toContain('Management commentary and actions');
  });

  it('says the period and offers the PDF and the Excel downloads', () => {
    expect(model().period).toBe('October 2026');
    expect(model().links.map((l) => l.href)).toEqual([
      '/api/v1/reports/monthly.pdf',
      '/api/v1/reports/workbook.xlsx',
    ]);
  });

  it('opens every section with a takeaway', () => {
    expect(Object.keys(model().takeaways).sort()).toEqual([...SECTIONS].sort());
    for (const id of SECTIONS) expect(line(id).length, id).toBeGreaterThan(0);
  });

  it('names the busiest day, the worst month and each ranking’s top row by their printed figures', () => {
    for (const figure of ['24', '27.7', '13']) expect(line('daily')).toContain(figure);
    for (const figure of ['Jun 26', '660.4']) expect(line('months')).toContain(figure);
    for (const figure of ['VC-16 CVM1160', '25.9', '18.0'])
      expect(line('machine')).toContain(figure);
    for (const figure of ['Cell 2', '80.3']) expect(line('cell')).toContain(figure);
    for (const figure of ['Vertical Machining Center', '109.9'])
      expect(line('category')).toContain(figure);
    for (const figure of ['M Mechanical', '57.7']) expect(line('code')).toContain(figure);
  });

  it('says how much longer the longest breakdown was than the next, who attended most, and what was added', () => {
    for (const figure of ['VC-22 MILL TAP MT 700', '16.0', '1.5'])
      expect(line('longest')).toContain(figure);
    for (const figure of ['Person 11', '27.0%']) expect(line('team')).toContain(figure);
    for (const figure of ['7', 'Turning Center']) expect(line('added')).toContain(figure);
  });
});
