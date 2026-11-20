import type { BoardNudgeReply } from '@uptimo/shared';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { Point, Seg } from '../../../ui/v2/points.js';

/**
 * The engine writes database ids into nudge titles and keys (a machine's id is a UUID on a real plant). Everything a
 * reader sees goes through here: an id becomes the machine's code, a name or place becomes a chip, and anything that
 * still looks like an id becomes a dash. Nothing here invents a word; it only renames what the engine sent.
 */
const UUID_ONE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const UUID_ALL = new RegExp(UUID_ONE.source, 'gi');

/** What the plant knows, handed in by the adapter: a code for an id, and a chip for a code, a person or a cell. */
export type Names = {
  codeOf: (machineId: string) => string | null;
  machine: (code: string) => EntityChipProps;
  person: (name: string) => EntityChipProps | null;
  cell: (name: string) => EntityChipProps;
  dash: string;
};

/** The slug a person's chip carries (the entity port finds a person by id or by the slug of the name). */
export const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A short stable word for an id that has no code (a report, a contract line): a hash, never a piece of the id. */
function hashOf(text: string): string {
  let hash = 0x811c9dc5;
  for (const letter of text) hash = Math.imul(hash ^ letter.charCodeAt(0), 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}

/**
 * The address-bar form of a nudge's key (`?drawer=decision:<ref>`): each machine id is its code, any other id a hash,
 * the rest as the engine wrote it. Stable for as long as the nudge is the same nudge.
 */
export function nudgeRef(key: string, codeOf: Names['codeOf']): string {
  return key
    .split('|')
    .map((part) => codeOf(part) ?? (UUID_ONE.test(part) ? hashOf(part) : part))
    .join('~');
}

const escape = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The sentence with each machine id said by its code, and any other id as a dash. */
export function plainTitle(title: string, machines: readonly string[], names: Names): string {
  let text = title;
  // A longer id first, so an id that holds another is not cut short.
  for (const id of [...machines].sort((a, b) => b.length - a.length)) {
    const code = names.codeOf(id) ?? names.dash;
    if (code !== id) text = text.split(id).join(code);
  }
  return text.replace(UUID_ALL, names.dash);
}

const words = (text: string): Seg[] => (text === '' ? [] : [{ text }]);

/** Splits a sentence around the codes it names, each code a machine chip. */
function withMachines(text: string, codes: readonly string[], names: Names): Point {
  const known = [...new Set(codes)].sort((a, b) => b.length - a.length);
  if (known.length === 0) return words(text);
  const found = new RegExp(`(?<![A-Za-z0-9-])(${known.map(escape).join('|')})(?![A-Za-z0-9-])`);
  return text
    .split(found)
    .flatMap((part, at) =>
      at % 2 === 1 ? [{ text: part, entity: names.machine(part) }] : words(part),
    );
}

/** What a nudge's own key says about its subject: the cell of a cell nudge, the person of a team nudge. */
function subjectOf(nudge: BoardNudgeReply): { cell?: string; person?: string } {
  const [, ...rest] = nudge.key.split('|');
  if (nudge.rule === 'cell' && rest[0]) return { cell: rest[0] };
  if (nudge.rule === 'team' && rest.length > 0) return { person: rest.join('|') };
  return {};
}

/**
 * The engine's sentence as a point: every machine named in it a chip, the cell of a cell nudge and the person of a
 * team nudge too (a person only when the plant lists them). The plain form is `plainTitle`.
 */
export function titlePoint(nudge: BoardNudgeReply, names: Names): Point {
  const codes = nudge.machines.flatMap((id) => {
    const code = names.codeOf(id);
    return code === null ? [] : [code];
  });
  const text = plainTitle(nudge.title, nudge.machines, names);
  const { cell, person } = subjectOf(nudge);
  const chip = person ? names.person(person) : null;
  if (chip && text.startsWith(person!))
    return [
      { text: chip.label, entity: chip },
      ...withMachines(text.slice(person!.length), codes, names),
    ];
  // The engine writes the word "Cell", a space, then the cell's name.
  const word = /^\S+\s/.exec(text)?.[0] ?? '';
  if (cell && word !== '' && text.startsWith(word + cell)) {
    const here = names.cell(cell);
    return [
      ...words(word),
      { text: here.label, entity: here },
      ...withMachines(text.slice(word.length + cell.length), codes, names),
    ];
  }
  return withMachines(text, codes, names);
}
