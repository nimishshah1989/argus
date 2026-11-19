/* eslint-disable i18next/no-literal-string -- the template's kind and state are prop values, not copy */
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { viewState } from '../../patterns/view-state.js';
import { Card } from '../../ui/card.js';
import { EmptyState, KpiTile, RankedList, type RankedItem } from '../../ui/elements/index.js';
import { figureMeasure, formatFigure } from '../../ui/meaning/index.js';
import { Template } from './shell/patterns/template.js';
import { dmy } from './action-center.js';
import { SECTION_LABELS, SECTION_ORDER, checklistTotals } from './checklist-view.js';
import { contentOf, type FigureContent } from './figure-content.js';
import { groupFor, type AnalyticsGroup } from './groups.js';
import { FigureDrill } from './KeyPage.js';
import { NotReady } from './screen-states.js';

type Figure = FiguresReply['figures'][number];
type Groups = Extract<FigureContent, { kind: 'list' }>['groups'];

/** No list paints more than 50 rows first (DESIGN.md Components); a group shows this many and folds the rest. */
const SHOWN_FIRST = 20;

const grouped = (count: number): string => count.toLocaleString('en-IN');

/** One tile: a count of things still to do. A count has no earlier period to compare with, so it shows no change. */
function CountTile({ label, count }: { label: string; count: number }) {
  const measure = figureMeasure('data-checklist');
  return (
    <div className="h-full min-w-0">
      <KpiTile label={label} value={count} format={(shown) => formatFigure(measure, shown, 0)} />
    </div>
  );
}

/** One item: the engine's own sentence, ruled from the one above. */
function Item({ row }: { row: string }) {
  return <li className="border-t border-neutral-200 pt-2">{row}</li>;
}

/**
 * The open items, one card a group with its count. The first few show; the rest sit in a native disclosure, still in
 * the page, so nothing is dropped and a keyboard or a screen reader opens them with the summary.
 */
function GroupCards({ groups }: { groups: Groups }) {
  const { t } = useTranslation();
  return groups.map((group) => {
    const first = group.rows.slice(0, SHOWN_FIRST);
    const rest = group.rows.slice(SHOWN_FIRST);
    return (
      <div key={group.label} data-span="full">
        <Card
          title={t('analytics.checklist.groupTitle', {
            label: group.label,
            count: grouped(group.rows.length),
          })}
        >
          <ul className="flex flex-col gap-2 text-footnote">
            {first.map((row, index) => (
              <Item key={`${group.label}-${index}`} row={row} />
            ))}
          </ul>
          {rest.length === 0 ? null : (
            <details className="text-footnote">
              <summary className="flex min-h-target-min cursor-pointer items-center font-semibold text-accent-text">
                {t('analytics.checklist.showAll', { count: group.rows.length })}
              </summary>
              <ul className="flex flex-col gap-2">
                {rest.map((row, index) => (
                  <Item key={`${group.label}-more-${index}`} row={row} />
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>
    );
  });
}

interface ReadyProps {
  figure: Figure;
  groups: Groups;
  group: AnalyticsGroup;
  title: string;
  lede: string;
}

/**
 * Everything the figure computes: the totals as tiles, the groups ranked by size, every open item under its group,
 * and the way to the tickets behind the gaps when the engine names any.
 */
export function ChecklistReady({ figure, groups, group, title, lede }: ReadyProps) {
  const { t } = useTranslation();
  const totals = checklistTotals(figure.value);
  const measure = figureMeasure('data-checklist');
  const ranked: RankedItem[] = groups.map((item) => ({
    id: item.label,
    label: item.label,
    value: item.rows.length,
    display: formatFigure(measure, item.rows.length, 0),
  }));
  return (
    <Template
      title={title}
      lede={lede}
      kind="overview"
      figures={
        totals === null ? null : (
          <>
            <CountTile label={t('analytics.checklist.todo')} count={totals.total} />
            {SECTION_ORDER.map((section) => (
              <CountTile
                key={section}
                label={t(SECTION_LABELS[section])}
                count={totals.sections[section]}
              />
            ))}
          </>
        )
      }
      main={
        groups.length === 0 ? (
          <div data-span="full">
            <EmptyState title={t('analytics.checklist.none')} />
          </div>
        ) : (
          <>
            <div data-span="full">
              <Card title={t('analytics.checklist.ranked')}>
                <RankedList items={ranked} anchor />
              </Card>
            </div>
            <div data-span="full" data-figure={figure.key} className="flex flex-col gap-4">
              <GroupCards groups={groups} />
            </div>
            <div data-span="full">
              <FigureDrill figure={figure} group={group} />
            </div>
          </>
        )
      }
    />
  );
}

/**
 * The data checklist's own screen (packet 38.3, rebuilt on the overview template by ticket 87): the open items the
 * engine computes, as four count tiles, the groups ranked, then every item under its group. It reads the same
 * figures reply as the rest of the face and never invents a number.
 */
export function DataChecklist() {
  const { t } = useTranslation();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const title = t('analytics.screen.data-checklist');
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  const today = groupFor('today');
  if (state !== 'ready' || !figures.data || !today)
    return (
      <NotReady
        title={title}
        state={state === 'ready' ? 'empty' : state}
        emptyText={t('analytics.empty')}
        onRetry={() => void figures.refetch()}
      />
    );
  const figure = figures.data.figures.find((candidate) => candidate.key === 'data-checklist');
  const content = figure?.status === 'ready' ? contentOf(figure, t) : null;
  if (!figure || content?.kind !== 'list')
    return (
      <NotReady
        title={title}
        state="empty"
        emptyText={figure === undefined ? t('analytics.empty') : t('analytics.notComputed')}
        onRetry={() => void figures.refetch()}
      />
    );
  return (
    <ChecklistReady
      figure={figure}
      groups={content.groups}
      group={today}
      title={title}
      lede={[
        t('analytics.checklist.intro'),
        t('analytics.asOf', { date: dmy(figures.data.asOf) }),
      ].join(' · ')}
    />
  );
}
