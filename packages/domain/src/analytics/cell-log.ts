import type { Computer, FigureValue, MoveRow } from './types.js';

/**
 * The cell change log (ticket 39): every recorded move, newest first, with the cell and location it left and
 * reached. A move whose locations match prints "no change", as the platform's own log does; a blank side prints a
 * dash, never an empty cell. Each row is a move, so its drill opens the move record.
 */
export interface CellMove {
  id: string;
  date: string;
  effectiveFrom: string;
  machineId: string;
  fromCell: string | null;
  toCell: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  cellChange: string;
  locationChange: string;
}

/** A plant date (`YYYY-MM-DD`) as the platform prints it (`DD-MM-YYYY`). */
const displayDate = (date: string): string =>
  date.length >= 10 ? `${date.slice(8, 10)}-${date.slice(5, 7)}-${date.slice(0, 4)}` : date;

const cellChange = (move: MoveRow): string =>
  `${move.fromCell ?? '—'} → ${move.toCell ?? ''}`.trim();

const locationChange = (move: MoveRow): string =>
  (move.fromLocation ?? null) === (move.toLocation ?? null)
    ? 'no change'
    : `${move.fromLocation ?? '—'} → ${move.toLocation ?? ''}`.trim();

/** The move rows, newest first, each naming the move it came from. */
export const cellChangeLog: Computer = ({ data }) => {
  const rows = data.moves
    .slice()
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))
    .map((move): CellMove => ({
      id: move.id,
      date: displayDate(move.effectiveFrom),
      effectiveFrom: move.effectiveFrom,
      machineId: move.machineId,
      fromCell: move.fromCell,
      toCell: move.toCell,
      fromLocation: move.fromLocation ?? null,
      toLocation: move.toLocation ?? null,
      cellChange: cellChange(move),
      locationChange: locationChange(move),
    }));
  return { value: { rows } as unknown as FigureValue, drillIds: rows.map((row) => row.id) };
};
