import type { Point, Seg } from '../../../ui/v2/points.js';

/**
 * A sentence from a catalogue template: each `{name}` becomes the value given for it, as words or, when the value is a
 * segment, as that segment (a chip, a tone). A name with no value stays as written, so a gap shows.
 */
export function say(template: string, values: Record<string, string | Seg>): Point {
  return template
    .split(/(\{\w+\})/)
    .filter((part) => part !== '')
    .map((part): Seg => {
      const given = /^\{(\w+)\}$/.exec(part);
      const value = given?.[1] !== undefined ? values[given[1]] : undefined;
      return value === undefined
        ? { text: part }
        : typeof value === 'string'
          ? { text: value }
          : value;
    });
}

/** A figure the engine printed, as a strong segment. */
export const strong = (text: string): Seg => ({ text, tone: 'strong' });
