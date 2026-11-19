import { useEffect, useRef, useState, type RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Ctrl or Cmd K toggles the search; Esc closes the drawer (the search closes itself). */
function useGlobalKeys(togglePalette: () => void, closeDrawer: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
      } else if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePalette, closeDrawer]);
}

/** The drawer and the search: what is open, and the keys and focus moves that go with it. */
export function useOverlays() {
  const location = useLocation();
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const searchBtn = useRef<HTMLButtonElement>(null);
  const was = useRef({ palette: false, drawer: false });
  const closeDrawer = () => setDrawer(false);
  const closePalette = () => setPalette(false);
  useGlobalKeys(
    () => {
      setPalette((open) => !open);
      setDrawer(false); // the search must never sit under an open drawer
    },
    () => {
      if (drawer) closeDrawer();
    },
  );
  useEffect(() => {
    setDrawer(false);
    setPalette(false); // a Back or Forward must not leave either open over the new page
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (drawer) document.querySelector<HTMLElement>('#analytics-menu [data-nav-item]')?.focus();
  }, [drawer]);
  // Whatever closes an overlay (Esc, the scrim, a choice, the shortcut, Back), focus returns to its opener once
  // the page behind it is live again (it is inert while the overlay is open).
  useEffect(() => {
    if (was.current.palette && !palette) searchBtn.current?.focus();
    else if (was.current.drawer && !drawer && !palette) menuBtn.current?.focus();
    was.current = { palette, drawer };
  }, [palette, drawer]);
  return { palette, setPalette, closePalette, drawer, setDrawer, closeDrawer, menuBtn, searchBtn };
}

/** True on an Apple device, where the search key is Cmd and not Ctrl. */
function isApple(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
}

/** Plant, period and search: the same header on every page. */
export function Header({
  company,
  drawer,
  menuRef,
  searchRef,
  onMenu,
  onSearch,
  inert,
}: {
  company: string | undefined;
  drawer: boolean;
  menuRef: RefObject<HTMLButtonElement | null>;
  searchRef: RefObject<HTMLButtonElement | null>;
  onMenu: () => void;
  onSearch: () => void;
  inert: boolean;
}) {
  const { t } = useTranslation();
  return (
    <header className="as-header" inert={inert}>
      <button
        ref={menuRef}
        type="button"
        className="as-menu-btn"
        aria-expanded={drawer}
        aria-controls="analytics-menu"
        onClick={onMenu}
      >
        {t('ashell.menu.open')}
      </button>
      <p className="as-plant">{company || t('analytics.title')}</p>
      {/* The figures route takes one date (asOf), not a period, so the picker is shown and disabled: a
          period the server ignores would be a fake. It enables when the route takes a period. */}
      <label className="as-period">
        <span className="as-sr">{t('ashell.period.label')}</span>
        <select disabled aria-label={t('ashell.period.label')}>
          <option>{t('ashell.period.ytd')}</option>
        </select>
      </label>
      <button
        ref={searchRef}
        type="button"
        className="as-search"
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
        onClick={onSearch}
      >
        <span>{t('ashell.search.open')}</span>
        <kbd>{t(isApple() ? 'ashell.search.shortcutApple' : 'ashell.search.shortcut')}</kbd>
      </button>
    </header>
  );
}
