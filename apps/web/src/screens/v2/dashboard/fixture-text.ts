import type { Point, Tone } from '../../../ui/v2/points.js';

/**
 * How the invented gallery data writes a sentence the short way: **bold**, !!loss!!, ++gain++, ~~risk~~. A number
 * and its unit never part at a line end ("~167 h", "₹ 15.59 lakh"): the engine will do the same.
 */
const MARK: Record<string, Tone> = { '**': 'strong', '!!': 'loss', '++': 'gain', '~~': 'risk' };
export const glue = (s: string) =>
  s.replace(/(\d) (?=h\b|min\b|lakh\b|pts\b)/g, '$1 ').replace(/₹ /g, '₹ ');
export const pt = (s: string): Point =>
  glue(s)
    .split(/(\*\*[^*]+\*\*|!![^!]+!!|\+\+[^+]+\+\+|~~[^~]+~~)/)
    .filter(Boolean)
    .map((t) => {
      const tone = MARK[t.slice(0, 2)];
      return tone ? { text: t.slice(2, -2), tone } : { text: t };
    });
export const pts = (...lines: string[]) => lines.map(pt);
