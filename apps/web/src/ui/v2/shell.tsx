/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  type TransitionEvent,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, useDrawerFrame, type DrawerSpec } from './drawer.js';
import { Icon, type IconName } from './icons.js';
import { Palette } from './palette.js';
import type { PaletteEntry } from './palette-match.js';

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  current?: boolean;
  /** Sits at the foot of the rail, apart from the sections (the way out to the desk). */
  end?: boolean;
};

/**
 * How the shell goes to another page without reloading this one. The kit does not know the router, so the app's shell
 * provides it; with none around, as in a test, a link is an ordinary address and the browser loads it.
 */
type Go = (to: string, options?: { replace?: boolean }) => void;
export const NavigateContext = createContext<Go>((to, options) =>
  options?.replace ? window.location.replace(to) : window.location.assign(to),
);

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** A plain left click: the one a router should take over. Middle, Ctrl, Cmd, Shift and Alt clicks keep the browser's own (a new tab or window). */
const isPlain = (e: MouseEvent) =>
  e.button === 0 && !e.defaultPrevented && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);

/** Arrow keys move focus between the rail's links; Home and End jump to its ends. */
function arrows(e: KeyboardEvent<HTMLElement>) {
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>('a[href]')];
  const i = items.indexOf(document.activeElement as HTMLElement);
  const to =
    e.key === 'ArrowDown'
      ? (i + 1) % items.length
      : e.key === 'ArrowUp'
        ? (i - 1 + items.length) % items.length
        : e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? items.length - 1
            : -1;
  if (i < 0 || to < 0) return;
  e.preventDefault();
  items[to]!.focus();
}

/** Tab and Shift Tab loop inside the open phone menu, so focus never reaches the page behind it. */
function trap(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab') return;
  const links = [...e.currentTarget.querySelectorAll<HTMLElement>('a[href]')];
  const first = links[0];
  const last = links[links.length - 1];
  const here = document.activeElement;
  if (!first || !last) return;
  if (e.shiftKey && here === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && here === last) {
    e.preventDefault();
    first.focus();
  }
}

/** The search control: a button that opens the palette; its shortcut is shown, and works from anywhere. */
function SearchButton({
  onOpen,
  buttonRef,
}: {
  onOpen: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useTranslation();
  return (
    <button
      ref={buttonRef}
      type="button"
      className="v2-search"
      aria-haspopup="dialog"
      aria-keyshortcuts="Control+K Meta+K"
      onClick={onOpen}
    >
      <Icon name="search" />
      <span className="v2-search-label">{t('ashell.search.open')}</span>
      <kbd>{t(isMac() ? 'ashell.search.shortcutApple' : 'ashell.search.shortcut')}</kbd>
    </button>
  );
}

/** The sticky glass header: on a phone the menu, then the page title, the plant, the search and the alerts. */
function Header({
  title,
  plant,
  alerts,
  menu,
  menuRef,
  searchRef,
  onMenu,
  onSearch,
  onAlerts,
}: {
  title: string;
  plant?: string;
  alerts: number;
  menu: boolean;
  menuRef: RefObject<HTMLButtonElement | null>;
  searchRef: RefObject<HTMLButtonElement | null>;
  onMenu: () => void;
  onSearch?: () => void;
  onAlerts?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header className="v2-header">
      <button
        ref={menuRef}
        type="button"
        className="v2-icon-btn v2-menu"
        aria-expanded={menu}
        aria-label={t(menu ? 'ashell.menu.close' : 'ashell.menu.open')}
        onClick={onMenu}
      >
        <Icon name={menu ? 'close' : 'menu'} size={18} />
      </button>
      <h1 className="v2-title">{title}</h1>
      {plant ? <p className="v2-plant">{plant}</p> : null}
      {onSearch ? <SearchButton onOpen={onSearch} buttonRef={searchRef} /> : null}
      <button
        type="button"
        className="v2-icon-btn v2-alerts"
        aria-label={alerts ? `${t('alerts.title')} (${alerts})` : t('alerts.title')}
        onClick={onAlerts}
      >
        <Icon name="bell" size={18} />
        {alerts ? (
          <span className="v2-badge" aria-hidden="true">
            {alerts}
          </span>
        ) : null}
      </button>
    </header>
  );
}

/**
 * What is open over the page: the phone menu and the search. Ctrl or Cmd K toggles the search from anywhere (and
 * the menu never sits under it); Esc closes the menu; whatever closes one, focus goes back to the control that opened it.
 */
function useOverlays(hasSearch: boolean, at: string | undefined) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLButtonElement>(null);
  const was = useRef({ menu: false, search: false });
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (hasSearch && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearch((open) => !open);
        setMenu(false);
      } else if (e.key === 'Escape' && !e.defaultPrevented) setMenu(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasSearch]);
  useEffect(() => {
    setMenu(false);
    setSearch(false); // a Back or Forward must not leave either open over the new page
  }, [at]);
  useEffect(() => {
    if (was.current.search && !search) searchRef.current?.focus();
    else if (was.current.menu && !menu && !search) menuRef.current?.focus();
    if (menu && !was.current.menu)
      document.querySelector<HTMLElement>('.v2-rail a[href]')?.focus({ preventScroll: true });
    was.current = { menu, search };
  }, [menu, search]);
  const go = useContext(NavigateContext);
  const pick = (to: string) => {
    setSearch(false);
    go(to, { replace: to === at });
  };
  return { menu, setMenu, search, setSearch, menuRef, searchRef, pick };
}

