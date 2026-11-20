import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { EmptyState } from '../../ui/elements/index.js';
import { contentOf, type FigureContent } from './figure-content.js';
import { KeyBody, KeyKpi } from './key-body.js';
import { FigureDrill } from './KeyPage.js';
import { SCREEN_LABELS, type AnalyticsGroup } from './groups.js';
import type { PageTable } from './page-content.js';
import { OVERVIEW } from './screen-state.js';
import { Template } from './shell/patterns/template.js';

type Figure = FiguresReply['figures'][number];
type Page = Extract<FigureContent, { kind: 'page' }>;
type TableCard = (table: PageTable) => ReactNode;

const tiles = (page: Page) =>
  page.kpis.map((kpi, at) => <KeyKpi key={`${kpi.label}-${at}`} kpi={kpi} />);

function NotComputed() {
  const { t } = useTranslation();
  return (
    <div data-span="full">
      <EmptyState title={t('analytics.notComputed')} />
    </div>
  );
}

/** The charts and tables of one figure, then its ticket drill. */
function Body({
  figure,
  page,
  group,
  renderTable,
}: {
  figure: Figure;
  page: Page;
  group: AnalyticsGroup;
  renderTable?: TableCard;
}) {
  return (
    <>
      <KeyBody tables={page.tables} charts={page.charts} renderTable={renderTable} fits />
      <div data-span="full">
        <FigureDrill figure={figure} group={group} />
      </div>
    </>
  );
}

/**
 * A key-shaped analytics screen on the overview template (ticket 87): the engine's page whole, its KPIs as tiles, its
 * charts and tables in the key's own cards and the ticket drill under them. The group's menu sits above the title,
 * the date the records run to under it, and the rows a figure was opened from come first, as they did before. The
 * title is the engine's own; a page that has none takes the screen's name. Nothing is recounted here: every printed
 * figure shows as the engine wrote it.
 */
export function KeyScreen({
  screen,
  figures,
  group,
  menu,
  asOf,
  drill,
  renderTable,
}: {
  screen: string;
  figures: readonly Figure[];
  group: AnalyticsGroup;
  menu: ReactNode;
  asOf: string;
  /** The rows behind the figure the page was opened from, when the address names them. */
  drill: ReactNode;
  /** A screen's own card for one table (A4's Specialization, A10's editor). */
  renderTable?: TableCard;
}) {
  const { t } = useTranslation();
  const labelKey = SCREEN_LABELS[screen] ?? 'analytics.screen.unknown';
  const name = t(labelKey);
  const pages = figures.map((figure) => {
    const content = figure.status === 'ready' ? contentOf(figure, t) : null;
    return { figure, page: content?.kind === 'page' ? content : null };
  });
  const alone = pages.length === 1 ? pages[0]?.page : null;
  return (
    <Template
      kind={OVERVIEW}
      trail={menu}
      title={alone && alone.title !== '' ? alone.title : name}
      lede={t('analytics.asOf', { date: asOf })}
      figures={alone && alone.kpis.length > 0 ? tiles(alone) : undefined}
      main={
        <>
          {drill === null ? null : <div data-span="full">{drill}</div>}
          {pages.length === 0 ? <NotComputed /> : null}
          {pages.map(({ figure, page }) =>
            page === null ? (
              <NotComputed key={figure.key} />
            ) : (
              <Fragment key={figure.key}>
                <Body figure={figure} page={page} group={group} renderTable={renderTable} />
              </Fragment>
            ),
          )}
        </>
      }
    />
  );
}
