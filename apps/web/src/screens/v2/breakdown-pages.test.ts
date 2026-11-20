// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { ENGINE_DATA } from '../../../../../packages/domain/test/answer-key/fixture.js';
import { bdPmModel, FIGURE as BD_PM } from './bd-pm/adapter.js';
import { categoryCellModel, FIGURE as CATEGORY_CELL } from './category-cell/adapter.js';
import { mttrMtbfModel, FIGURE as MTTR_MTBF } from './mttr-mtbf/adapter.js';
import { printed, realReply, realReplyWithUuids, UUID } from './figures/real-reply.js';
import { figureForLegacyDrill, NO_SUCH_FIGURE } from './rows-behind/legacy.js';
import { realT } from './printed-page/test-support.js';
import type { PrintedPageModel } from './printed-page/page-model.js';
import type { PageTable } from '../analytics/page-content.js';

/**
 * BD % and PM split, Category and cell, and MTTR and MTBF, live at their v1 address: built from the engine's real reply
 * for the answer-key plant, once with the ids as the key writes them (a machine's id is its code) and once with the
 * ids the server sends (UUIDs), so a screen that printed or looked up by an id would show here.
 */
const real = realReply();
const keyed = realReplyWithUuids();

const SCREENS: [string, string, (reply: typeof real) => PrintedPageModel | null][] = [
  ['BD % and PM split', BD_PM, (reply) => bdPmModel(reply, realT)],
  ['Category and cell', CATEGORY_CELL, (reply) => categoryCellModel(reply, realT)],
  ['MTTR and MTBF', MTTR_MTBF, (reply) => mttrMtbfModel(reply, realT)],
];

const printedPage = (reply: typeof real, key: string) =>
  (
    reply.figures.find((figure) => figure.key === key)!.value as {
      pages: { tables: PageTable[] }[];
    }
  ).pages[0]!.tables;

/** Every machine chip a model carries: it names a machine by its code. */
function machineChips(value: unknown, found: { id: string; label: string }[] = []) {
  if (Array.isArray(value)) value.forEach((item) => machineChips(item, found));
  else if (value !== null && typeof value === 'object') {
    const chip = value as { kind?: unknown; id?: unknown; label?: unknown };
    if (chip.kind === 'machine') found.push({ id: String(chip.id), label: String(chip.label) });
    Object.values(value).forEach((inner) => machineChips(inner, found));
  }
  return found;
}

describe('on a plant whose machine ids are UUIDs, as the server sends them', () => {
  it('has re-keyed the plant: the rows behind each page are ids, not codes', () => {
    for (const [, key] of SCREENS)
      expect(keyed.figures.find((figure) => figure.key === key)!.drill.ids.length).toBeGreaterThan(
        0,
      );
    expect(
      keyed.figures
        .find((figure) => figure.key === 'registers')!
        .drill.ids.every((id) => UUID.test(id)),
    ).toBe(true);
  });

  for (const [name, , build] of SCREENS)
    it(`${name}: no database id reaches the screen, and it prints the same words as on the code-keyed plant`, () => {
      const [withUuids, withCodes] = [build(keyed), build(real)];
      expect(withUuids).not.toBeNull();
      expect(JSON.stringify(withUuids)).not.toMatch(UUID);
      expect(printed(withUuids).filter((text) => UUID.test(text))).toEqual([]);
      expect(printed(withUuids)).toEqual(printed(withCodes));
    });

  it('Category and cell, and MTTR and MTBF: every machine row is a chip by code, with the category and cell the plant lists for it', () => {
    const byCode = new Map(ENGINE_DATA.machines.map((machine) => [machine.code, machine]));
    const squash = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase();
    for (const build of [SCREENS[1]![2], SCREENS[2]![2]]) {
      const model = build(keyed)!;
      const chips = machineChips(model);
      expect(chips.length).toBeGreaterThan(100);
      for (const chip of chips) {
        expect(byCode.has(chip.id), chip.id).toBe(true);
        expect(chip.label).toBe(chip.id);
      }
      const machines = model.tables.at(-1)!;
      const category = machines.header.findIndex((head) => head.label === 'Category');
      for (const row of machines.rows) {
        const machine = byCode.get(row[0]!.chips[0]!.id)!;
        expect(squash(row[category]!.text)).toBe(squash(machine.category ?? ''));
      }
    }
  });
});

describe('the charts, as v1 drew them', () => {
  it('names two series in a legend, and gives a chart of one series its series name on the value axis', () => {
    const [cells, months] = bdPmModel(real, realT)!.charts.map((chart) => chart.spec);
    for (const spec of [cells, months]) expect(spec).toMatchObject({ legend: true, draw: true });
    const [categoryHours] = categoryCellModel(real, realT)!.charts.map((chart) => chart.spec);
    expect(categoryHours).toMatchObject({ draw: true, legend: false, valueLabel: 'BD Hrs' });
  });
});

describe('the rows behind each page', () => {
  it('opens the tickets the engine named for the page, from a page action and not from a figure that counts fewer', () => {
    for (const [name, key, build] of SCREENS) {
      const model = build(keyed)!;
      const ids = keyed.figures.find((figure) => figure.key === key)!.drill.ids;
      expect(new Set(ids).size, name).toBe(ids.length);
      expect(model.drill!.figure, name).toBe(key);
      expect(model.drill!.label, name).toBe('See the rows');
      expect(
        model.figures.every((tile) => !('drill' in tile)),
        name,
      ).toBe(true);
    }
  });

  it('opens exactly the breakdowns the page counts: the # Breakdowns column adds up to the rows opened', () => {
    for (const [key, table] of [
      [CATEGORY_CELL, 'By Category — Detail'],
      [MTTR_MTBF, 'By Category'],
    ] as const) {
      const rows = printedPage(real, key).find((candidate) => candidate.title === table)!;
      const at = rows.header.indexOf('# Breakdowns');
      const counted = rows.rows.reduce((sum, row) => sum + Number(row[at]!.replaceAll(',', '')), 0);
      expect(counted, key).toBe(
        real.figures.find((figure) => figure.key === key)!.drill.ids.length,
      );
    }
  });

  it('has no control for a page the engine counted no rows for', () => {
    const empty = {
      ...real,
      figures: real.figures.map((figure) =>
        SCREENS.some(([, key]) => key === figure.key)
          ? { ...figure, drill: { ...figure.drill, ids: [] } }
          : figure,
      ),
    };
    for (const [name, , build] of SCREENS) expect(build(empty)!.drill, name).toBeUndefined();
  });

  it('opens an old ?drill= link of a page on that page, even where the three pages count the same rows', () => {
    for (const [name, key] of SCREENS) {
      const figure = real.figures.find((candidate) => candidate.key === key)!;
      const link = { type: figure.drill.type, ids: figure.drill.ids };
      expect(figureForLegacyDrill(real, link, key), name).toBe(key);
    }
    expect(figureForLegacyDrill(real, { type: 'ticket', ids: ['gone'] }, BD_PM)).toBe(
      NO_SUCH_FIGURE,
    );
  });
});

describe('a plant with no history', () => {
  it('has no page to draw, so each screen says "Not computed yet" and not a blank page', () => {
    const none = {
      ...real,
      figures: real.figures.map((figure) => ({ ...figure, status: 'not_computed' as const })),
    };
    for (const [name, , build] of SCREENS) expect(build(none), name).toBeNull();
  });
});
