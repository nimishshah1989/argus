import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { searchEntries, type SearchEntry, type ShellSection } from './shell-data.js';

interface Row extends SearchEntry {
  text: string;
  hint: string;
  match: string;
}

/** What the palette lists for what was typed, and which row is lit. */
function useRows(sections: readonly ShellSection[]) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const all = useMemo<Row[]>(
    () =>
      searchEntries(sections).map((entry) => {
        const text = t(entry.name);
        const parent = entry.section ? t(entry.section) : '';
        return {
          ...entry,
          text,
          hint: entry.section
            ? t('ashell.search.screen', { section: parent })
            : t('ashell.search.section'),
          match: `${text} ${parent}`.toLowerCase(),
        };
      }),
    [sections, t],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((row) => row.match.includes(q)) : all;
  }, [all, query]);
  const at = Math.min(active, Math.max(shown.length - 1, 0));
  return { query, setQuery, setActive, shown, at };
}

function Options({
  list,
  listId,
  onPick,
}: {
  list: ReturnType<typeof useRows>;
  listId: string;
  onPick: (row: Row) => void;
}) {
  const { t } = useTranslation();
  const { shown, at, setActive } = list;
  useEffect(() => {
    document.getElementById(`${listId}-${at}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [at, listId]);
  return (
    <>
      <ul
        id={listId}
        role="listbox"
        aria-label={t('ashell.search.results')}
        className="as-pal-list"
      >
        {shown.map((row, i) => (
          <li
            key={`${row.to}|${row.section ?? ''}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === at}
            data-active={i === at}
            onMouseMove={() => setActive(i)}
            onClick={() => onPick(row)}
          >
            <span>{row.text}</span>
            <span className="as-pal-hint">{row.hint}</span>
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="as-pal-none">{t('ashell.search.none')}</p> : null}
    </>
  );
}

/** The Ctrl or Cmd K search: a filter box over the real routes, arrows to move, Enter to go, Esc to close. */
export function ShellPalette({
  sections,
  onPick,
  onClose,
}: {
  sections: readonly ShellSection[];
  onPick: (to: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = useRows(sections);
  const { shown, at, query, setQuery, setActive } = list;
  useEffect(() => input.current?.focus(), []);

  const onKey = (e: KeyboardEvent) => {
    const last = shown.length - 1;
    if (e.key === 'Enter') {
      e.preventDefault(); // or the button that gets focus next would be pressed by this same key
      if (shown[at]) onPick(shown[at].to);
      return;
    }
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') setActive(at >= last ? 0 : at + 1);
    else if (e.key === 'ArrowUp') setActive(at <= 0 ? last : at - 1);
    else if (e.key !== 'Tab') return; // Tab is held: the box is the only stop in the dialog
    e.preventDefault();
  };
  return (
    <div className="as-scrim as-scrim-pal" onMouseDown={onClose}>
      <div
        className="as-pal"
        role="dialog"
        aria-modal="true"
        aria-label={t('ashell.search.title')}
        data-testid="shell-palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <input
          ref={input}
          className="as-pal-input"
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
        <Options list={list} listId={listId} onPick={(row) => onPick(row.to)} />
      </div>
    </div>
  );
}
