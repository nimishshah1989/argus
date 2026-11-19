import snapshot from './generated/figures.json' with { type: 'json' };

/** The day the plant's snapshot was taken, as the answer key states it (`2026-11-11`). */
export const AS_OF: string = snapshot.asOf;

/** One figure of the snapshot, by its key (for example `dashboard.total-breakdowns`). */
export function figure<T>(key: string): T {
  return snapshot.figures.find((f) => f.key === key)?.value as T;
}

export interface Table {
  title: string;
  header: string[];
  rows: string[][];
}

export interface PlantChart {
  id: string;
  labels: string[];
  datasets: { label: string; data: (number | null)[] }[];
}

interface ReportScreen {
  pages: { tables: Table[]; charts: PlantChart[] }[];
}

/** The tables of a report screen's first page, in the order the screen prints them. */
export const tablesOf = (key: string): Table[] => figure<ReportScreen>(key).pages[0]!.tables;

/** One chart of a report screen's first page, by its id. */
export const chartOf = (key: string, id: string): PlantChart =>
  figure<ReportScreen>(key).pages[0]!.charts.find((c) => c.id === id)!;

/** A table cell read back as a number: `1,057.79`, `5,65,692.47` and `15.85%` all work. */
export const cellNumber = (text: string): number => Number(text.replace(/[,%]/g, ''));

/** The months of the snapshot's year that have a figure: January to the month of `AS_OF`. */
export const monthsSoFar = (): number => Number(AS_OF.slice(5, 7));
