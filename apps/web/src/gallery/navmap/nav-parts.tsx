import type { KeyboardEvent, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { ROLES, type RoleId, type Section } from './nav-data.js';
import { PERIODS, type NavState } from './nav-state.js';
import './strings.js';

/** Arrow keys move focus between the sibling items of one list (Home and End jump to the ends). */
function arrows(keys: [string, string]) {
  return (e: KeyboardEvent<HTMLElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-nav-item]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const to =
      e.key === keys[0]
        ? (i + 1) % items.length
        : e.key === keys[1]
          ? (i - 1 + items.length) % items.length
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? items.length - 1
              : -1;
    if (to < 0) return;
    e.preventDefault();
    items[to]!.focus();
  };
}

export function RoleSwitcher({ role, set }: Pick<NavState, 'role' | 'set'>) {
  const { t } = useTranslation('navmap');
  const lands = ROLES.find((r) => r.id === role)!.lands;
  return (
    <div className="nm-preview" data-testid="role-switcher">
      <div role="group" aria-label={t('roles.label')} className="nm-roles">
        <span className="nm-roles-label">{t('roles.label')}</span>
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={r.id === role}
            onClick={() => set({ role: r.id as RoleId })}
          >
            {t(r.label)}
          </button>
        ))}
      </div>
      <p className="nm-lands" data-testid="lands">
        {t(lands === 'desk' ? 'lands.desk' : 'lands.analytics')}
      </p>
    </div>
  );
}

export function SideMenu({
  sections,
  current,
  open,
  onGo,
}: {
  sections: Section[];
  current: string;
  open: boolean;
  onGo: (sectionId: string) => void;
}) {
  const { t } = useTranslation('navmap');
  return (
    <nav
      className="nm-side"
      data-open={open}
      aria-label={t('menu.label')}
      data-testid="menu"
      onKeyDown={arrows(['ArrowDown', 'ArrowUp'])}
    >
      <ul>
        {sections.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              data-nav-item
              data-testid={`menu-${s.id}`}
              aria-current={s.id === current ? 'page' : undefined}
              onClick={() => onGo(s.id)}
            >
              {t(s.label)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A section's screens as tabs in one row, in the same place on every screen. Never a third level. */
export function Tabs({
  section,
  screenId,
  onGo,
}: {
  section: Section;
  screenId: string;
  onGo: (id: string) => void;
}) {
  const { t } = useTranslation('navmap');
  if (section.screens.length < 2) return null;
  return (
    <nav
      className="nm-tabs"
      aria-label={t('tabs.label', { section: t(section.label) })}
      data-testid="tabs"
      onKeyDown={arrows(['ArrowRight', 'ArrowLeft'])}
    >
      <ul>
        {section.screens.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              data-nav-item
              data-testid={`tab-${s.id}`}
              aria-current={s.id === screenId ? 'page' : undefined}
              onClick={() => onGo(s.id)}
            >
              {t(s.label)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function PeriodPicker({
  period,
  from,
  to,
  set,
}: Pick<NavState, 'period' | 'from' | 'to' | 'set'>) {
  const { t } = useTranslation('navmap');
  return (
    <div className="nm-period">
      <label>
        <span className="nm-sr">{t('period.label')}</span>
        <select
          value={period}
          onChange={(e) => set({ period: e.target.value })}
          data-testid="period"
        >
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p === 'ytd' ? t('period.ytd') : p === 'custom' ? t('period.custom') : p}
            </option>
          ))}
        </select>
      </label>
      {period === 'custom' ? (
        <>
          <label>
            <span className="nm-sr">{t('period.from')}</span>
            <input type="date" value={from} onChange={(e) => set({ from: e.target.value })} />
          </label>
          <label>
            <span className="nm-sr">{t('period.to')}</span>
            <input type="date" value={to} onChange={(e) => set({ to: e.target.value })} />
          </label>
        </>
      ) : null}
    </div>
  );
}

/** The placeholder every item shows: its name and the word preview. No figures. */
export function PlaceholderPage({
  section,
  screenId,
  period,
}: {
  section: Section;
  screenId: string;
  period: string;
}) {
  const { t } = useTranslation('navmap');
  const screen = section.screens.find((s) => s.id === screenId)!;
  return (
    <section className="nm-page" data-testid="page" aria-labelledby="nm-page-title">
      <p className="nm-eyebrow">{t(section.label)}</p>
      <h2 id="nm-page-title">{t(screen.label)}</h2>
      <p className="nm-badge" data-testid="page-preview">
        {t('preview')}
      </p>
      <p className="nm-note">{t('previewNote')}</p>
      <p className="nm-note" data-testid="page-period">
        {t('period.label')}: {period}
      </p>
    </section>
  );
}

/** Plant, period, search and theme: the same header on every screen. */
export function Header({
  nav,
  drawer,
  menuRef,
  searchRef,
  onMenu,
  onSearch,
}: {
  nav: NavState;
  drawer: boolean;
  menuRef: RefObject<HTMLButtonElement | null>;
  searchRef: RefObject<HTMLButtonElement | null>;
  onMenu: () => void;
  onSearch: () => void;
}) {
  const { t } = useTranslation('navmap');
  const dark = nav.theme === 'dark';
  return (
    <header className="nm-header">
      <button
        ref={menuRef}
        type="button"
        className="nm-menu-btn"
        aria-expanded={drawer}
        data-testid="menu-button"
        onClick={onMenu}
      >
        {t('menu.open')}
      </button>
      <h1 className="nm-plant">{t('plant')}</h1>
      <PeriodPicker period={nav.period} from={nav.from} to={nav.to} set={nav.set} />
      <button
        ref={searchRef}
        type="button"
        className="nm-search"
        data-testid="search-button"
        onClick={onSearch}
      >
        <span>{t('search.open')}</span>
        <kbd>{t('search.shortcut')}</kbd>
      </button>
      <button
        type="button"
        className="nm-theme"
        data-testid="theme-toggle"
        aria-pressed={dark}
        onClick={() => nav.set({ theme: dark ? 'light' : 'dark' })}
      >
        {t(dark ? 'theme.dark' : 'theme.light')}
      </button>
    </header>
  );
}
