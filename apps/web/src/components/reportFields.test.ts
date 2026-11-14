import { describe, expect, it } from 'vitest';
import { buildReportBody, reportReady, type ReportValues } from './reportFields.js';

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
