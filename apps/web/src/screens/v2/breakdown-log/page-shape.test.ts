// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { NotComputed } from '../figures/live-error.js';
import { realReply, realReplyWithUuids, UUID } from '../figures/real-reply.js';
import { realT } from '../printed-page/test-support.js';
import { everyMatchOf, liveLog, logFromFigures, printedLog } from './live.js';
import { EMPTY_QUERY } from './model.js';
import { logCsv } from './csv.js';
import { workbookFigures } from './source.js';

/** A log as the engine writes it: newest first, the highest Sr No at the head, a dash for a NO DT row. */
const logOf = (count: number, rowCount = count) => {
  const rows = Array.from({ length: count }, (_, at) => {
    const srNo = count - at;
    return [
      '👁',
      String(srNo),
      `BD-${String(srNo).padStart(4, '0')}`,
      '07-11-2026',
      '2',
      `VC-${(srNo % 40) + 1}`,
      `Problem ${srNo}`,
      'Person 41',
      srNo % 7 === 0 ? '—' : `${srNo % 5}.${(srNo % 9) + 1}`,
      'ATC',
    ];
  });
  const reply = workbookFigures([]);
  const [figure] = reply.figures;
  const value = {
    screen: 'breakdown-log',
    asOf: '2026-11-11',
    pages: [
      {
        page: 'breakdowns',
        title: 'Breakdown Log',
        kpis: [],
        tables: [
          {
            title: '',
            header: [
              '',
              'Sr No',
              'Ticket No.',
              'Date',
              'Shift',
              'Machine',
              'Problem',
              'Done By',
            ].concat(['Downtime (Hrs)', 'Code']),
            rows,
            rowTicketIds: rows.map((_, at) => `id-${at}`),
            rowCount,
            truncated: true,
          },
        ],
        charts: [],
      },
    ],
  };
  return { ...reply, figures: [{ ...figure!, status: 'ready' as const, value }] };
};

describe('the live Breakdown Log opens on one page of rows', () => {
  it('paints ten of the 1,343 rows and says how many the log holds, never all of them', () => {
    const model = liveLog(logOf(1343), EMPTY_QUERY, realT)!;
    expect(model.rows).toHaveLength(10);
    expect(model.countShown).toBe('1,343');
    expect(model.verdict.headline[0]?.text).toContain('1,343');
    expect(model.rows[0]?.srNo).toBe('1343');
    expect(model.rows[9]?.srNo).toBe('1334');
  });

  it('says the date of the log’s newest entry however the page is sorted', () => {
    const oldest = { ...EMPTY_QUERY, sort: { key: 'srNo' as const, dir: 'asc' as const } };
    const model = liveLog(logOf(30), oldest, realT)!;
    expect(model.rows[0]?.srNo).toBe('1');
    expect(model.verdict.headline[0]?.text).toContain('newest 07-Nov-2026');
    const older = logOf(30);
    const value = older.figures[0]!.value as { pages: { tables: { rows: string[][] }[] }[] };
    value.pages[0]!.tables[0]!.rows[29]![3] = '01-10-2026';
    expect(liveLog(older, oldest, realT)!.verdict.headline[0]?.text).toContain(
      'newest 07-Nov-2026',
    );
  });

  it('opens each row’s own ticket, not the one the sorted drill ids happen to put at its position', () => {
    const model = liveLog(logOf(1343), EMPTY_QUERY, realT)!;
    // The drill ids are sorted as text (id-0, id-1, id-10, ...), so by position row 3 would open id-10.
    expect(model.rows.slice(0, 4).map((row) => row.ticketId)).toEqual([
      'id-0',
      'id-1',
      'id-2',
      'id-3',
    ]);
  });

  it('keeps the dash where there is no downtime, and puts it last whichever way the hours are sorted', () => {
    const model = liveLog(logOf(12), EMPTY_QUERY, realT)!;
    expect(model.matching).toBe(12);
    expect(model.truncated).toBeNull();
    expect(model.rows.some((row) => row.hours === '—')).toBe(true);
    for (const dir of ['asc', 'desc'] as const) {
      const sorted = liveLog(logOf(12), { ...EMPTY_QUERY, sort: { key: 'hours', dir } }, realT)!;
      expect(sorted.rows).toHaveLength(10);
      expect(sorted.rows.some((row) => row.hours === '—')).toBe(false);
    }
  });

  it('says it printed only the newest rows when the engine counted more than it printed', () => {
    const model = liveLog(logOf(12, 1343), EMPTY_QUERY, realT)!;
    expect(model.count).toBe(1343);
    expect(model.truncated).toBe('showing the newest 12 of 1,343');
  });

  it('is "not computed yet" for a log the engine has not computed, and empty only for an empty plant', () => {
    const none = logOf(12);
    const held = { ...none, figures: [{ ...none.figures[0]!, status: 'not_computed' as const }] };
    expect(() => liveLog(held, EMPTY_QUERY, realT)).toThrow(NotComputed);
    expect(() => liveLog({ ...none, figures: [] }, EMPTY_QUERY, realT)).toThrow(NotComputed);
    expect(liveLog(logOf(0), EMPTY_QUERY, realT)).toBeNull();
  });
});

describe('the Breakdown Log on a plant whose machine ids are UUIDs, as the server sends', () => {
  const keyed = realReplyWithUuids();
  const coded = realReply();

  it('prints the machine codes, in the rows, the filter and the export, and no database id', () => {
    const model = logFromFigures(keyed, EMPTY_QUERY, realT)!;
    const plain = logFromFigures(coded, EMPTY_QUERY, realT)!;
    expect(model.rows.length).toBeGreaterThan(0);
    // The row's ticket handle is for the link; everything a reader can read is a code.
    const readable = JSON.stringify({
      ...model,
      rows: model.rows.map(({ ticketId, ...rest }) => rest),
    });
    expect(readable).not.toMatch(UUID);
    expect(model.options.machine).toEqual(plain.options.machine);
    expect(model.rows.map((row) => row.machine.label)).toEqual(
      plain.rows.map((row) => row.machine.label),
    );
    const everything = everyMatchOf(keyed, EMPTY_QUERY, realT);
    expect(everything.rows.length).toBe(model.count);
    expect(logCsv(everything.header, everything.rows)).not.toMatch(UUID);
  });

  it('still filters by a printed code', () => {
    const code = printedLog(keyed, realT)!.rows[0]![5]!;
    const model = logFromFigures(
      keyed,
      { ...EMPTY_QUERY, filters: { ...EMPTY_QUERY.filters, machine: code } },
      realT,
    )!;
    expect(model.matching).toBeGreaterThan(0);
    expect(model.rows.every((row) => row.machine.label === code)).toBe(true);
  });
});
