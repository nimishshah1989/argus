import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { EmptyState, KpiTile } from '../../ui/elements/index.js';
import { Template } from './shell/patterns/template.js';
import { DrillTable } from './DrillTable.js';
import { EngineTable } from './engine-table.js';
import {
  REGISTER_TABS,
  registerPages,
  type RegisterPage,
  type RegisterTable,
} from './machine-values.js';
import { ScreenMenu } from './screen-menu.js';
import { parseDrill, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

const FACE = '/analytics/machines';
const SCREEN = 'registers';

/** The register route: the screen, the chosen register and any drill, kept in the query. */
function registerHref(register: string, drill?: string): string {
  const query = new URLSearchParams({ screen: SCREEN, register });
  if (drill) query.set('drill', drill);
  return `${FACE}?${query.toString()}`;
}

/** The register the query asks for, else the first page the engine sent, else CNC. */
function chosenId(pages: readonly RegisterPage[], asked: string | null): string {
  return (
    pages.find((page) => page.id === asked)?.id ??
    pages[0]?.id ??
    REGISTER_TABS[0]?.id ??
    'machines'
  );
}

function Kinds({ selected, pages }: { selected: string; pages: readonly RegisterPage[] }) {
  const { t } = useTranslation();
  return (
    <ScreenMenu
      pills
      label={t('analytics.registers.tabs')}
      current={selected}
      items={REGISTER_TABS.filter(
        ({ id }) => id !== 'robots' || pages.some((page) => page.id === id),
      ).map(({ id, labelKey }) => ({ id, to: registerHref(id), label: t(labelKey) }))}
    />
  );
}

/** The engine's own count, load and age lines: its printed value and its sub-line, never reworded. */
function Kpis({ page }: { page: RegisterPage }) {
  return page.kpis.map((kpi, index) => (
    <KpiTile
      key={`${kpi.label}-${index}`}
      label={kpi.label}
      value={kpi.value === '' ? null : 0}
      format={() => kpi.value}
      note={kpi.sub ?? undefined}
    />
  ));
}

function Tables({ tables }: { tables: readonly RegisterTable[] }) {
  return (
    <div className="rg-tables">
      {tables.map((table, index) => (
        <EngineTable
          key={`${table.title ?? 'table'}-${index}`}
          caption={table.title ?? table.header.join(' · ')}
          title={table.title}
          header={table.header}
          rows={table.rows.map((row, at) => ({ row, index: at }))}
          searchable
        />
      ))}
    </div>
  );
}

/** Why a register page has nothing to draw, in words; null when it has something. */
function noticeOf(ready: boolean, page: RegisterPage | undefined, t: TFunction): string | null {
  if (!ready) return t('analytics.notComputed');
  if (!page) return t('analytics.registers.missingPage');
  return page.kpis.length === 0 && page.tables.length === 0 ? t('analytics.empty') : null;
}

/** The way to the machines behind the register: they open above the page, in the face's one drill table. */
function SeeMachines({ selected, ids }: { selected: string; ids: readonly string[] }) {
  const { t } = useTranslation();
  if (ids.length === 0) return null;
  return (
    <Link to={registerHref(selected, `machine:${ids.join(',')}`)} className="rg-link">
      {t('analytics.registers.seeMachines')}
    </Link>
  );
}

/**
 * The Registers screen on the register template: one page per register, each the engine's own split of count,
 * connected load, age and the controller or make breakdown, with the machines behind it one drill away. A
 * not-computed engine leaves the register switch and an honest "Not computed yet": no number is invented here.
 */
export function Registers({
  group,
  figure,
  menu,
  asOf,
}: {
  group: AnalyticsGroup;
  figure: Figure | undefined;
  menu: ReactNode;
  asOf: string;
}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const pages = registerPages(figure?.value);
  const selected = chosenId(pages, params.get('register'));
  const page = pages.find((candidate) => candidate.id === selected);
  const drill = parseDrill(params.get('drill'));
  const ready = figure?.status === 'ready';
  const frame = {
    kind: 'register',
    trail: menu,
    filters: <Kinds selected={selected} pages={pages} />,
    lede: `${t('analytics.asOf', { date: asOf })} · ${t('analytics.registers.intro')}`,
  } as const;
  const notice = noticeOf(ready, page, t);
  const drillArea = drill
    ? {
        drill: <DrillTable bare group={group} drill={drill} />,
        drillTitle: t('analytics.drill.title'),
      }
    : {};
  if (notice !== null || !page)
    return (
      <Template
        {...frame}
        {...drillArea}
        title={page?.title ?? t('analytics.screen.registers')}
        main={<EmptyState title={notice ?? ''} />}
      />
    );
  return (
    <Template
      {...frame}
      {...drillArea}
      title={page.title}
      actions={<SeeMachines selected={selected} ids={figure?.drill.ids ?? []} />}
      figures={page.kpis.length > 0 ? <Kpis page={page} /> : undefined}
      main={<Tables tables={page.tables} />}
    />
  );
}
