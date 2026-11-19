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
import { SECTION_LABELS, SECTION_ORDER, checklistTotals } from './checklist-view.js';
import { contentOf, type FigureContent } from './figure-content.js';

type Figure = FiguresReply['figures'][number];
type Groups = Extract<FigureContent, { kind: 'list' }>['groups'];

/** One tile: a count of things still to do. A count has no earlier period to compare with, so it shows no change. */
function CountTile({ label, count }: { label: string; count: number }) {
  const measure = figureMeasure('data-checklist');
  return (
    <div className="h-full min-w-0">
      <KpiTile label={label} value={count} format={(shown) => formatFigure(measure, shown, 0)} />
    </div>
  );
}

/** The open items, one card a group with its count; each item is the engine's own sentence. */
function GroupCards({ groups }: { groups: Groups }) {
  return groups.map((group) => (
    <div key={group.label} data-span="full">
      <Card title={`${group.label} · ${group.rows.length}`}>
        <ul className="flex flex-col gap-2 text-footnote">
          {group.rows.map((row, index) => (
            <li key={`${group.label}-${index}`} className="border-t border-neutral-200 pt-2">
              {row}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  ));
}

/** Everything the figure computes: the totals as tiles, the groups ranked by size, then every open item. */
function Ready({ figure, groups, title, lede }: Props & { figure: Figure; groups: Groups }) {
  const { t } = useTranslation();
  const totals = checklistTotals(figure.value);
  const ranked: RankedItem[] = groups.map((group) => ({
    id: group.label,
    label: group.label,
    value: group.rows.length,
    display: formatFigure(figureMeasure('data-checklist'), group.rows.length, 0),
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
          </>
        )
      }
    />
  );
}

interface Props {
  title: string;
  lede: string;
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
  if (state === 'error')
    return (
      <Template
        title={title}
        kind="overview"
        state="error"
        onRetry={() => void figures.refetch()}
        main={null}
      />
    );
  if (state !== 'ready' || !figures.data)
    return (
      <Template
        title={title}
        kind="overview"
        state={state === 'offline' ? 'offline' : 'loading'}
        main={null}
      />
    );
  const figure = figures.data.figures.find((candidate) => candidate.key === 'data-checklist');
  const content = figure?.status === 'ready' ? contentOf(figure, t) : null;
  if (!figure || content?.kind !== 'list')
    return (
      <Template
        title={title}
        kind="overview"
        state="empty"
        empty={figure === undefined ? t('analytics.empty') : t('analytics.notComputed')}
        main={null}
      />
    );
  return (
    <Ready
      figure={figure}
      groups={content.groups}
      title={title}
      lede={[t('analytics.checklist.intro'), t('analytics.asOf', { date: figures.data.asOf })].join(
        ' · ',
      )}
    />
  );
}