/** The rail: one link per section the login may open, and the way out to the desk; arrows move along it. */
function Rail({
  nav,
  menu,
  inert,
  at,
  onGo,
}: {
  nav: NavItem[];
  menu: boolean;
  inert: boolean;
  /** The address now showing: a click on the link to it replaces the history entry instead of adding one. */
  at?: string;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useContext(NavigateContext);
  return (
    <div
      className="v2-rail-col"
      inert={inert}
      role={menu ? 'dialog' : undefined}
      aria-modal={menu ? true : undefined}
      aria-label={menu ? t('analytics.menu') : undefined}
    >
      <nav
        className="v2-rail"
        aria-label={t('analytics.menu')}
        onKeyDown={(e) => (menu && e.key === 'Tab' ? trap(e) : arrows(e))}
      >
        {nav.map((item) => (
          <a
            key={item.id}
            href={item.href}
            aria-current={item.current ? 'page' : undefined}
            data-end={item.end || undefined}
            onClick={(e) => {
              if (!isPlain(e)) return;
              e.preventDefault();
              onGo();
              navigate(item.href, { replace: item.href === at });
            }}
          >
            <Icon name={item.icon} size={18} />
            <span className="v2-rail-label">{item.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

const remeasure = (e: TransitionEvent) =>
  e.target === e.currentTarget && window.dispatchEvent(new Event('resize'));

/**
 * The v2 app frame: an icon rail that opens on hover with the section names (every link goes through the app's router,
 * so no click reloads the page), a sticky glass header (title, plant, search, alerts), the page at full width, and the
 * drawer, which reflows the page and has the charts measure again. With `search`, the header's search opens the
 * palette over those entries.
 */
export function Shell({
  nav,
  title,
  plant,
  search,
  at,
  alerts = 0,
  onAlerts,
  drawer = null,
  children,
}: {
  nav: NavItem[];
  title: string;
  /** The plant's name, printed beside the title. */
  plant?: string;
  /** The pages the search can open; with none the header has no search. */
  search?: readonly PaletteEntry[];
  /** The address now showing (path and query): a change closes the menu and the search, and the link to it replaces the entry. */
  at?: string;
  alerts?: number;
  onAlerts?: () => void;
  drawer?: DrawerSpec | null;
  children: ReactNode;
}) {
  const ui = useOverlays(search !== undefined, at);
  const { menu, setMenu } = ui;
  const { covered } = useDrawerFrame(drawer !== null);
  return (
    <div
      className="v2-app v2-frame"
      data-drawer={drawer !== null}
      data-menu={menu}
      onTransitionEnd={remeasure}
    >
      <Rail
        nav={nav}
        menu={menu}
        inert={covered || ui.search}
        at={at}
        onGo={() => setMenu(false)}
      />
      {menu ? <ScrimButton onClose={() => setMenu(false)} /> : null}
      <div className="v2-main" inert={covered || ui.search || menu}>
        <Header
          title={title}
          plant={plant}
          alerts={alerts}
          menu={menu}
          menuRef={ui.menuRef}
          searchRef={ui.searchRef}
          onMenu={() => setMenu((m) => !m)}
          onSearch={search ? () => ui.setSearch(true) : undefined}
          onAlerts={onAlerts}
        />
        <main className="v2-content">{children}</main>
      </div>
      <Drawer drawer={drawer} />
      {ui.search && search ? (
        <Palette entries={search} onClose={() => ui.setSearch(false)} onPick={ui.pick} />
      ) : null}
    </div>
  );
}

/** On a phone, the page under the open menu is a button that closes it. */
function ScrimButton({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className="v2-scrim"
      tabIndex={-1}
      aria-label={t('ashell.menu.close')}
      onClick={onClose}
    />
  );
}
