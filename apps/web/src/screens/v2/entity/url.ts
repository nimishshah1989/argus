import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { EntityKind, EntityRef } from '../../../ui/v2/entity-chip.js';

const PARAM = 'drawer';
const KINDS: readonly string[] = ['machine', 'cell', 'person', 'decision'] satisfies EntityKind[];

/** The thing a URL's query asks the drawer to show: `?drawer=machine:TC-12`. An unknown kind or a malformed value asks for nothing. */
export function entityFrom(search: string): EntityRef | null {
  const value = new URLSearchParams(search).get(PARAM) ?? '';
  const at = value.indexOf(':');
  const kind = value.slice(0, at);
  const id = value.slice(at + 1);
  return at > 0 && id !== '' && KINDS.includes(kind) ? { kind: kind as EntityKind, id } : null;
}

/** The query with the drawer set to `ref` (or removed); every other parameter stays as it was written. */
export function searchWith(search: string, ref: EntityRef | null): string {
  const rest = search.replace(/^\?/, '').split('&');
  const kept = rest.filter((part) => part !== '' && part.split('=')[0] !== PARAM);
  const drawer = ref ? [`${PARAM}=${ref.kind}:${encodeURIComponent(ref.id)}`] : [];
  const query = [...kept, ...drawer].join('&');
  return query ? `?${query}` : '';
}

/** Marks a history entry as the one that opened the drawer, so closing can go Back instead of piling up entries. */
const OURS = { drawer: 1 };
const isOurs = (state: unknown) => (state as typeof OURS | null)?.drawer === OURS.drawer;

/**
 * The drawer's state lives in the URL, so the browser's Back and Forward move it. Opening from closed adds one
 * history entry; opening another thing while one is open replaces it, so one Back closes however many were visited.
 * Closing goes Back when the open was ours, and otherwise (a pasted link) removes the parameter in place.
 */
export function useEntityParam(): {
  current: EntityRef | null;
  open: (ref: EntityRef) => void;
  close: () => void;
} {
  const { search, state } = useLocation();
  const navigate = useNavigate();
  const current = entityFrom(search);
  const back = useRef(false);
  useEffect(() => {
    back.current = false;
  }, [search]);
  return {
    current,
    open: (ref) =>
      current
        ? navigate({ search: searchWith(search, ref) }, { replace: true, state })
        : navigate({ search: searchWith(search, ref) }, { state: OURS }),
    // Back is sent once until the address changes: a double press must not step out of the page.
    close: () => {
      if (!isOurs(state))
        return navigate({ search: searchWith(search, null) }, { replace: true, state });
      if (back.current) return;
      back.current = true;
      navigate(-1);
    },
  };
}
