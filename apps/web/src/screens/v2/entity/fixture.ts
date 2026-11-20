import { fill } from '../../../i18n/fill.js';
import type { CellDetailData } from '../../../ui/v2/domain/cell-detail.js';
import type { PersonDetailData } from '../../../ui/v2/domain/person-detail.js';
import type { CellData, MachineState } from '../../../ui/v2/domain/plant.js';
import type { EntityChipProps, EntityRef } from '../../../ui/v2/entity-chip.js';
import { dashboardFixture as plant } from '../dashboard/fixture.js';
import { chip, glue } from '../dashboard/fixture-text.js';
import type { EntityModel } from './model.js';
import { cellWords, personWords } from './fixture-words.js';

/**
 * The drawer's invented gallery data, built from the Dashboard's machines, cells and decisions so every figure
 * agrees with the page it opens from, plus a short list of invented people. A cell's hours are its machines' added up.
 */
const { source, words } = plant;
const machines = plant.cells.flatMap((c) => c.machines);
const SHOWN: MachineState[] = ['down', 'risk', 'pm', 'idle', 'run'];
const RUNNING = '{n} running';

const hoursText = (tenths: number) => glue(`${(tenths / 10).toFixed(1)} h`);

function cellDetail(cell: CellData): CellDetailData {
  const tenths = cell.machines.reduce((s, m) => s + Math.round(m.hours.value * 10), 0);
  const count = (state: MachineState) => cell.machines.filter((m) => m.state === state).length;
  const part = (state: MachineState) =>
    fill(state === 'run' ? RUNNING : words.plant.cellCounts[state], { n: count(state) });
  const worst = [...cell.machines]
    .filter((m) => m.hours.value > 0)
    .sort((a, b) => b.hours.value - a.hours.value)
    .slice(0, 3);
  return {
    name: cell.name,
    machineCount: glue(`${cell.machines.length} machines`),
    mix: SHOWN.filter((s) => count(s) > 0).map((state) => ({ state, text: part(state) })),
    hours: { shown: hoursText(tenths), value: tenths / 10 },
    worst: worst.map((m) => ({ chip: chip(m.code), hours: m.hours.shown })),
  };
}

const decisionChip = (id: string): EntityChipProps => ({
  kind: 'decision',
  id,
  label: plant.decisions.find((d) => d.id === id)!.title,
});

const PEOPLE: (PersonDetailData & { id: string })[] = [
  {
    id: 'neel-s',
    name: 'Neel S',
    role: 'Maintenance technician',
    now: [{ chip: chip('TC-4'), note: 'Spindle alarm, down for 2 h 40 min' }],
    jobs: '14',
    hours: hoursText(312),
  },
  {
    id: 'arjun-v',
    name: 'Arjun V',
    role: 'Senior technician',
    now: [
      { chip: decisionChip('axis'), note: 'Suggested owner of the fix' },
      { chip: chip('VC-67'), note: 'Axis motor check' },
    ],
    jobs: '11',
    hours: hoursText(286),
  },
  {
    id: 'meera-k',
    name: 'Meera K',
    role: 'Shift supervisor',
    now: [],
    jobs: '9',
    hours: hoursText(274),
  },
];

const models = new Map<string, EntityModel>();
const put = (m: EntityModel) => models.set(`${m.kind}:${m.id}`, m);

for (const m of machines)
  put({
    kind: 'machine',
    id: m.code,
    label: m.name,
    source,
    machine: m,
    words: words.machineDetail,
  });
for (const c of plant.cells)
  put({ kind: 'cell', id: c.name, label: c.name, source, cell: cellDetail(c), words: cellWords });
for (const d of plant.decisions)
  put({
    kind: 'decision',
    id: d.id,
    label: d.title,
    source,
    decision: d,
    words: words.decisionDetail,
  });
for (const p of PEOPLE)
  put({ kind: 'person', id: p.id, label: p.name, source, person: p, words: personWords });

/** The drawer's model for a machine, cell, person or decision of the invented plant; nothing for one it does not have. */
export const entityFixture = ({ kind, id }: EntityRef): EntityModel | null =>
  models.get(`${kind}:${id}`) ?? null;
