import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { CirclePlus, List } from '../../ui/icon.js';
import { Loading, Skeleton } from '../../ui/loading.js';
import { Page, Shell, Stack } from '../../ui/layout.js';
import { TabBar } from '../../ui/tab-bar.js';
import { FLOOR } from './use-floor.js';

/** The floor's two tabs (A1 to A3): Report and My complaints. Other work counts as Report. */
export function FloorShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = pathname === FLOOR.mine ? FLOOR.mine : FLOOR.report;
  const tabs = [
    { to: FLOOR.report, label: t('nav.report'), icon: CirclePlus },
    { to: FLOOR.mine, label: t('floor.complaints'), icon: List },
  ];
  return (
    <Shell bar={<TabBar label={t('reportFloor.tabs')} tabs={tabs} current={current} />}>
      <Page>{children}</Page>
    </Shell>
  );
}

/** Step 1's shape while the plant loads (A3-1). */
export function FloorLoading() {
  return (
    <Loading>
      <Stack gap={3}>
        {/* eslint-disable i18next/no-literal-string -- shape names, not copy */}
        <Skeleton shape="title" />
        <Skeleton shape="line" />
        <Skeleton shape="row" />
        <Skeleton shape="tile" />
        <Skeleton shape="tile" />
        {/* eslint-enable i18next/no-literal-string */}
      </Stack>
    </Loading>
  );
}
