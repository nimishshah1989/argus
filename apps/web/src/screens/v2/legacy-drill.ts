import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { parseDrill } from '../analytics/groups.js';
import { liveReply } from './figures/live.js';
import { searchWithFigure } from './entity/url.js';

type Figure = FiguresReply['figures'][number];

/** The figure of this screen whose rows a v1 link named: the one counting exactly those ids, else the screen's first. */
export function figureForLink(
  figures: readonly Figure[],
  screen: string,
  link: { ids: readonly string[] },
): string | null {
  const own = figures.filter((figure) => figure.screen === screen && figure.status === 'ready');
  const wanted = new Set(link.ids);
  const same = own.find(
    (figure) =>
      figure.drill.ids.length === wanted.size && figure.drill.ids.every((id) => wanted.has(id)),
  );
  return (same ?? own[0])?.key ?? null;
}

/**
 * An old v1 address (`?drill=machine:<ids>`) on a screen that is now v2: the link's rows open in the drawer, as the
 * figure that counted them, and the old parameter goes. A link whose figure is gone just loses the parameter.
 */
export function useLegacyDrill(screen: string): void {
  const client = useQueryClient();
  const navigate = useNavigate();
  const { search } = useLocation();
  const raw = new URLSearchParams(search).get('drill');
  useEffect(() => {
    if (raw === null) return;
    const link = parseDrill(raw);
    const rest = new URLSearchParams(search);
    rest.delete('drill');
    const go = (figure: string | null) =>
      navigate({ search: searchWithFigure(`?${rest.toString()}`, figure) }, { replace: true });
    if (link === null) {
      go(null);
      return;
    }
    void liveReply(client)
      .then((reply) => go(figureForLink(reply.figures, screen, link)))
      .catch(() => go(null));
  }, [raw, search, screen, client, navigate]);
}
