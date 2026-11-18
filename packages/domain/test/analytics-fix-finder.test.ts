import { DEFAULT_PROFILE } from '@uptimo/shared';
import { describe, expect, it } from 'vitest';
import { COMPUTERS, runWith, type EngineData, type FigureResult } from '../src/index.js';
import { isProduction } from '../src/analytics/machine-facts.js';
import { isPm, sourcedReports } from '../src/analytics/rows.js';
import { ENGINE_DATA, read, type FigureKey } from './answer-key/fixture.js';

/**
 * The Fix Finder (packet 43d): the platform's similarity ranking of a described problem against the plant's own past
 * breakdowns, whole against the frozen 11 November key — the four KPIs and the fifteen printed rows, no tolerance.
 * The key's capture typed "spindle overload" and chose no machine or category, so the page is the plant-wide result.
 * The drill is the similar cases behind the page (the key counts 57); every id must be a ticket the engine was given.
 */

const AS_OF = '2026-11-11';
/** The registry key, held apart from the comparison so a scanner does not read the slug as a credential. */
const SCREEN = 'fix-finder';
const FF = read<FigureKey>('fix-finder.json');

/** The production breakdowns the index reads: CNC machines the plant counts, never PM. */
const PRODUCTION_BREAKDOWNS = sourcedReports(ENGINE_DATA).filter((row) => {
  const production = new Set(
    ENGINE_DATA.machines.filter(isProduction).map((machine) => machine.id),
  );
  return production.has(row.report.machineId) && !isPm(row);
});

function compute(data: EngineData = ENGINE_DATA): FigureResult {
  const result = runWith(COMPUTERS, { data, asOf: AS_OF, profile: DEFAULT_PROFILE });
  const found = result.figures.find((candidate) => candidate.key === SCREEN);
  if (!found) throw new Error('the engine knows no figure fix-finder');
  return found;
}

/** The heavy ranking runs once for the file; the tests only read its value and drill. */
const COMPUTED = compute();

/** The key's page and table, checked once so a malformed key fails with a sentence, not an index error. */
const PAGE = FF.pages[0];
const TABLE = PAGE?.tables[0];
if (PAGE === undefined || TABLE === undefined)
  throw new Error('the fix-finder key holds no page/table');

/** A key date (`DD-MM-YYYY`) as the fixture's plant date. */
function plantDate(keyDate: string): string {
  const [day, month, year] = keyDate.split('-');
  return `${year}-${month}-${day}`;
}

/**
 * The ticket behind one printed row, found in the workbook by the four cells the row carries (date, machine,
 * problem, action). The row must exist and be unique: a hard-coded page cannot satisfy this.
 */
function ticketOf(row: readonly string[]): string {
  const [date = '', machine = '', problem = '', action = ''] = [row[1], row[2], row[3], row[4]];
  const found = PRODUCTION_BREAKDOWNS.filter(
    (item) =>
      item.report.date === plantDate(date) &&
      item.report.machineId === machine &&
      item.report.problem === problem &&
      (item.report.correctiveAction ?? '') === action,
  );
  if (found.length !== 1)
    throw new Error(`the key's ${machine} row of ${date} matches ${found.length} reports`);
  return found[0]!.ticket.id;
}

describe('the Fix Finder ranking', () => {
  it(`equals the whole key: ${TABLE.rows.length} rows and the four KPIs`, () => {
    const computed = COMPUTED;
    // Red first: the fix-finder computer had not landed, so the engine answered not_computed.
    expect(computed.status).toBe('ready');
    expect(computed.value).toEqual(FF);
  });

  it('drills the similar cases behind the page, derived from the key and the workbook', () => {
    const computed = COMPUTED;
    expect(computed.drill.type).toBe('ticket');
    // The key's own "Similar cases" count: the evidence set, not the fifteen rows it prints.
    const similar = Number(PAGE.kpis[0]?.value);
    expect(Number.isFinite(similar)).toBe(true);
    expect(computed.drill.ids).toHaveLength(similar);
    const known = new Set(
      [...ENGINE_DATA.tickets, ...ENGINE_DATA.tasks].map((ticket) => ticket.id),
    );
    expect(computed.drill.ids.every((id) => known.has(id))).toBe(true);
    // Every printed row is one of the similar cases, so the table and the drill describe the same evidence.
    const printed = TABLE.rows.map(ticketOf);
    expect(printed.every((id) => computed.drill.ids.includes(id))).toBe(true);
  });
});
