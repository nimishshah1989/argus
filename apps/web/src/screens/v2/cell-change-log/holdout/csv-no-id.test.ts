// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { fill } from '../../../../i18n/fill.js';
import { cellLogCsv, cellMoves } from '../../../analytics/machine-values.js';
import { realReply } from '../../figures/real-reply.js';
import type { Translate } from '../../figures/read.js';
import { cellLogModel } from '../adapter.js';

/** G1.3 hidden: the whole export on a UUID-keyed plant, with listed and unlisted machines mixed. */

const UUID_ANYWHERE = /[0-9a-f]{8}-[0-9a-f]{4}-/i;
const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const real = realReply();
const engineMoves = cellMoves(real.figures.find((f) => f.key === 'cell-change-log')?.value);
const machineCodes = [...new Set(engineMoves.map((m) => m.machineId))];
const ids = new Map(
  machineCodes.map((code, i) => [code, `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`]),
);
/** Every other machine is one the plant no longer lists. */
const codes = new Map(
  [...ids].filter((_, i) => i % 2 === 0).map(([code, id]) => [id, code] as const),
);
const served: FiguresReply = {
  ...real,
  figures: real.figures.map((f) =>
    f.key === 'cell-change-log'
      ? {
          ...f,
          value: { moves: engineMoves.map((m) => ({ ...m, machineId: ids.get(m.machineId) })) },
        }
      : f,
  ),
};
const reader = { codeOf: (id: string) => codes.get(id) ?? null, role: 'head', today: '2026-11-11' };

describe('the cell change log export, hidden checks', () => {
  it('the plant really mixes listed and unlisted machines', () => {
    expect(machineCodes.length).toBeGreaterThan(1);
    expect(codes.size).toBeGreaterThan(0);
    expect(codes.size).toBeLessThan(ids.size);
  });

  it('has no UUID anywhere in the file', () => {
    const { csv } = cellLogModel(served, t, reader)!;
    expect(csv.text).not.toMatch(UUID_ANYWHERE);
  });

  it('keeps the document number, title, blank line and every column header', () => {
    const lines = cellLogModel(served, t, reader)!.csv.text.split('\n');
    expect(lines.slice(0, 4)).toEqual([
      'DOC. NO. CE-MTN-F-01',
      'Cell / Location Change Log',
      '',
      'Date,Machine,From cell,To cell,From location,To location',
    ]);
    expect(lines.slice(4).filter((line) => line !== '')).toHaveLength(engineMoves.length);
  });

  it('prints a listed machine by its code and an unlisted one as a dash, row for row', () => {
    const rows = cellLogModel(served, t, reader)!
      .csv.text.split('\n')
      .slice(4)
      .filter((line) => line !== '');
    const machines = rows.map((line) => line.split(',')[1]);
    const expected = engineMoves.map((m) => codes.get(ids.get(m.machineId)!) ?? '—');
    expect(machines).toEqual(expected);
    expect(machines).toContain('—');
  });

  it('prints the same dash straight from the helper, beside a listed machine', () => {
    const labels = {
      docNo: 'D',
      title: 'T',
      date: 'Date',
      machine: 'Machine',
      fromCell: 'From cell',
      toCell: 'To cell',
      fromLocation: 'From location',
      toLocation: 'To location',
    };
    const two = cellMoves({
      moves: [
        { id: 'a', machineId: 'aaaaaaaa-0000-4000-8000-000000000001', date: '2026-03-01' },
        { id: 'b', machineId: 'bbbbbbbb-0000-4000-8000-000000000002', date: '2026-03-02' },
      ],
    });
    const csv = cellLogCsv(two, (id) => (id.startsWith('aaaaaaaa') ? 'VC-1' : null), labels);
    const rows = csv.trimEnd().split('\n').slice(4);
    expect(rows.map((line) => line.split(',')[1]).sort()).toEqual(['VC-1', '—'].sort());
    expect(csv).not.toMatch(UUID_ANYWHERE);
  });
});
