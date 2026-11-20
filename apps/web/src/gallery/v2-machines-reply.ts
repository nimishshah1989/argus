import type { FiguresReply } from '@uptimo/shared/analytics';
import age from '../../../../fixtures/answer-key/a8-age.json' with { type: 'json' };
import footprint from '../../../../fixtures/answer-key/a7-footprint.json' with { type: 'json' };
import oem from '../../../../fixtures/answer-key/oem-analytics.json' with { type: 'json' };
import registers from '../../../../fixtures/answer-key/registers.json' with { type: 'json' };

/**
 * What the engine says for the Machines screens in the gallery: the frozen 11 November answer key, each file the value
 * of its figure, in the reply's own shape, so the gallery runs the same adapters the server's reply will. The cell
 * change log's moves are the log table the platform printed on its register page, read back into the engine's move.
 * The OEM figure is the platform's own page: the engine does not compute it yet.
 */
type Printed = { header: string[]; rows: string[][]; title?: string };
type Page = { page: string; tables: Printed[] };

const isoDay = (printed: string): string => printed.split('-').reverse().join('-');

function moves() {
  const cnc = (registers.pages as Page[]).find((page) => page.page === 'machines');
  const log = cnc?.tables.find((table) => table.title === 'Cell / Location Change Log');
  const list = cnc?.tables.find((table) => table.header.includes('Machine ID'));
  const where = new Map((list?.rows ?? []).map((row) => [row[1], row[9] ?? '']));
  return (log?.rows ?? []).map((row, i) => {
    const [fromCell, toCell] = (row[2] ?? '').split(' → ');
    const [fromLocation, toLocation] = (row[3] ?? '').split(' → ');
    const here = where.get(row[1] ?? '') ?? null;
    return {
      id: `move-${i + 1}`,
      machineId: row[1],
      date: isoDay(row[0] ?? ''),
      fromCell: fromCell ?? null,
      toCell: toCell ?? null,
      fromLocation: toLocation === undefined ? here : (fromLocation ?? null),
      toLocation: toLocation === undefined ? here : toLocation,
    };
  });
}

const ready = (key: string, screen: string, value: unknown) => ({
  key,
  screen,
  owner: 39,
  status: 'ready' as const,
  value,
  drill: { type: 'machine' as const, ids: [] },
});

/** The engine's register pages hold no change-log table (it is its own figure); the platform's page printed one. */
function withoutChangeLog(key: typeof registers) {
  return {
    ...key,
    pages: key.pages.map((page) => ({
      ...page,
      tables: page.tables.filter((table) => table.title !== 'Cell / Location Change Log'),
    })),
  };
}

/** The reply the gallery's Machines screens read. */
export function machinesReply(): FiguresReply {
  return {
    asOf: registers.asOf,
    excludedMachines: 0,
    rows: { machines: 0, moves: 0, tickets: 0, tasks: 0, reports: 0, people: 0 },
    profile: {} as FiguresReply['profile'],
    figures: [
      ready('registers', 'registers', withoutChangeLog(registers)),
      ready('a7-footprint', 'a7-footprint', footprint),
      ready('a8-age', 'a8-age', age),
      ready('oem-analytics', 'oem-analytics', oem),
      ready('cell-change-log', 'cell-change-log', { moves: moves() }),
    ],
  };
}

/** The machine code from a move's machine id: in the gallery the id is the code. */
export const galleryCode = (machineId: string): string => machineId;
