import type { EntityKind } from '../../../ui/v2/entity-chip.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import type { Point, Seg, Tone } from '../../../ui/v2/points.js';
import { TYPES } from './types.js';

/**
 * How the invented gallery data writes a sentence the short way: **bold**, !!loss!!, ++gain++, ~~risk~~. A number
 * and its unit never part at a line end ("~167 h", "₹ 15.59 lakh"): the engine will do the same. A machine, cell, person or
 * decision is written {{kind:id|label}}, `{{machine:TC-12|TC-12}}`, and becomes a segment that prints as a chip.
 */
const MARK: Record<string, Tone> = { '**': 'strong', '!!': 'loss', '++': 'gain', '~~': 'risk' };
export const glue = (s: string) =>
  s.replace(/(\d) (?=h\b|min\b|lakh\b|pts\b)/g, '$1 ').replace(/₹ /g, '₹ ');
const ENTITY = /^\{\{(machine|cell|person|decision):([^|}]+)\|([^}]+)\}\}$/;
/** A machine wears its type's colour; the letters before the dash say the type. */
const catOf = (id: string): number | undefined =>
  (TYPES as Record<string, { cat: number } | undefined>)[id.split('-')[0]!]?.cat;
const seg = (t: string): Seg => {
  const e = ENTITY.exec(t);
  if (e) {
    const [, kind, id, label] = e as unknown as [string, EntityKind, string, string];
    return {
      text: label,
      entity: { kind, id, label, cat: kind === 'machine' ? catOf(id) : undefined },
    };
  }
  const tone = MARK[t.slice(0, 2)];
  return tone ? { text: t.slice(2, -2), tone } : { text: t };
};
/** A machine as a chip, in its type's colour: for a field that holds the chip itself rather than a sentence. */
export const chip = (code: string): EntityChipProps => ({
  kind: 'machine',
  id: code,
  label: code,
  cat: catOf(code),
});
export const pt = (s: string): Point =>
  glue(s)
    .split(/(\*\*[^*]+\*\*|!![^!]+!!|\+\+[^+]+\+\+|~~[^~]+~~|\{\{[^}]+\}\})/)
    .filter(Boolean)
    .map(seg);
export const pts = (...lines: string[]) => lines.map(pt);
