import type { ReactNode } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useWide } from '../../patterns/wide.js';
import { SideNav } from '../../ui/side-nav.js';
import { TopBar } from '../../ui/top-bar.js';
import { useSystemTheme } from '../desk/Shell.js';
import { ANALYTICS_GROUPS, groupFor, type AnalyticsGroup } from './groups.js';
import { Dashboard } from './Dashboard.js';
import { DataChecklist } from './DataChecklist.js';
import { GroupPage } from './GroupPage.js';
import { GuidePage } from './GuidePage.js';

const DESK = '/desk';

/** The data checklist's own route, inside the Today group's shell. */
export function DataChecklistPage() {
  const today = groupFor('today');
  if (!today) return <Navigate to="/analytics/today" replace />;
  return (
    <FaceShell group={today}>
      <DataChecklist />
    </FaceShell>
  );
}

/** The face itself: `/analytics` opens on Today; an unknown group falls back to it (no 404 screen). */
export function AnalyticsFace() {
  const { group } = useParams();
  const found = groupFor(group);
  if (!found) return <Navigate to="/analytics/today" replace />;
  return (
    <FaceShell group={found}>
      {found.id === 'guide' ? (
        <GuidePage />
      ) : found.id === 'today' ? (
        <Dashboard group={found} />
      ) : (
        <GroupPage group={found} />
      )}
    </FaceShell>
  );
}

function PhoneMenu({ current }: { current: string }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('analytics.menu')} className="rounded-2xl bg-surface p-2 shadow-card">
      <ul className="flex flex-wrap gap-1">
        {ANALYTICS_GROUPS.map(({ id, labelKey }) => (
          <li key={id}>
            <Link
              to={`/analytics/${id}`}
              // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
              aria-current={id === current ? 'page' : undefined}
              className="flex min-h-target items-center rounded-xl px-3 text-footnote font-medium text-neutral-900 aria-[current=page]:bg-accent-tint aria-[current=page]:font-semibold aria-[current=page]:text-accent-text"
            >
              {t(labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function menuItems(t: (key: string) => string) {
  return ANALYTICS_GROUPS.map(({ id, labelKey, icon }) => ({
    to: `/analytics/${id}`,
    label: t(labelKey),
    icon,
  }));
}

function FaceShell({ group, children }: { group: AnalyticsGroup; children: ReactNode }) {
  const { t } = useTranslation();
  const wide = useWide();
  useSystemTheme();
  const here = `/analytics/${group.id}`;
  if (wide)
    return (
      <div className="flex min-h-dvh bg-neutral-100 text-neutral-900">
        <div className="sticky top-0 h-dvh">
          <SideNav label={t('analytics.menu')} groups={[{ items: menuItems(t) }]} current={here} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar title={t(group.labelKey)} />
          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4">
            {children}
          </main>
        </div>
      </div>
    );
  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100 text-neutral-900">
      <TopBar title={t(group.labelKey)} back={{ to: DESK, label: t('nav.desk') }} />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 p-4">
        <PhoneMenu current={group.id} />
        {children}
      </main>
    </div>
  );
}
