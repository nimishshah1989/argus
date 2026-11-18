import { describe, expect, it } from 'vitest';
import { cellLabel, esc, machineLabel } from '../src/modules/reports/html.js';
import { renderDayReportHtml } from '../src/modules/reports/day-report-template.js';
import { renderReportHtml, type ReportPdfInput } from '../src/modules/reports/pdf-template.js';

const HOSTILE = `<script>alert('x')</script> "quoted" & more`;

describe('what every report PDF shares', () => {
  it('escapes the five characters that can break out of HTML', () => {
    expect(esc(HOSTILE)).toBe(
      '&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &quot;quoted&quot; &amp; more',
    );
  });

  it('labels a cell once, and a machine with its category and cell', () => {
    expect(cellLabel(null)).toBeNull();
    expect(cellLabel('2')).toBe('Cell 2');
    expect(cellLabel('Cell-2')).toBe('Cell-2');
    expect(machineLabel({ code: 'VMC-1', category: 'VMC', cell: '2' })).toBe('VMC-1 (VMC, Cell 2)');
    expect(machineLabel({ code: 'VMC-1', category: null, cell: null })).toBe('VMC-1');
    expect(machineLabel({ code: null, category: 'VMC', cell: '2' })).toBe('—');
  });

  it('keeps hostile text out of the breakdown PDF and the day PDF alike', () => {
    const machine = { code: HOSTILE, category: null, cell: null };
    const breakdown = renderReportHtml({
      tenant: { name: HOSTILE, language: 'en', timeZone: 'Asia/Kolkata' },
      ticket: {
        id: 'x',
        ref: 'BD-1',
        kind: 'stopped',
        status: 'closed',
        problem: HOSTILE,
        reportedAt: new Date('2026-11-01T04:00:00Z'),
        closedAt: new Date('2026-11-01T05:00:00Z'),
        figures: {} as ReportPdfInput['ticket']['figures'],
        machine,
      },
      report: {
        id: 'r',
        ticketId: 'x',
        machineId: 'm',
        date: '2026-11-01',
        shiftCode: 'A',
        problem: HOSTILE,
        observedBy: HOSTILE,
        correctiveAction: HOSTILE,
        downtimeMin: 60,
        responseMin: 5,
        repairMin: 40,
        breakdownCategory: HOSTILE,
        maintCode: null,
        spareUsed: HOSTILE,
        rootCause: HOSTILE,
        failureComponent: null,
        failureMode: null,
        failureCause: null,
        failureAction: null,
        pmReport: null,
        handoverName: HOSTILE,
        handoverPersonId: null,
        submittedByPersonId: null,
        submittedAt: new Date('2026-11-01T05:30:00Z'),
        people: [],
      },
      people: { done: [HOSTILE], supported: [] },
      qr: { svg: '<svg></svg>' },
      generatedAt: new Date('2026-11-01T06:00:00Z'),
    });
    expect(breakdown).not.toContain('<script>');
    const day = renderDayReportHtml({
      tenant: { name: HOSTILE, language: 'en', timeZone: 'Asia/Kolkata' },
      person: { id: 'p', name: HOSTILE },
      date: '2026-11-01',
      shift: null,
      window: { start: new Date('2026-11-01T00:00:00Z'), end: new Date('2026-11-02T00:00:00Z') },
      jobs: [
        {
          ref: 'BD-1',
          machine,
          problem: HOSTILE,
          stateAtEnd: 'closed',
          roles: ['primary'],
          minutes: 5,
        },
      ] as unknown as Parameters<typeof renderDayReportHtml>[0]['jobs'],
      totalMinutes: 5,
      pending: [],
      generatedAt: new Date('2026-11-01T06:00:00Z'),
    });
    expect(day).not.toContain('<script>');
    expect(day).toContain('&lt;script&gt;');
  });
});
