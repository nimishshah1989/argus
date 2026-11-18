import { readFileSync } from 'node:fs';

/**
 * The answer key's typed readers (ticket 41, packet 41h). The key's page shapes live here because the fixture
 * that builds `ENGINE_DATA` is at its line budget; `fixture.ts` re-exports all of this, so a test keeps one
 * import (`./answer-key/fixture.js`). Every key here was frozen from the same 11 November workbook
 * `ENGINE_DATA` holds.
 */

/** The answer key read by file name from the repo's frozen `fixtures/answer-key/`. */
export function read<T>(name: string): T {
  const url = new URL(`../../../../fixtures/answer-key/${name}`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as T;
}

export interface DashboardKpi {
  label: string;
  value: string;
  sub: string;
}

export interface DashboardDataset {
  label: string;
  data: unknown[];
}

/** One chart as the platform drew it: the series and the axes, with the canvas type dropped. */
export interface DashboardChart {
  id: string;
  axes: Record<string, string>;
  tickLabels: Record<string, string[]>;
  labels: unknown[];
  datasets: DashboardDataset[];
}

/** One table of a breakdown figure's page, as the platform printed it. */
export interface KeyTable {
  title: string;
  header: string[];
  rows: string[][];
  rowCount: number;
  /** The log prints its newest rows only; `rowCount` still counts the whole log. */
  truncated?: boolean;
}

export interface KeyFigurePage {
  page: string;
  title: string;
  kpis: DashboardKpi[];
  tables: KeyTable[];
  charts: DashboardChart[];
}

/** One breakdown figure's printed page, whole: the values are the platform's own text, never a tolerance. */
export interface FigureKey {
  screen: string;
  asOf: string;
  pages: KeyFigurePage[];
}

/** A figure that prints more than its page: A5's heat grids and its efficiency factor sit beside it. */
export interface FigureExtraKey<TExtra> extends FigureKey {
  extra: TExtra;
}

/** One heat-grid cell (or location): the machines in it and the platform's own KVA arithmetic, raw floats kept. */
export interface EnergyBucket {
  key: string;
  machines: number;
  totalKva: number;
  avgKva: number;
  runningKva: number;
  avgRunningKva: number;
  machineIds: string[];
}

/** A5's payload: the two grids by settings cell and location, and the profile's efficiency factor as a percent. */
export interface EnergyExtra {
  byCell: EnergyBucket[];
  byLocation: EnergyBucket[];
  effFactorPct: number;
}

export type EnergyKey = FigureExtraKey<EnergyExtra>;

/** The four figures of ticket 41, frozen on 2026-11-11 (the same workbook `ENGINE_DATA` holds). */
export const A4: FigureKey = read<FigureKey>('a4-manpower.json');
export const A5: EnergyKey = read<EnergyKey>('a5-energy.json');
export const A6: FigureKey = read<FigureKey>('a6-why-why.json');
export const A10: FigureKey = read<FigureKey>('a10-problems.json');
