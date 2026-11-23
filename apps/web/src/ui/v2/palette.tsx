import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { filterEntries, type PaletteEntry } from './palette-match.js';

function Options({
  shown,
  at,
  listId,
  setActive,
  onPick,
}: {
  shown: readonly PaletteEntry[];
  at: number;
  listId: string;
  setActive: (i: number) => void;
  onPick: (to: string) => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    document.getElementById(`${listId}-${at}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [at, listId]);
  return (
    <>
      <ul
        id={listId}
        role="listbox"
        aria-label={t('ashell.search.results')}
        className="v2-pal-list"
      >
        {shown.map((row, i) => (
          <li
            key={`${row.to}|${row.hint}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === at}
            data-active={i === at}
            onMouseMove={() => setActive(i)}
            onClick={() => onPick(row.to)}
          >
            <span>{row.text}</span>
            <span className="v2-pal-hint">{row.hint}</span>
          </li>
        ))}
      </ul>
      <div role="status">
        {shown.length === 0 ? <p className="v2-pal-none">{t('ashell.search.none')}</p> : null}
      </div>
    </>
  );
}

/**
 * The search over the app's own pages (Ctrl or Cmd K): a filter box, arrows to move, Enter to go, Esc or a click
 * outside to close. The box is the dialog's only stop: Tab is held there. The list is a listbox the box controls,
 * and "Nothing matches" is announced when a query leaves no rows.
 */
export function Palette({
  entries,
  onPick,
  onClose,
}: {
  entries: readonly PaletteEntry[];
  onPick: (to: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const shown = useMemo(() => filterEntries(entries, query), [entries, query]);
  const at = Math.min(active, Math.max(shown.length - 1, 0));
  useEffect(() => input.current?.focus(), []);

  const onKey = (e: KeyboardEvent) => {
    const last = shown.length - 1;
    if (e.key === 'Enter') {
      e.preventDefault(); // or the control that gets focus next would be pressed by this same key
      if (shown[at]) onPick(shown[at].to);
    } else if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') setActive(at >= last ? 0 : at + 1);
    else if (e.key === 'ArrowUp') setActive(at <= 0 ? last : at - 1);
    if (e.key !== 'Enter' && ['Escape', 'ArrowDown', 'ArrowUp', 'Tab'].includes(e.key))
      e.preventDefault();
  };
  return (
    <div className="v2-pal-scrim" onMouseDown={onClose}>
      <div
        className="v2-pal"
        role="dialog"
        aria-modal="true"
        aria-label={t('ashell.search.title')}
        data-testid="shell-palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <input
          ref={input}
          className="v2-pal-input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={shown.length ? `${listId}-${at}` : undefined}
          aria-label={t('ashell.search.input')}
          placeholder={t('ashell.search.input')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
        />
        <Options shown={shown} at={at} listId={listId} setActive={setActive} onPick={onPick} />
      </div>
    </div>
  );
}
