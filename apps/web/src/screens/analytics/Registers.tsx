import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import {
  REGISTER_TABS,
  registerPages,
  type RegisterPage,
  type RegisterTable,
} from './machine-values.js';
import { DataTable, Section, StatCard } from './parts.js';
import { parseDrill, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

const FACE = '/analytics/machines';

/** The register route: the screen, the chosen register and any drill, kept in the query. */
function registerHref(register: string, drill?: string): string {
  const query = new URLSearchParams({ screen: 'registers', register });
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

function Tabs({ selected, pages }: { selected: string; pages: readonly RegisterPage[] }) {
  const { t } = useTranslation();
  const tabs = REGISTER_TABS.filter(
    ({ id }) => id !== 'robots' || pages.some((page) => page.id === id),
  );
  return (
    <nav aria-label={t('analytics.registers.tabs')}>
      <ul className="flex flex-wrap gap-1 rounded-xl bg-neutral-200 p-1">
        {tabs.map(({ id, labelKey }) => (
          <li key={id}>
            <Link
              to={registerHref(id)}
              // eslint-disable-next-line i18next/no-literal-string -- ARIA value, not copy
              aria-current={id === selected ? 'page' : undefined}
              className="flex min-h-target-min items-center rounded-lg px-3 text-footnote font-semibold text-neutral-700 aria-[current=page]:bg-surface aria-[current=page]:text-neutral-900 aria-[current=page]:shadow-card"
            >
              {t(labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The five splits and tables the engine wrote for one register page: labels and values are its data. */
function PageBody({ page }: { page: RegisterPage }) {
  const { t } = useTranslation();
  if (page.kpis.length === 0 && page.tables.length === 0)
    return <p className="text-body text-neutral-600">{t('analytics.empty')}</p>;
  return (
    <Stack gap={4}>
      {page.kpis.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {page.kpis.map((kpi, index) => (
            <li key={`${kpi.label}-${index}`}>
              <StatCard label={kpi.label} value={kpi.value} sub={kpi.sub} />
            </li>
          ))}
        </ul>
      ) : null}
      {page.tables.map((table: RegisterTable, index) => (
        <DataTable
          key={`${table.title ?? 'table'}-${index}`}
          title={table.title}
          header={table.header}
          rows={table.rows}
        />
      ))}
    </Stack>
  );
}

/** The register page itself: an honest not-computed notice, or the engine's own KPI and table page. */
function RegisterBody({
  page,
  selected,
  figure,
}: {
  page: RegisterPage | undefined;
  selected: string;
  figure: Figure | undefined;
}) {
  const { t } = useTranslation();
  const ready = figure?.status === 'ready';
  const drillIds = ready ? (figure?.drill.ids ?? []) : [];
  if (!ready)
    return (
      <div data-register="not-computed" className="rounded-2xl bg-surface p-4 shadow-card">
        <p className="text-body font-medium text-neutral-600">{t('analytics.notComputed')}</p>
      </div>
    );
  if (!page)
    return <p className="text-body text-neutral-600">{t('analytics.registers.missingPage')}</p>;
  return (
    <Section
      title={page.title}
      action={
        drillIds.length > 0 ? (
          <Link
            to={registerHref(selected, `machine:${drillIds.join(',')}`)}
            className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
          >
            {t('analytics.registers.seeMachines')}
          </Link>
        ) : null
      }
    >
      <PageBody page={page} />
    </Section>
  );
}

/**
 * The Registers screen (39b): one page per register, each the engine's own split of count, connected load,
 * age and the controller/make breakdown, with the machines behind it one drill away. A not-computed engine
 * leaves the tabs and an honest "Not computed yet" — no register number is ever invented here.
 */
export function Registers({
  group,
  figure,
}: {
  group: AnalyticsGroup;
  figure: Figure | undefined;
}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const pages = registerPages(figure?.value);
  const selected = chosenId(pages, params.get('register'));
  const page = pages.find((candidate) => candidate.id === selected);
  const drill = parseDrill(params.get('drill'));
  return (
    <Stack gap={4}>
      <p className="max-w-3xl text-body text-neutral-600">{t('analytics.registers.intro')}</p>
      <Tabs selected={selected} pages={pages} />
      <RegisterBody page={page} selected={selected} figure={figure} />
      {drill ? <DrillTable group={group} drill={drill} /> : null}
    </Stack>
  );
}
