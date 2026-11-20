/* eslint-disable i18next/no-literal-string -- icon names and typed unions only; every visible word comes in as a prop or t() */
import { useEffect, useRef, useState, type ReactNode, type TransitionEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, useDrawerFrame, type DrawerSpec } from './drawer.js';
import { Icon, type IconName } from './icons.js';

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  href: string;
  current?: boolean;
};

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** The page's one search box; Ctrl K (⌘ K on a Mac) puts the cursor in it from anywhere. */
function Search({ onSearch }: { onSearch?: (query: string) => void }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <label className="v2-search">
      <Icon name="search" />
      <input
        ref={input}
        type="search"
        aria-label={t('ashell.search.open')}
        placeholder={t('ashell.search.open')}
        onChange={(e) => onSearch?.(e.target.value)}
      />
      <kbd>{t(isMac() ? 'ashell.search.shortcutApple' : 'ashell.search.shortcut')}</kbd>
    </label>
  );
}

/** The sticky glass header: on a phone the menu, then the page title, the search and the alerts. */
function Header({
  title,
  alerts,
  menu,
  onMenu,
  onSearch,
  onAlerts,
}: {
  title: string;
  alerts: number;
  menu: boolean;
  onMenu: () => void;
  onSearch?: (query: string) => void;
  onAlerts?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <header className="v2-header">
      <button
        type="button"
        className="v2-icon-btn v2-menu"
        aria-expanded={menu}
        aria-label={t(menu ? 'ashell.menu.close' : 'ashell.menu.open')}
        onClick={onMenu}
      >
        <Icon name={menu ? 'close' : 'menu'} size={18} />
      </button>
      <h1 className="v2-title">{title}</h1>
      <Search onSearch={onSearch} />
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
 * The v2 app frame: an icon rail that opens on hover with the section names, a sticky glass header (title, search,
 * alerts), the page at full width, and the drawer, which reflows the page and has the charts measure again.
 */
export function Shell({
  nav,
  title,
  alerts = 0,
  onSearch,
  onAlerts,
  drawer = null,
  children,
}: {
  nav: NavItem[];
  title: string;
  alerts?: number;
  onSearch?: (query: string) => void;
  onAlerts?: () => void;
  drawer?: DrawerSpec | null;
  children: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const { covered } = useDrawerFrame(drawer !== null);
  const remeasure = (e: TransitionEvent) =>
    e.target === e.currentTarget && window.dispatchEvent(new Event('resize'));
  return (
    <div
      className="v2-app"
      data-drawer={drawer !== null}
      data-menu={menu}
      onTransitionEnd={remeasure}
    >
      <div className="v2-rail-col" inert={covered}>
        <nav className="v2-rail">
          {nav.map((item) => (
            <a key={item.id} href={item.href} aria-current={item.current ? 'page' : undefined}>
              <Icon name={item.icon} size={18} />
              <span className="v2-rail-label">{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
      <div className="v2-main" inert={covered}>
        <Header
          title={title}
          alerts={alerts}
          menu={menu}
          onMenu={() => setMenu((m) => !m)}
          onSearch={onSearch}
          onAlerts={onAlerts}
        />
        <main className="v2-content">{children}</main>
      </div>
      <Drawer drawer={drawer} />
    </div>
  );
}
