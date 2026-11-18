import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Stack } from '../../ui/layout.js';
import { KeyPage } from './KeyPage.js';
import type { AnalyticsGroup } from './groups.js';
import {
  FOCUS_LANE_HINTS,
  FOCUS_LANE_LABELS,
  focusActions,
  focusLaneGroups,
  focusStatusKey,
  type FocusAction,
  type FocusLaneGroup,
} from './team-focus-actions.js';

type Figure = FiguresReply['figures'][number];

const oneDecimal = new Intl.NumberFormat('en-GB', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** One action: the engine's title and stake, then the platform's default status, owner and note. */
function ActionRow({ action }: { action: FocusAction }) {
  const { t } = useTranslation();
  return (
    <li
      data-focus-action={action.key}
      className="flex flex-col gap-1 rounded-2xl bg-surface p-4 shadow-card"
    >
      <p className="text-body font-semibold text-neutral-900">{action.title}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-footnote text-neutral-600">
        {action.machine === null ? null : (
          <span>{t('analytics.teamFocus.machine', { code: action.machine })}</span>
        )}
        <span>{t('analytics.teamFocus.stake', { hours: oneDecimal.format(action.stake) })}</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-footnote text-neutral-600">
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
      </div>
    </li>
  );
}

/** One lane: its platform name and hint, then every action the engine ranked in it, in the key's order. */
function LaneGroup({ group }: { group: FocusLaneGroup }) {
  const { t } = useTranslation();
  const open = group.actions.filter(
    (action) => action.status === 'open' || action.status === 'prog',
  ).length;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-body font-semibold">{t(FOCUS_LANE_LABELS[group.lane])}</h3>
        <span className="text-footnote text-neutral-600">
          {t('analytics.teamFocus.openOf', { open, total: group.actions.length })}
        </span>
      </div>
      <p className="text-footnote text-neutral-600">{t(FOCUS_LANE_HINTS[group.lane])}</p>
      <ul className="flex flex-col gap-2">
        {group.actions.map((action) => (
          <ActionRow key={action.key} action={action} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Team Focus (43e): the key page's three KPIs through the one KeyPage seam, then the engine's 31 actions
 * grouped by lane. Status, owner and note are the platform's defaults; their persistence is the later server
 * packet, so this screen never pretends to save. The drill is the machine set the actions themselves name.
 */
export function TeamFocusPage({
  figure,
  group,
}: {
  figure: Figure | undefined;
  group: AnalyticsGroup;
}) {
  const { t } = useTranslation();
  const actions = figure?.status === 'ready' ? focusActions(figure.value) : [];
  const lanes = focusLaneGroups(actions);
  return (
    <Stack gap={6}>
      <KeyPage figure={figure} group={group} />
      {lanes.length === 0 ? null : (
        <section className="flex flex-col gap-4">
          <h2 className="text-title3 font-semibold">{t('analytics.teamFocus.listTitle')}</h2>
          {lanes.map((lane) => (
            <LaneGroup key={lane.lane} group={lane} />
          ))}
        </section>
      )}
    </Stack>
  );
}
