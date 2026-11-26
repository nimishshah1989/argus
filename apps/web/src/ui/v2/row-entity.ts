import type { EntityKind, EntityRef } from './entity-chip.js';

const KINDS: ReadonlySet<string> = new Set<EntityKind>(['machine', 'cell', 'person', 'decision']);

/** A value that names a machine, a cell, a person or a decision, as a chip does: `{ kind, id }`. */
const refOf = (value: unknown): EntityRef | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;
  const o = value as { kind?: unknown; id?: unknown };
  if (typeof o.kind !== 'string' || !KINDS.has(o.kind)) return undefined;
  return typeof o.id === 'string' && o.id !== ''
    ? { kind: o.kind as EntityKind, id: o.id }
    : undefined;
};

const firstOf = (list: unknown): EntityRef | undefined =>
  Array.isArray(list) ? list.map(refOf).find(Boolean) : undefined;

/**
 * The thing a table row is (UX rule 18, ADR 0058), found the way the v2 models write it: the row's own `entity`,
 * `machine`, `chip` or `decision`, else its first `chips`, else the first chip in its `cells` (an engine or printed
 * table). Undefined for a row that names nothing: that row opens nothing.
 */
export function entityOfRow(row: unknown): EntityRef | undefined {
  if (typeof row !== 'object' || row === null) return undefined;
  const r = row as Record<string, unknown>;
  const own = refOf(r.entity) ?? refOf(r.machine) ?? refOf(r.chip) ?? refOf(r.decision);
  return own ?? firstOf(r.chips) ?? inCells(r.cells);
}

/** The first chip in a printed or engine table row's cells. */
function inCells(cells: unknown): EntityRef | undefined {
  if (!Array.isArray(cells)) return undefined;
  for (const cell of cells as unknown[]) {
    if (typeof cell !== 'object' || cell === null) continue;
    const c = cell as { chip?: unknown; chips?: unknown };
    const found = refOf(c.chip) ?? firstOf(c.chips);
    if (found) return found;
  }
  return undefined;
}
