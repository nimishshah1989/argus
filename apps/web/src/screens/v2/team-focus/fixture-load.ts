import { entityFixture } from '../entity/fixture.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import { glue, pt } from '../fixtures/text.js';
import { OVERLOAD, RATE, type Raw } from './fixture-actions.js';
import type { Load, PersonLoad, Rebalance } from './model.js';

/** The three people of the invented plant, in the order they are listed; their names and roles come from the drawer's port. */
export const PEOPLE = ['arjun-v', 'neel-s', 'meera-k'] as const;
type Who = (typeof PEOPLE)[number];

export const isOpen = (r: Raw) => r.status === 'todo' || r.status === 'doing';
export const sum = (rows: Raw[]) => rows.reduce((s, r) => s + r.tenths, 0);
export const hoursText = (tenths: number) => glue(`${(tenths / 10).toFixed(1)} h`);
/** ₹ lakh a year: the month's hours, twelve times, at the plant's rate. */
export const lakhYear = (tenths: number, digits = 2) =>
  glue(`₹ ${(((tenths / 10) * 12 * RATE) / 100000).toFixed(digits)} lakh`);

function personOf(id: string) {
  const m = entityFixture({ kind: 'person', id });
  if (m?.kind !== 'person') throw new Error(`no invented person ${id}`);
  return { name: m.person.name, role: m.person.role };
}
export const nameOf = (id: string) => personOf(id).name;
export const chipOf = (id: string): EntityChipProps => ({
  kind: 'person',
  id,
  label: nameOf(id),
});
/** A person written into a sentence, to be printed as a chip. */
export const mark = (id: string) => `{{person:${id}|${nameOf(id)}}}`;

const loadOf = (open: number): Load => (open >= OVERLOAD ? 'over' : open <= 3 ? 'room' : 'ok');
const LOAD_LABEL: Record<Load, string> = {
  over: 'Overloaded',
  ok: 'On track',
  room: 'Has room',
};

/** Each person's open and closed actions, the hours the open ones win back, and where that leaves them. */
export function loads(raw: Raw[]): PersonLoad[] {
  return PEOPLE.map((id) => {
    const mine = raw.filter((r) => r.owner === id);
    const open = mine.filter(isOpen);
    const load = loadOf(open.length);
    return {
      chip: chipOf(id),
      role: personOf(id).role,
      open: open.length,
      hours: { shown: hoursText(sum(open)), value: sum(open) / 10 },
      done: mine.length - open.length,
      load,
      loadLabel: LOAD_LABEL[load],
    };
  });
}

/**
 * Who should take each unowned action: the least loaded person under the line, one after another, so the
 * suggestions spread out instead of piling on one name.
 */
export function suggestions(raw: Raw[], unowned: Raw[]): Map<string, Who> {
  const open = new Map<Who, number>(
    PEOPLE.map((id) => [id, raw.filter((r) => r.owner === id && isOpen(r)).length]),
  );
  const out = new Map<string, Who>();
  for (const r of unowned) {
    const free = [...open].filter(([, n]) => n < OVERLOAD).sort((a, b) => a[1] - b[1]);
    const [id, n] = free[0]!;
    out.set(r.id, id);
    open.set(id, n + 1);
  }
  return out;
}

/** What to take off the one person over the line: their smallest not-started actions, down to one under the line. */
export function rebalance(raw: Raw[], people: PersonLoad[]): Rebalance | null {
  const over = people.find((p) => p.load === 'over');
  if (!over) return null;
  const excess = over.open - (OVERLOAD - 1);
  const move = raw
    .filter((r) => r.owner === over.chip.id && r.status === 'todo')
    .sort((a, b) => a.tenths - b.tenths)
    .slice(0, excess);
  const takers = people.filter((p) => p.load !== 'over').sort((a, b) => a.open - b.open);
  const share = Math.round((over.open / people.reduce((s, p) => s + p.open, 0)) * 100);
  const smallest = move.map((r) => `**${r.title}** (${hoursText(r.tenths)} a month)`).join(' and ');
  return {
    title: `Take ${excess} actions off ${over.chip.label}`,
    points: [
      pt(
        `${mark(over.chip.id)} has **${over.open} open actions**, !!${share}%!! of the team's open work`,
      ),
      pt(takers.map((p) => `${mark(p.chip.id)} has **${p.open}**`).join(', ')),
      pt(`The smallest not started: ${smallest}`),
    ],
    action: `Move ${excess} to ${takers.map((p) => p.chip.label).join(' and ')}`,
    doneText: `Moved ${excess} actions`,
    done: false,
  };
}
