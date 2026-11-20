import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const PARAM = 'drawer';
const PREFIX = 'figure:';
/** The same mark the entity drawer leaves on the history entry that opened it, so one Back closes either. */
const OURS = { drawer: 1 };
const isOurs = (state: unknown) => (state as typeof OURS | null)?.drawer === OURS.drawer;

/** The figure a URL's query asks the drawer to show: `?drawer=figure:dashboard.pm-hours`; anything else asks for none. */
export function figureFrom(search: string): string | null {
  const value = new URLSearchParams(search).get(PARAM) ?? '';
  return value.startsWith(PREFIX) && value.length > PREFIX.length
    ? value.slice(PREFIX.length)
    : null;
}

/** The query with the drawer set to `figure` (or removed); every other parameter stays as it was written. */
export function searchWithFigure(search: string, figure: string | null): string {
  const kept = search
    .replace(/^\?/, '')
    .split('&')
    .filter((part) => part !== '' && part.split('=')[0] !== PARAM);
  const drawer = figure === null ? [] : [`${PARAM}=${PREFIX}${encodeURIComponent(figure)}`];
  const query = [...kept, ...drawer].join('&');
  return query ? `?${query}` : '';
}

/**
 * The rows-behind drawer's state in the URL, with the entity drawer's rules: opening from closed adds one history
 * entry, opening while another drawer is open replaces it, and closing goes Back when the open was ours, so the
 * browser's Back closes it and never leaves a dead entry.
 */
export function useFigureParam(): {
  current: string | null;
  open: (figure: string) => void;
  close: () => void;
} {
  const { search, state } = useLocation();
  const navigate = useNavigate();
  const sent = useRef(false);
  useEffect(() => {
    sent.current = false;
  }, [search]);
  const anyOpen = new URLSearchParams(search).has(PARAM);
  return {
    current: figureFrom(search),
    open: (figure) =>
      anyOpen
        ? navigate({ search: searchWithFigure(search, figure) }, { replace: true, state })
        : navigate({ search: searchWithFigure(search, figure) }, { state: OURS }),
    close: () => {
      if (!isOurs(state))
        return navigate({ search: searchWithFigure(search, null) }, { replace: true, state });
      if (sent.current) return;
      sent.current = true;
      navigate(-1);
    },
  };
}
