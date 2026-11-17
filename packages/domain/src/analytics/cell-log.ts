import type { Computer, FigureValue, MoveRow } from './types.js';

/**
 * The cell change log (ticket 39): every recorded move, newest first, with the cell and location it left and
 * reached. `date` is the plant ISO date; the face formats it, so the engine never carries a display string. Each
 * row names its move, so its drill opens the move record.
 */
export interface CellMove {
  id: string;
  machineId: string;
  date: string;
  fromCell: string | null;
  toCell: string | null;
  fromLocation: string | null;
  toLocation: string | null;
}

const moveRow = (move: MoveRow): CellMove => ({
  id: move.id,
  machineId: move.machineId,
  date: move.effectiveFrom,
  fromCell: move.fromCell,
  toCell: move.toCell,
  fromLocation: move.fromLocation ?? null,
  toLocation: move.toLocation ?? null,
});

/** The move rows, newest first, each naming the move it came from. */
export const cellChangeLog: Computer = ({ data }) => {
  const moves: CellMove[] = data.moves
    .slice()
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))
    .map(moveRow);
  return { value: { moves } as unknown as FigureValue, drillIds: moves.map((move) => move.id) };
};
