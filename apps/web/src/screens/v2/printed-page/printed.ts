import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { EntityChipProps } from '../../../ui/v2/entity-chip.js';
import { contentOf, type FigureContent } from '../../analytics/figure-content.js';

/**
 * What every v2 screen built on one of the engine's printed pages shares: the page of a figure, a printed date or
 * number read for placing and sorting, and the chips a printed code or name becomes. The engine's own strings are
 * what a screen prints; the readings here only place a mark or order a column (UX-RULES.md rule 29).
 */

export type Figure = FiguresReply['figures'][number];
/** What an adapter reads of the engine's reply: the date it ran for and its figures. */
export type FiguresPart = Pick<FiguresReply, 'asOf' | 'figures'>;
export type Page = Extract<FigureContent, { kind: 'page' }>;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The figure a screen is built from, by its key; undefined when the reply has none. */
export const figureOf = (reply: FiguresPart, key: string): Figure | undefined =>
  reply.figures.find((figure) => figure.key === key);

/** The printed page of a ready figure, or null when the engine had nothing to say (not computed, or an empty plant). */
export function pageOf(figure: Figure | undefined, t: TFunction): Page | null {
  if (figure === undefined || figure.status !== 'ready') return null;
  const content = contentOf(figure, t);
  return content?.kind === 'page' ? content : null;
}

/** `26-10-2026` or `2026-10-26` as `26-Oct-2026`; anything else stays as printed. */
export function shortDate(printed: string): string {
  const day = /^(\d{2})-(\d{2})-(\d{4})$/.exec(printed);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(printed);
  const [d, m, y] = day ? [day[1], day[2], day[3]] : iso ? [iso[3], iso[2], iso[1]] : [];
  const month = m === undefined ? undefined : MONTHS[Number(m) - 1];
  return d === undefined || month === undefined || y === undefined ? printed : `${d}-${month}-${y}`;
}

/** A printed date as a number that sorts by day (`20261026`); 0 when it is not a date. */
export function dayValue(printed: string): number {
  const day = /^(\d{2})-(\d{2})-(\d{4})$/.exec(printed);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(printed);
  const parts = day ? [day[3], day[2], day[1]] : iso ? [iso[1], iso[2], iso[3]] : null;
  return parts ? Number(parts.join('')) : 0;
}

/** A printed number (`1,234.5`, `73%`, `1.3 hrs`) read for ordering; NaN-safe: a dash or words sort as -1. */
export function numberValue(printed: string): number {
  const found = /-?\d[\d,]*(\.\d+)?/.exec(printed.replaceAll('−', '-'));
  return found ? Number(found[0].replaceAll(',', '')) : -1;
}

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** A printed machine code as the chip that opens it. The pages print codes, not ids, so the code is the id. */
export const machineChip = (code: string): EntityChipProps => ({
  kind: 'machine',
  id: code,
  label: code,
});

/** A printed cell name as the chip that opens it. The pages print names, not ids, so the name is the id. */
export const cellChip = (name: string): EntityChipProps => ({
  kind: 'cell',
  id: name,
  label: name,
});

/** A printed person's name as the chip that opens them (the pages print names, not ids). */
export const personChip = (name: string): EntityChipProps => ({
  kind: 'person',
  id: slug(name),
  label: name,
});

/** `Person 11, Person 46` as one chip each; a dash or nothing is nobody. */
export function personChips(printed: string): EntityChipProps[] {
  return printed
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name !== '' && name !== '—' && name !== '-')
    .map(personChip);
}
