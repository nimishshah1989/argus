import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { directionProps } from '../directions/direction-props.js';
import { instrument } from '../directions/direction-instrument.js';
import { Header, PlaceholderPage, RoleSwitcher, SideMenu, Tabs } from './nav-parts.js';
import { useNavState, type NavState } from './nav-state.js';
import { Palette } from './palette.js';
import './strings.js';
import './navmap.css';

/** Instrument's tokens on <html>, so the palette and the drawer inherit them as the showcase's sheet does. */
function useInstrumentTokens(theme: 'light' | 'dark'): void {
  const props = useMemo(() => directionProps(instrument, theme), [theme]);
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    for (const [name, value] of Object.entries(props)) style.setProperty(name, value);
    return () => Object.keys(props).forEach((name) => style.removeProperty(name));
  }, [props]);
}

/** Ctrl or Cmd K toggles the palette; Esc closes the drawer (the palette closes itself). */
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

/** The left menu beside the tabs and the placeholder page. */
function Body({
  nav,
  drawer,
  onCloseDrawer,
}: {
  nav: NavState;
  drawer: boolean;
  onCloseDrawer: () => void;
}) {
  const { t } = useTranslation('navmap');
  const period =
    nav.period === 'ytd'
      ? t('period.ytd')
      : nav.period === 'custom'
        ? t('period.custom')
        : nav.period;
  return (
    <div className="nm-body">
      {drawer ? (
        <button
          type="button"
          className="nm-scrim"
          aria-label={t('menu.close')}
          onClick={onCloseDrawer}
        />
      ) : null}
      <SideMenu
        sections={nav.sections}
        current={nav.section.id}
        open={drawer}
        onGo={(id) => {
          nav.go(id, nav.sections.find((x) => x.id === id)!.screens[0]!.id);
          if (drawer) onCloseDrawer();
        }}
      />
      <main className="nm-main">
        <Tabs
          section={nav.section}
          screenId={nav.screenId}
          onGo={(id) => nav.go(nav.section.id, id)}
        />
        <PlaceholderPage section={nav.section} screenId={nav.screenId} period={period} />
      </main>
    </div>
  );
}

/**
 * `/gallery?view=navmap` (ticket 80v): a clickable map of the analytics navigation, drawn in the showcase's grammar
 * (white field, Instrument tokens, light and dark). A design preview only: it is not the product's routing, and
 * every item is a placeholder. Phone width: the menu is a drawer from a Menu button, because seven items do not fit
 * a bottom bar, and a drawer holds a role's changing count.
 */
export default function NavMap() {
  const nav = useNavState();
  const [palette, setPalette] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const searchBtn = useRef<HTMLButtonElement>(null);
  useInstrumentTokens(nav.theme);
  useGlobalKeys(
    () => setPalette((open) => !open),
    () => setDrawer(false),
  );
  useEffect(() => {
    if (drawer)
      document.querySelector<HTMLElement>('[data-testid="menu"] [data-nav-item]')?.focus();
  }, [drawer]);

  const closeDrawer = () => {
    setDrawer(false);
    menuBtn.current?.focus();
  };
  const closePalette = () => {
    setPalette(false);
    searchBtn.current?.focus();
  };
  return (
    <div className="nm" data-testid="navmap">
      <RoleSwitcher role={nav.role} set={nav.set} />
      <Header
        nav={nav}
        drawer={drawer}
        menuRef={menuBtn}
        searchRef={searchBtn}
        onMenu={() => setDrawer(true)}
        onSearch={() => setPalette(true)}
      />
      <Body nav={nav} drawer={drawer} onCloseDrawer={closeDrawer} />
      {palette ? (
        <Palette
          sections={nav.sections}
          onClose={closePalette}
          onPick={(section, tab) => {
            nav.go(section, tab);
            closePalette();
          }}
        />
      ) : null}
    </div>
  );
}
