/* eslint-disable i18next/no-literal-string -- routes, ids and prop values only; every visible word goes through t() */
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router-dom';
import { getMe } from '../../../api.js';
import { useWide } from '../../../patterns/wide.js';
import { Icon } from '../../../ui/v2/icons.js';
import { canSeeJobs, countLabel, useFailedCount } from '../../settings/Jobs.js';
import { Body, PLANT_PAGES, type PlantPage, type PlantPageSpec } from '../../settings/Plant.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useNav } from '../nav.js';
import { settingsAccess } from './model.js';
import { V2_VIEWS } from './registry.js';

/** Wide: the Desk group then every page, the open one marked. Phone home: the same pages as a list with their sub lines. */
function Menu({
  pages,
  failed,
  page,
  phone,
}: {
  pages: readonly PlantPageSpec[];
  failed: number;
  page: PlantPage;
  phone: boolean;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('plant.menu')}>
      {phone ? null : (
        <>
          <h3>{t('nav.desk')}</h3>
          <ul className="v2-stack">
            <li>
              <Link to="/desk" className="v2-link">
                {t('desk.tab.open')}
              </Link>
            </li>
            <li>
              <Link to="/desk/board" className="v2-link">
                {t('deskLists.tab.live')}
              </Link>
            </li>
          </ul>
          <h3>{t('plant.menu.plant')}</h3>
        </>
      )}
      <ul className="v2-stack">
        {pages.map(({ page: to, key }) => (
          <li key={to}>
            <Link
              to={`/settings/${to}`}
              className="v2-link"
              aria-current={to === page ? 'page' : undefined}
            >
              <span>
                {to === 'jobs' && failed > 0
                  ? t('jobs.menu.withCount', { n: countLabel(failed) })
                  : t(key)}
              </span>
              {phone ? (
                <>
                  {' '}
                  <span>{t(`${key}.sub`)}</span>
                  <Icon name="chevronRight" size={14} />
                </>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Jobs is listed only for who may see failed jobs. */
const visiblePages = (user: Parameters<typeof canSeeJobs>[0]) =>
  PLANT_PAGES.filter((p) => !p.needsJobsAccess || canSeeJobs(user));

function BackToDesk() {
  const { t } = useTranslation();
  return (
    <Link to="/desk" className="v2-link">
      {t('settings.back')}
    </Link>
  );
}

/** The page's v2 view when it has one, else v1's body. */
function PageBody({ page }: { page: PlantPage }) {
  const View = V2_VIEWS[page];
  return View ? <View /> : <Body page={page} />;
}

/** What an admin or head sees: the menu (wide, or the phone home list) or a back link, then the page or "Back to desk". */
function Allowed(props: {
  page: PlantPage;
  wide: boolean;
  pages: readonly PlantPageSpec[];
  failed: number;
}) {
  const { t } = useTranslation();
  const { page, wide, pages, failed } = props;
  const phoneMenu = !wide && page === 'home';
  return (
    <>
      {wide || phoneMenu ? (
        <Menu pages={pages} failed={failed} page={page} phone={phoneMenu} />
      ) : (
        <Link to="/settings" className="v2-link">
          {t('plant.title')}
        </Link>
      )}
      {phoneMenu ? <BackToDesk /> : <PageBody page={page} />}
    </>
  );
}

/** Settings (S26): the kit shell with Desk marked current, the menu of plant pages, the admin|head gate, and the page's body. */
export function SettingsView({ page }: { page: PlantPage }) {
  const { t } = useTranslation();
  const wide = useWide();
  const user = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user;
  const access = settingsAccess(user?.role);
  const failed = useFailedCount(user);
  const nav = useNav('today', user?.role).map((item) => ({ ...item, current: item.id === 'desk' }));
  if (wide && page === 'home') return <Navigate to="/settings/machines" replace />;
  return (
    <EntityShell nav={nav} title={t('plant.title')}>
      {access === 'waiting' ? <p>{t('common.loading')}</p> : null}
      {access === 'refused' ? (
        <>
          <h2>{t('plant.noAccess')}</h2>
          <p>{t('plant.noAccess.body')}</p>
        </>
      ) : null}
      {access === 'allowed' ? (
        <Allowed page={page} wide={wide} pages={visiblePages(user)} failed={failed} />
      ) : null}
    </EntityShell>
  );
}
