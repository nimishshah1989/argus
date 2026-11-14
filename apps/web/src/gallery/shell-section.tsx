/* eslint-disable i18next/no-literal-string -- prop values and ids only; every visible string goes through t() */
import { useTranslation } from 'react-i18next';
import { Banner, type BannerTone } from '../ui/banner.js';
import { Button } from '../ui/button.js';
import { CirclePlus, LayoutGrid, List, Menu, Users, Wrench } from '../ui/icon.js';
import { Loading, Skeleton } from '../ui/loading.js';
import { Grid, Stack } from '../ui/layout.js';
import { StatusPill } from '../ui/status/status-pill.js';
import { TabBar } from '../ui/tab-bar.js';
import { TopBar } from '../ui/top-bar.js';

const SYNC = ['online', 'offline', 'sending', 'draft'] as const;
const BANNERS: BannerTone[] = ['offline', 'info', 'attention', 'error'];

/** The screen frame pieces both the floor and the desk use (design lock: tab bar, banner, loading, header pill). */
export function ShellSection() {
  const { t } = useTranslation('gallery');
  const desk = [
    { to: '#open', label: t('shell.tab.open'), icon: Menu, badge: 7 },
    { to: '#mine', label: t('shell.tab.mine'), icon: Wrench },
    { to: '#team', label: t('shell.tab.team'), icon: Users },
    { to: '#report', label: t('shell.tab.report'), icon: CirclePlus },
    { to: '#live', label: t('shell.tab.live'), icon: LayoutGrid },
  ];
  const floor = [
    { to: '#report', label: t('shell.tab.report'), icon: CirclePlus },
    { to: '#complaints', label: t('shell.tab.complaints'), icon: List },
  ];
  return (
    <section data-testid="gallery-shell" aria-labelledby="gallery-shell-h">
      <Stack>
        <h2 id="gallery-shell-h" className="text-title3 font-semibold">
          {t('section.shell')}
        </h2>
        {SYNC.map((id) => (
          // Its own box, so the sticky header stays in place in the gallery.
          <div key={id}>
            <TopBar
              title={t('shell.title')}
              subtitle={t('shell.updated')}
              trailing={<StatusPill group="sync" id={id} />}
            />
          </div>
        ))}
        {BANNERS.map((tone) => (
          <Banner
            key={tone}
            tone={tone}
            title={t(`shell.banner.${tone}`)}
            action={
              tone === 'attention' ? (
                <Button variant="secondary">{t('shell.dismiss')}</Button>
              ) : undefined
            }
          >
            {tone === 'offline' ? undefined : t(`shell.banner.${tone}.body`)}
          </Banner>
        ))}
        <div>
          <TabBar label={t('shell.tabs.desk')} tabs={desk} current="#open" />
        </div>
        <div>
          <TabBar label={t('shell.tabs.floor')} tabs={floor} current="#report" />
        </div>
        <LoadingSample />
      </Stack>
    </section>
  );
}

function LoadingSample() {
  return (
    <Loading>
      <Skeleton shape="title" />
      <Skeleton shape="line" />
      <Skeleton shape="short" />
      <Skeleton shape="row" />
      <Grid columns={2} gap={3}>
        <Skeleton shape="tile" />
        <Skeleton shape="tile" />
      </Grid>
    </Loading>
  );
}
