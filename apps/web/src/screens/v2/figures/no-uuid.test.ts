// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { bottleneckModel } from '../bottleneck/adapter.js';
import { energyModel, FIGURE as ENERGY } from '../energy/adapter.js';
import { forecastLabModel } from '../forecast-lab/adapter.js';
import { manpowerModel } from '../manpower/adapter.js';
import { whyWhyModel } from '../why-why/adapter.js';
import { realT } from '../printed-page/test-support.js';
import { shiftKpisModel } from '../shift-kpis/adapter.js';
import { parseTile, tileMachines } from '../rows-behind/tile.js';
import { codeOfUuid, printed, realReply, realReplyWithUuids, UUID } from './real-reply.js';

/**
 * The answer key sets every machine's id equal to its code, so a screen that printed an engine id would pass. Here
 * every machine id is a UUID, as the server sends: no screen may print one, in a chip, a tooltip, a chart point or a link.
 */
const real = realReply();
const keyed = realReplyWithUuids();

type Build = (
  reply: typeof real,
  t: typeof realT,
  codeOf: (id: string) => string | null,
) => unknown;
const screens: Record<string, Build> = {
  energy: (reply, t) => energyModel(reply, t),
  bottleneck: (reply, t, codeOf) => bottleneckModel(reply, t, codeOf),
  'forecast lab': (reply, t) => forecastLabModel(reply, t),
  'shift-calendar KPIs': (reply, t) => shiftKpisModel(reply, t),
  manpower: (reply, t) => manpowerModel(reply, t),
  'why-why': (reply, t) => whyWhyModel(reply, t),
};

describe('the Energy, Bottleneck, Forecast Lab, Shift-calendar, Manpower and Why-Why screens on a plant whose machine ids are UUIDs', () => {
  it('re-keys the plant: its machines really have UUIDs that are not their codes', () => {
    const energy = keyed.figures.find((f) => f.key === ENERGY)!;
    expect(energy.drill.ids.every((id) => UUID.test(id))).toBe(true);
  });

  for (const [name, model] of Object.entries(screens)) {
    it(`prints no UUID on the ${name} screen, and the same words as on the code-keyed plant`, () => {
      const [withUuids, withCodes] = [
        model(keyed, realT, codeOfUuid),
        model(real, realT, (id) => id),
      ];
      expect(withUuids).not.toBeNull();
      expect(printed(withUuids).filter((text) => UUID.test(text))).toEqual([]);
      expect(JSON.stringify(withUuids)).not.toMatch(UUID);
      expect(printed(withUuids)).toEqual(printed(withCodes));
    });
  }

  it('opens each energy tile on the machines it counts, by id, and the drawer prints their codes', () => {
    const figure = keyed.figures.find((f) => f.key === ENERGY)!;
    const tile = energyModel(keyed, realT)!.grids[0]!.tiles[0]!;
    const ids = tileMachines(figure, parseTile(tile.drill!.figure)!);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => UUID.test(id) && figure.drill.ids.includes(id))).toBe(true);
    expect(tile.drill!.figure).not.toMatch(UUID);
  });
});
