// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { keyReply } from '../printed-page/key-reply.js';
import { answerKey, realT } from '../printed-page/test-support.js';
import { FIGURE, monthlyReportModel } from '../monthly-report/adapter.js';

const key = answerKey('monthly-report', FIGURE, 42);
const value = key.figures[0]!.value as {
  asOf: string;
  pages: { tables: { title: string; rows: string[][] }[] }[];
};

describe('S23 Monthly Report: edges', () => {
  it('is null when the engine has no page', () => {
    const noPage = { ...value, pages: [] };
    const empty = keyReply(FIGURE, 42, noPage);
    expect(monthlyReportModel(empty, realT)).toBeNull();
  });

  it('never counts the fleet total row as a category that added machines', () => {
    const text = monthlyReportModel(key, realT)!.takeaways.added?.text ?? '';
    expect(text).not.toContain('Total CNC machines');
  });

  it('takes the period from the plant date: a January plant date reports December of the year before', () => {
    const january = keyReply(FIGURE, 42, { ...value, asOf: '2027-01-05' });
    expect(monthlyReportModel(january, realT)!.period).toBe('December 2026');
  });

  it('gives the blank commentary form no takeaway', () => {
    const ids = Object.keys(monthlyReportModel(key, realT)!.takeaways);
    expect(ids).not.toContain('commentary');
  });
});
