// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { en } from '@uptimo/shared/i18n';
import { fill } from '../../../i18n/fill.js';
import { registerPages } from '../../analytics/machine-values.js';
import { printed, realReply } from '../figures/real-reply.js';
import type { Translate } from '../figures/read.js';
import { footprintModel } from './adapter.js';

const t: Translate = (key, values) =>
  fill((en as Record<string, string>)[key] ?? key, values ?? {});
const reply = realReply();
const model = footprintModel(reply, t)!;
const page = registerPages(reply.figures.find((f) => f.key === 'a7-footprint')?.value)[0]!;

describe('the footprint, from the engine’s own reply', () => {
  it('prints every card and every cell of the five tables the engine sent', () => {
    const shown = new Set(printed(model));
    for (const kpi of page.kpis) {
      expect(shown, kpi.label).toContain(kpi.label);
      expect(shown, kpi.value).toContain(kpi.value);
    }
    expect(model.tables).toHaveLength(page.tables.length);
    for (const table of page.tables)
      for (const row of table.rows) for (const cell of row) expect(shown, cell).toContain(cell);
  });

  it('opens with the floor the fleet needs and the share its machines fill, as the engine printed them', () => {
    const floor = page.kpis[2]!.value;
    const share = page.kpis[3]!.value;
    expect(model.verdict.headline.map((seg) => seg.text).join('')).toBe(
      `The fleet needs a floor of ${floor}, and its machines fill ${share} of it.`,
    );
    expect(model.verdict.context).toContain('Square:');
  });

  it('draws the fleet’s growth year by year from the growth table', () => {
    const growth = page.tables.find((table) => table.header[0] === 'Year')!;
    expect(model.growth?.categories).toEqual(growth.rows.map((row) => row[0]));
    const values = model.growth?.series[0]?.values ?? [];
    expect(values.at(-1)).toBe(Number(growth.rows.at(-1)?.[3]?.replaceAll(',', '')));
  });

  it('names each cell and each of the ten largest machines as a chip', () => {
    const byCell = model.tables.find((table) => table.title.endsWith('by Cell'))!;
    expect(byCell.rows[0]?.[0]?.chip).toMatchObject({ kind: 'cell', id: '1', label: 'Cell 1' });
    const largest = model.tables.find((table) => table.title === '10 Largest Footprints')!;
    expect(largest.rows).toHaveLength(10);
    expect(largest.rows[0]?.[0]?.chip).toMatchObject({ kind: 'machine', id: 'WJ-01' });
  });

  it('says the engine has not computed the footprint', () => {
    const none = {
      ...reply,
      figures: reply.figures.map((f) =>
        f.key === 'a7-footprint' ? { ...f, status: 'not_computed' as const, value: null } : f,
      ),
    };
    expect(footprintModel(none, t)).toBeNull();
  });
});
