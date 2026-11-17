import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getMe } from '../../api.js';
import { CrudPage } from '../../patterns/crud-page.js';
import type { CrudSpec } from '../../patterns/crud-spec.js';
import { useWide } from '../../patterns/wide.js';
import { ShieldCheck, Users, type IconComponent } from '../../ui/icon.js';
import { SegmentedBar } from '../../ui/segmented-bar.js';
import { loginsSpec, peopleSpec } from './people-specs.js';

export type PeoplePage = 'people' | 'logins';

export interface PeoplePageSpec {
  page: PeoplePage;
  icon: IconComponent;
  key: 'people.menu.people' | 'people.menu.logins';
  spec: CrudSpec<never>;
}

/**
 * People and logins (ticket 21): two generated screens, admin only. `Plant.tsx` adds these entries to
 * `PLANT_PAGES` so one list is the menu and the routes; the phone gets a two-tab bar between them.
 */
export const PEOPLE_PAGES: readonly PeoplePageSpec[] = [
  { page: 'people', icon: Users, key: 'people.menu.people', spec: peopleSpec as never },
  { page: 'logins', icon: ShieldCheck, key: 'people.menu.logins', spec: loginsSpec as never },
];

function NoAccess() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 pt-8 text-center">
      <h2 className="text-title2 font-extrabold">{t('plant.noAccess')}</h2>
      <p className="text-body text-neutral-600">{t('plant.noAccess.body')}</p>
    </div>
  );
}

/** The screen a settings page renders for people or logins; the pattern owns the list, forms and switches. */
export function PeopleSettings({ page }: { page: PeoplePage }) {
  const { t } = useTranslation();
  const wide = useWide();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const role = me.data?.user.role;
  if (role && role !== 'admin') return <NoAccess />;
  return (
    <div className="flex flex-col gap-3">
      {!wide ? (
        <SegmentedBar
          label={t('people.title')}
          items={PEOPLE_PAGES.map((entry) => ({ id: entry.page, label: t(entry.key) }))}
          selected={page}
          onSelect={(id) => navigate(`/settings/${id}`)}
        />
      ) : null}
      {page === 'people' ? (
        <CrudPage key="people" spec={peopleSpec} />
      ) : (
        <CrudPage key="logins" spec={loginsSpec} />
      )}
    </div>
  );
}
