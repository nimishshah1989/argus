/**
 * Puts values into a sentence that arrived from the model or a catalogue: `fill('{n} of {total} decided',
 * { n: 1, total: 4 })` reads "1 of 4 decided". A name with no value is left as written, so a gap shows.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : whole,
  );
}
