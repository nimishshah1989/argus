import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { oemAnalyticsFigure } from '../src/analytics/oem.js';
import { COMPUTERS, runWith } from '../src/index.js';
import { ENGINE_DATA, read, type FigureKey, type KeyTable } from './answer-key/fixture.js';

/**
 * OEM Analytics (ticket 812) against the frozen 11 November key: every fact column of the four tables and the KPIs.
 * The key's causes were the platform's keyword guesses (ADR 0051 drops them), and the workbook holds no cause a
 * person decided, so every cause reads Not decided and the cause-split KPIs read zero. The key's rupee text is gone.
 */

const AS_OF = '2026-11-11';
const KEY = read<FigureKey>('oem-analytics.json');
const KEY_PAGE = KEY.pages[0]!;
const NOT_DECIDED = 'Not decided';

interface Kpi {
  label: string;
  value: string;
  sub: string;
}
interface Table {
  title: string;
  header: string[];
  rows: string[][];
  rowTicketIds?: string[];
}
interface Page {
  page: string;
  title: string;
  kpis: Kpi[];
  tables: Table[];
}

const COMPUTED = oemAnalyticsFigure({ data: ENGINE_DATA, asOf: AS_OF, profile: DEFAULT_PROFILE });
const PAGES = (COMPUTED.value as unknown as { pages: Page[] } | null)?.pages ?? [];
const PAGE = PAGES[0];

function table(position: number): { got: Table; key: KeyTable } {
  const got = PAGE?.tables[position];
  const key = KEY_PAGE.tables[position];
  if (!got || !key) throw new Error(`no table ${position}`);
  return { got, key };
}

describe('the OEM Analytics figure on the 11 November workbook', () => {
  it('is one page, oem, titled OEM Analytics, with four tables', () => {
    expect(PAGES).toHaveLength(1);
    expect(PAGE?.page).toBe('oem');
    expect(PAGE?.title).toBe('OEM Analytics');
    expect(PAGE?.tables.map((t) => t.title)).toEqual(KEY_PAGE.tables.map((t) => t.title));
    expect(PAGE?.tables.map((t) => t.header)).toEqual(KEY_PAGE.tables.map((t) => t.header));
  });

  it('prints the six KPIs in order, facts from the key, causes not decided, no rupees', () => {
    const key = (label: string): Kpi => KEY_PAGE.kpis.find((k) => k.label === label) as Kpi;
    expect(PAGE?.kpis).toEqual([
      {
        label: 'Young machines',
        value: key('Young machines').value,
        sub: key('Young machines').sub,
      },
      { label: 'Breakdowns', value: key('Breakdowns').value, sub: key('Breakdowns').sub },
      { label: 'Downtime', value: key('Downtime').value, sub: '100% of the hours not decided yet' },
      { label: 'OEM or commissioning', value: '0.0 hrs', sub: '0% of the hours' },
      { label: 'Our side', value: '0.0 hrs', sub: '0% of the hours' },
      {
        label: 'Inside warranty',
        value: key('Inside warranty').value,
        sub: '0 causes decided by people, 72 not decided',
      },
    ]);
  });

  it('Machines: every fact column equals the key; Main cause is Not decided, blank with no hours', () => {
    const { got, key } = table(0);
    expect(got.rows.map((row) => row.slice(0, 10))).toEqual(
      key.rows.map((row) => row.slice(0, 10)),
    );
    expect(got.rows.map((row) => row[10])).toEqual(
      key.rows.map((row) => (row[5] === '0.0' ? '' : NOT_DECIDED)),
    );
  });

  it('By make and model and Faults that repeat equal the key', () => {
    expect(table(1).got.rows).toEqual(table(1).key.rows);
    expect(table(2).got.rows).toEqual(table(2).key.rows);
  });

  it('every breakdown: fact columns equal the key, Cause reads Not decided, one ticket per row', () => {
    const { got, key } = table(3);
    expect(got.rows.map((row) => row.slice(0, 6))).toEqual(key.rows.map((row) => row.slice(0, 6)));
    expect(got.rows.map((row) => row[6])).toEqual(key.rows.map(() => NOT_DECIDED));
    expect(got.rowTicketIds).toHaveLength(key.rows.length);
  });

  it('drills the tickets of the young-machine breakdowns, every one a real ticket', () => {
    const tickets = new Set(ENGINE_DATA.tickets.map((ticket) => ticket.id));
    expect(COMPUTED.drillIds.length).toBeGreaterThan(0);
    expect(COMPUTED.drillIds.every((id) => tickets.has(id))).toBe(true);
    expect(new Set(COMPUTED.drillIds)).toEqual(new Set(table(3).got.rowTicketIds));
  });
});

describe('the OEM Analytics figure in an engine run', () => {
  it('lists young machines that never broke down without failing the run (a mixed figure, ADR 0051)', () => {
    // Young machines with no breakdown are rows of the value but no ticket to drill to: the registry marks it mixed.
    const young = new Set(table(0).got.rows.map((row) => row[0]));
    const youngIds = new Set(
      ENGINE_DATA.machines.filter((m) => young.has(m.code)).map((m) => m.id),
    );
    const reports = ENGINE_DATA.reports.filter((report) => !youngIds.has(report.machineId));
    const kept = new Set(reports.map((report) => report.ticketId));
    const tickets = ENGINE_DATA.tickets.filter((ticket) => kept.has(ticket.id));
    const data = { ...ENGINE_DATA, tickets, reports, tasks: [], whyWhy: [] };
    const run = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
    const oem = run.figures.find((figure) => figure.key === 'oem-analytics');
    const pages = (oem?.value as unknown as { pages: Page[] } | null)?.pages ?? [];
    expect(pages[0]?.tables[0]?.rows.length).toBeGreaterThan(0);
    expect(oem?.drill.ids).toEqual([]);
  });
});
