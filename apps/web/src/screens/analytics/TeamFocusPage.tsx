/* eslint-disable i18next/no-literal-string -- the template's kind and state are prop values, not copy */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Card } from '../../ui/card.js';
import { KpiTile, NO_VALUE } from '../../ui/elements/index.js';
import { Template } from './shell/patterns/template.js';
import { FigureDrill } from './KeyPage.js';
import { contentOf } from './figure-content.js';
import type { AnalyticsGroup } from './groups.js';
import {
  FOCUS_LANE_HINTS,
  FOCUS_LANE_LABELS,
  focusActions,
  focusLaneGroups,
  focusStatusKey,
  printedNumber,
  stakeText,
  type FocusAction,
  type FocusLaneGroup,
} from './team-focus-actions.js';

type Figure = FiguresReply['figures'][number];

/**
 * One action: the engine's title and stake, then the platform's default status, owner and note. A flat row on its
 * lane's card, ruled from the one above (no second raised card).
 */
function ActionRow({ action }: { action: FocusAction }) {
  const { t } = useTranslation();
  return (
    <li
      data-focus-action={action.key}
      className="flex flex-col gap-1 border-t border-neutral-200 pt-3"
    >
      <p className="text-body font-semibold">{action.title}</p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-footnote text-neutral-600">
        {action.machine === null ? null : (
          <span>{t('analytics.teamFocus.machine', { code: action.machine })}</span>
        )}
        <span>{t('analytics.teamFocus.stake', { hours: stakeText(action.stake) })}</span>
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-footnote text-neutral-600">
        <span>{t('analytics.teamFocus.status', { status: t(focusStatusKey(action.status)) })}</span>
        <span>
          {t('analytics.teamFocus.owner', {
            owner: action.owner === '' ? t('analytics.teamFocus.ownerNone') : action.owner,
          })}
        </span>
        <span>
          {t('analytics.teamFocus.note', {
            note: action.note === '' ? t('analytics.teamFocus.noteNone') : action.note,
          })}
        </span>
      </p>
    </li>
  );
}

/** One lane: its platform name and hint, how many are open, then every action the engine ranked in it. */
function LaneCard({ group }: { group: FocusLaneGroup }) {
  const { t } = useTranslation();
  const open = group.actions.filter(
    (action) => action.status === 'open' || action.status === 'prog',
  ).length;
  return (
    <div data-span="full">
      <Card title={t(FOCUS_LANE_LABELS[group.lane])}>
        <p className="text-footnote text-neutral-600">{t(FOCUS_LANE_HINTS[group.lane])}</p>
        <p className="text-footnote font-semibold tabular-nums">
          {t('analytics.teamFocus.openOf', { open, total: group.actions.length })}
        </p>
        <ul className="flex flex-col gap-3">
          {group.actions.map((action) => (
            <ActionRow key={action.key} action={action} />
          ))}
        </ul>
      </Card>
    </div>
  );
}

/**
 * Team Focus (43e, rebuilt by ticket 87): the engine's three counts as tiles, then its actions in lane cards. Each
 * tile prints the engine's own text, so a figure stays exact; its note is the engine's own second line. Status, owner
 * and note are the platform's defaults until the later server packet stores them, so this screen never pretends to
 * save. The drill is the machine set the actions themselves name.
 */
export function TeamFocusPage({
  figure,
  group,
  title,
  lede,
  drill,
}: {
  figure: Figure | undefined;
  group: AnalyticsGroup;
  title: string;
  lede: string;
  drill: ReactNode;
}) {
  const { t } = useTranslation();
  const content = figure?.status === 'ready' ? contentOf(figure, t) : null;
  if (!figure || content?.kind !== 'page')
    return (
      <Template
        title={title}
        kind="overview"
        state="empty"
        empty={t('analytics.teamFocus.notReady')}
        main={null}
      />
    );
  const lanes = focusLaneGroups(focusActions(figure.value));
  return (
    <Template
      title={title}
      lede={lede}
      kind="overview"
      figures={content.kpis.map((kpi, index) => (
        <div key={`${kpi.label}-${index}`} className="h-full min-w-0">
          <KpiTile
            label={kpi.label}
            value={kpi.value === NO_VALUE ? null : (printedNumber(kpi.value) ?? 0)}
            format={() => kpi.value}
            note={kpi.sub ?? undefined}
          />
        </div>
      ))}
      main={
        <>
          {drill === null ? null : <div data-span="full">{drill}</div>}
          <div data-span="full">
            <FigureDrill figure={figure} group={group} />
          </div>
          {lanes.length === 0 ? null : (
            <h3 data-span="full" className="text-title3 font-semibold">
              {t('analytics.teamFocus.listTitle')}
            </h3>
          )}
          {lanes.map((lane) => (
            <LaneCard key={lane.lane} group={lane} />
          ))}
        </>
      }
    />
  );
}
