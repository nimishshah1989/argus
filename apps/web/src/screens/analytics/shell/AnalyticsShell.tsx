import { useMemo, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getBrand, getMe } from '../../../api.js';
import { useSystemTheme } from '../../../ui/system-theme.js';
import { ShellPalette } from './ShellPalette.js';
import { Header, useOverlays } from './shell-header.js';
import { place, sectionsFor, type ShellSection } from './shell-data.js';
import './shell.css';

/** Arrow keys move focus between the sibling links of one list; Home and End jump to its ends. */
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

/** Tab and Shift Tab loop inside the open drawer, so focus never reaches the page behind it. */
function trap(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab') return;
  const links = [...e.currentTarget.querySelectorAll<HTMLElement>('a[href]')];
  const first = links[0];
  const last = links[links.length - 1];
  if (!first || !last) return;
  const here = document.activeElement;
  if (e.shiftKey && here === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && here === last) {
    e.preventDefault();
    first.focus();
  }
}

/** The left menu: one link per section the login may open, then the way back to the desk. */
function SideMenu({
  sections,
  current,
  open,
  onGo,
}: {
  sections: ShellSection[];
  current: string | undefined;
  open: boolean;
  onGo: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="as-side"
      data-open={open}
      role={open ? 'dialog' : undefined}
      aria-modal={open ? true : undefined}
      aria-label={open ? t('analytics.menu') : undefined}
      onKeyDown={open ? trap : undefined}
    >
      <nav
        id="analytics-menu"
        aria-label={t('analytics.menu')}
        onKeyDown={arrows(['ArrowDown', 'ArrowUp'])}
      >
        <ul>
          {sections.map((section) => (
            <li key={section.id}>
              <Link
                to={section.tabs[0]!.to}
                data-nav-item
                onClick={onGo}
                // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
                aria-current={section.id === current ? 'page' : undefined}
              >
                {t(section.label)}
              </Link>
            </li>
          ))}
          <li>
            <Link to="/desk" data-nav-item onClick={onGo}>
              {t('nav.desk')}
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

/** A section's screens as tabs in one row, in the same place on every page. Never a third level. */
function Tabs({ section, current }: { section: ShellSection; current: string | undefined }) {
  const { t } = useTranslation();
  if (section.tabs.length < 2) return null;
  return (
    <nav
      className="as-tabs"
      aria-label={t('ashell.tabs', { section: t(section.label) })}
      onKeyDown={arrows(['ArrowRight', 'ArrowLeft'])}
    >
      <ul>
        {section.tabs.map((tab) => (
          <li key={tab.to}>
            <Link
              to={tab.to}
              data-nav-item
              // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
              aria-current={tab.to === current ? 'page' : undefined}
            >
              {t(tab.label)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The analytics frame (ticket 86a): the approved navigation map on the real routes. A header with the plant, the
 * period and the search; a left menu of at most six sections and the Guide; the section's screens as tabs; on a
 * phone the menu is a drawer. It follows the phone's light or dark setting. The screens inside keep their look.
 */
export function AnalyticsShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  useSystemTheme();
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const company = useQuery({ queryKey: ['brand'], queryFn: getBrand }).data?.company;
  const sections = useMemo(() => sectionsFor(role), [role]);
  const { section, tab } = place(sections, location.pathname, location.search);
  const ui = useOverlays();
  return (
    <div className="as">
      <Header
        company={company}
        drawer={ui.drawer}
        menuRef={ui.menuBtn}
        searchRef={ui.searchBtn}
        inert={ui.drawer || ui.palette}
        onMenu={() => ui.setDrawer(true)}
        onSearch={() => ui.setPalette(true)}
      />
      <div className="as-body">
        {ui.drawer ? (
          <button
            type="button"
            className="as-scrim"
            aria-label={t('ashell.menu.close')}
            onClick={ui.closeDrawer}
          />
        ) : null}
        <SideMenu
          sections={sections}
          current={tab ? section.id : undefined}
          open={ui.drawer}
          onGo={ui.closeDrawer}
        />
        <main className="as-main" inert={ui.drawer || ui.palette}>
          <h1 className="as-title">{t(section.label)}</h1>
          <Tabs section={section} current={tab?.to} />
          <div className="as-content">{children}</div>
        </main>
      </div>
      {ui.palette ? (
        <ShellPalette
          sections={sections}
          onClose={ui.closePalette}
          onPick={(to) => {
            ui.closePalette();
            navigate(to);
          }}
        />
      ) : null}
    </div>
  );
}
