// @vitest-environment node
import { describe, expect, it } from 'vitest';
import '../../../i18n/index.js';
import { keyReply } from '../printed-page/key-reply.js';
import { answerKey, realT } from '../printed-page/test-support.js';
import { annualReportModel, FIGURE } from '../annual-report/adapter.js';

const key = answerKey('annual-report', FIGURE, 42);
const value = key.figures[0]!.value as { asOf: string };

describe('S24 Annual Report: edges', () => {
  it('is null when the engine has no page', () => {
    const noPage = { ...value, pages: [] };
    expect(annualReportModel(keyReply(FIGURE, 42, noPage), realT)).toBeNull();
  });

  it('tells the two tables that share a title apart by their first column', () => {
    const { takeaways } = annualReportModel(key, realT)!;
    expect(takeaways.pm?.text ?? '').not.toContain('TMC-2');
    expect(takeaways.long?.text ?? '').toContain('TMC-2');
  });

  it('never names the Total row as the category that added most', () => {
    expect(annualReportModel(key, realT)!.takeaways.added?.text ?? '').not.toContain('Total');
  });

  it('takes the period from the plant date', () => {
    const march = keyReply(FIGURE, 42, { ...value, asOf: '2027-03-02' });
    expect(annualReportModel(march, realT)!.period).toBe('2027 to 2 March');
  });

  it('gives the blank commentary form no takeaway', () => {
    expect(Object.keys(annualReportModel(key, realT)!.takeaways)).not.toContain('commentary');
  });
});
