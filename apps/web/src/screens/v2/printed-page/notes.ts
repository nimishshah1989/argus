import type { PageChart } from './page-model.js';
import type { PrintedTable } from './table.js';

/**
 * The explanation the platform printed under a chart or a table, set where the reader looks: the chart's quiet line, the
 * table's note under its title. A chart is found by its title and a table by the start of its (printed) title, so a
 * note can only land on something the page draws; a paired matrix is two tables and takes its note once, on the first.
 */
export function chartNotes(charts: PageChart[], notes: Record<string, string>): PageChart[] {
  return charts.map((chart) => {
    const note = notes[chart.spec.title];
    return note === undefined ? chart : { ...chart, sub: note };
  });
}

export function tableNotes(tables: PrintedTable[], notes: [titleStart: string, note: string][]) {
  const done = new Set<string>();
  return tables.map((table) => {
    const found = notes.find(([start]) => !done.has(start) && table.title.startsWith(start));
    if (found === undefined) return table;
    done.add(found[0]);
    return { ...table, note: found[1] };
  });
}
