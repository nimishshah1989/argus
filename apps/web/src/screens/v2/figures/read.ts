import type { FiguresReply } from '@uptimo/shared/analytics';
import { canMoney, type Role } from '@uptimo/domain';
import { registerPages, type RegisterPage } from '../../analytics/machine-values.js';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import { fill } from '../../../i18n/fill.js';

export type { RegisterPage, RegisterKpi, RegisterTable } from '../../analytics/machine-values.js';
export type Figure = FiguresReply['figures'][number];

/** The words a screen asks the catalogue for: a key and its values in, the reader's sentence out. */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The engine's own pages of one figure, or null when the figure is absent or not computed yet. */
export function pagesOf(reply: FiguresReply, key: string): RegisterPage[] | null {
  const figure = reply.figures.find((candidate) => candidate.key === key);
  if (figure?.status !== 'ready') return null;
  const pages = registerPages(figure.value);
  return pages.length > 0 ? pages : null;
}

/** The first number a printed figure holds ("1,136.5 hrs" is 1136.5); null when it holds none. It places a mark or sorts, never replaces the print. */
export function numberIn(printed: string): number | null {
  const found = /-?\d[\d,]*(?:\.\d+)?/.exec(printed);
  return found ? Number(found[0].replaceAll(',', '')) : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A plant day (`2026-11-11`) as the plant reads it: `11-Nov-2026`. Anything else stays as it came. */
export function dayText(day: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const month = iso ? MONTHS[Number(iso[2]) - 1] : undefined;
  return iso && month ? `${iso[3]}-${month}-${iso[1]}` : day;
}

/** The quiet line under a screen: where the figures came from and the day they are for. */
export const sourceLine = (template: string, asOf: string): string =>
  fill(template, { date: dayText(asOf) });

/** A machine type's colour, the same everywhere: one of the five categorical colours, by its name. */
export function catOf(category: string): number {
  let hash = 0;
  for (const letter of category.toLowerCase()) hash = (hash * 31 + letter.charCodeAt(0)) % 997;
  return (hash % 5) + 1;
}

/** A machine as a chip: its code in its type's colour. */
export const machineChip = (code: string, category?: string): EntityChipProps => ({
  kind: 'machine',
  id: code,
  label: code,
  ...(category ? { cat: catOf(category) } : {}),
});

/** The server's own money rule (head, plant head, admin), so the screen and the engine never disagree. */
export function mayReadMoney(role: string | undefined): boolean {
  return (
    role !== undefined &&
    canMoney({ role: role as Role, loginId: '', personId: null, shared: false, cell: null })
  );
}

/** A printed line without its rupee clauses ("56% of the hours; ₹ 59,994 to claim" keeps "56% of the hours"); null when nothing is left. */
export function withoutMoney(printed: string): string | null {
  const kept = printed
    .split(/;\s*/)
    .filter((clause) => !clause.includes('₹'))
    .join('; ')
    .trim();
  return kept === '' ? null : kept;
}
