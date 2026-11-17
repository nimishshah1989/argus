import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { AccountButtonRow, AccountSheet } from '../../components/AccountSheet.js';
import { Drafts } from '../../components/Drafts.js';
import { useOnline } from '../../data/index.js';
import { PatternFrame, StateNotice } from '../../patterns/frame.js';
import { CirclePlus, List } from '../../ui/icon.js';
import { Loading, Skeleton } from '../../ui/loading.js';
import { Page, Shell, Stack } from '../../ui/layout.js';
import { TabBar } from '../../ui/tab-bar.js';
import { FLOOR, type FloorLoad } from './use-floor.js';

/** The floor's two tabs (A1 to A3): Report and My complaints. Other work counts as Report. */
export function FloorShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const current = pathname === FLOOR.mine ? FLOOR.mine : FLOOR.report;
  const tabs = [
    { to: FLOOR.report, label: t('nav.report'), icon: CirclePlus },
    { to: FLOOR.mine, label: t('floor.complaints'), icon: List },
  ];
  const [account, setAccount] = useState(false);
  return (
    <Shell bar={<TabBar label={t('reportFloor.tabs')} tabs={tabs} current={current} />}>
      <Page>
        <AccountButtonRow onClick={() => setAccount(true)} />
        <Drafts />
        {children}
      </Page>
      <AccountSheet open={account} onOpenChange={setAccount} />
    </Shell>
  );
}

/** While the floor loads: its shape (A3-1); if the load failed: why, with Try again (never "Loading…" forever). */
export function FloorWaiting({ title, load }: { title?: string; load: FloorLoad }) {
  const { t } = useTranslation();
  const online = useOnline();
  if (!load.error) return <FloorLoading title={title} />;
  /* eslint-disable i18next/no-literal-string -- state names, not copy */
  const state = online ? 'error' : 'offline';
  /* eslint-enable i18next/no-literal-string */
  return (
    <PatternFrame title={title ?? t('floor.title')} quietOnline>
      <StateNotice state={state} empty={t('kit.pattern.error')} onRetry={load.retry} />
    </PatternFrame>
  );
}

/** The screen's header and Step 1's shape while the plant loads (A3-1). */
export function FloorLoading({ title }: { title?: string }) {
  const { t } = useTranslation();
  return (
    <PatternFrame title={title ?? t('floor.title')} quietOnline>
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
    </PatternFrame>
  );
}
