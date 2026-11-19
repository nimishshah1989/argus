import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Section } from './nav-data.js';
import './strings.js';

interface Entry {
  key: string;
  sectionId: string;
  screenId: string;
  name: string;
  hint: string;
  match: string;
}

/** Sections first, then every screen under them; only what the role can see. */
function entriesFor(sections: Section[], t: (k: never, o?: object) => string): Entry[] {
  const out: Entry[] = [];
  for (const sec of sections) {
    const secName = t(sec.label as never);
    out.push({
      key: sec.id,
      sectionId: sec.id,
      screenId: sec.screens[0]!.id,
      name: secName,
      hint: t('search.section' as never),
      match: secName,
    });
    if (sec.screens.length < 2) continue;
    for (const scr of sec.screens)
      out.push({
        key: `${sec.id}/${scr.id}`,
        sectionId: sec.id,
        screenId: scr.id,
        name: t(scr.label as never),
        hint: t('search.screen' as never, { section: secName }),
        match: `${t(scr.label as never)} ${secName}`,
      });
  }
  return out;
}

/** What the palette lists for what was typed, and which row is lit. */
function usePaletteList(sections: Section[]) {
  const { t } = useTranslation('navmap');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const all = useMemo(() => entriesFor(sections, t as never), [sections, t]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? all.filter((e) => e.match.toLowerCase().includes(q)) : all;
  }, [all, query]);
  const at = Math.min(active, Math.max(shown.length - 1, 0));
  return { query, setQuery, setActive, shown, at };
}

function Options({
  list,
  listId,
  onPick,
}: {
  list: ReturnType<typeof usePaletteList>;
  listId: string;
  onPick: (e: Entry) => void;
}) {
  const { t } = useTranslation('navmap');
  const { shown, at, setActive } = list;
  useEffect(() => {
    document.getElementById(`${listId}-${at}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [at, listId]);
  return (
    <>
      <ul id={listId} role="listbox" aria-label={t('search.results')} className="nm-palette-list">
        {shown.map((e, i) => (
          <li
            key={e.key}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === at}
            data-active={i === at}
            onMouseMove={() => setActive(i)}
            onClick={() => onPick(e)}
          >
            <span>{e.name}</span>
            <span className="nm-palette-hint">{e.hint}</span>
          </li>
        ))}
      </ul>
      {shown.length === 0 ? <p className="nm-palette-none">{t('search.none')}</p> : null}
    </>
  );
}

/** The command-K palette: a filter box over a list, arrow keys to move, Enter to go, Esc to close. */
export function Palette({
  sections,
  onPick,
  onClose,
}: {
  sections: Section[];
  onPick: (sectionId: string, screenId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('navmap');
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const list = usePaletteList(sections);
  const { shown, at, query, setQuery, setActive } = list;
  useEffect(() => input.current?.focus(), []);
  const pick = (e: Entry) => onPick(e.sectionId, e.screenId);

  const onKey = (e: KeyboardEvent) => {
    const last = shown.length - 1;
    if (e.key === 'Enter') {
      e.preventDefault(); // or the button that gets focus next would be pressed by this same key
      if (shown[at]) pick(shown[at]);
      return;
    }
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') setActive(at >= last ? 0 : at + 1);
    else if (e.key === 'ArrowUp') setActive(at <= 0 ? last : at - 1);
    else if (e.key !== 'Tab') return; // Tab is held: the box is the only stop in the dialog
    e.preventDefault();
  };
  return (
    <div className="nm-scrim nm-scrim-palette" onMouseDown={onClose}>
      <div
        className="nm-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('search.title')}
        data-testid="palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKey}
      >
        <input
          ref={input}
          className="nm-palette-input"
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={shown.length ? `${listId}-${at}` : undefined}
          aria-label={t('search.input')}
          placeholder={t('search.input')}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
        />
        <Options list={list} listId={listId} onPick={pick} />
      </div>
    </div>
  );
}
