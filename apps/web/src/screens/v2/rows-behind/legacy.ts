import type { DrillType, FiguresReply } from '@uptimo/shared/analytics';
import { searchWithFigure } from '../entity/url.js';

/** What a v1 link carried in `?drill=`: the kind of row and the ids behind the figure the link was made on. */
export type LegacyDrill = { type: DrillType; ids: readonly string[] };

/** The figure a drawer link names when nothing of the plant's matches the old link: the panel then says it has no rows. */
export const NO_SUCH_FIGURE = 'drill';

const sameRows = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join('\n') === [...b].sort().join('\n');

/**
 * The figure whose rows an old `?drill=<type>:<ids>` link opened. v1 made those links from a figure's own ids, so the
 * figure is the one whose engine ids are the same rows: the screen's own figure first, then any other. A link whose
 * rows no figure counts today (a stale or hand-written one) names none, so the rows panel says it has nothing.
 */
export function figureForLegacyDrill(
  reply: Pick<FiguresReply, 'figures'>,
  asked: LegacyDrill,
  screen: string,
): string {
  const matches = reply.figures.filter(
    (figure) =>
      figure.status === 'ready' &&
      figure.drill.type === asked.type &&
      sameRows(figure.drill.ids, asked.ids),
  );
  return (matches.find((figure) => figure.key === screen) ?? matches[0])?.key ?? NO_SUCH_FIGURE;
}

/**
 * The address an old `?drill=` link becomes: the same page, the `drill` parameter gone and the rows panel open on the
 * figure (`?drawer=figure:<key>`), every other parameter as it was written.
 */
export function searchForLegacyDrill(search: string, figure: string): string {
  const kept = search
    .replace(/^\?/, '')
    .split('&')
    .filter((part) => part !== '' && part.split('=')[0] !== 'drill');
  return searchWithFigure(kept.length > 0 ? `?${kept.join('&')}` : '', figure);
}
