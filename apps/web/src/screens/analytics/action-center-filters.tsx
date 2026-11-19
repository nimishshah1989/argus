import { useTranslation } from 'react-i18next';
import type { NudgeRule, NudgeSeverity } from '@uptimo/shared';
import type { MessageKey } from '@uptimo/shared/i18n';
import { Input, Label, Select } from '../../ui/input.js';
import { KpiTile } from '../../ui/elements/index.js';
import { NUDGE_SEVERITY, figureMeasure, formatFigure } from '../../ui/meaning/index.js';
import { RULE_LABELS, type ActionCenterView, type CardFilters } from './action-center.js';

/** The filter bar and the four priority tiles of the Action Center (packet 44d, rebuilt by ticket 87). */

/** The words that say a priority needs a person; only a high or medium count above zero draws a tone. */
const VERDICT: Partial<Record<NudgeSeverity, MessageKey>> = {
  high: 'analytics.actionCenter.verdict.high',
  med: 'analytics.actionCenter.verdict.med',
};

/** Four tiles, one per priority: the open count, with the meaning map's tone said in words when something is open. */
export function SeverityTiles({ view }: { view: ActionCenterView }) {
  const { t } = useTranslation();
  const measure = figureMeasure('action-center');
  return view.tiles.map((tile) => {
    const verdict = VERDICT[tile.severity];
    return (
      <div key={tile.severity} data-tile={tile.severity} className="h-full min-w-0">
        <KpiTile
          label={t(tile.label)}
          value={tile.count}
          format={(shown) => formatFigure(measure, shown, 0)}
          tone={NUDGE_SEVERITY[tile.severity].tone}
          verdict={verdict && tile.count > 0 ? t(verdict) : undefined}
        />
      </div>
    );
  });
}

type Change = (next: Partial<CardFilters>) => void;

function StatusTabs({
  view,
  filters,
  onChange,
}: {
  view: ActionCenterView;
  filters: CardFilters;
  onChange: Change;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      aria-label={t('analytics.actionCenter.tabs')}
      className="flex flex-wrap gap-1 rounded-control bg-neutral-200 p-1"
    >
      {view.tabs.map((tab) => (
        <button
          key={tab.status}
          type="button"
          role="tab"
          aria-selected={filters.status === tab.status}
          onClick={() => onChange({ status: tab.status })}
          className="flex min-h-target-min items-center gap-1 rounded-lg px-3 text-footnote font-semibold text-neutral-700 aria-selected:bg-surface aria-selected:text-neutral-900 aria-selected:shadow-card"
        >
          {t(tab.label)}
          <span className="tabular-nums">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}

function FilterFields({
  view,
  filters,
  onChange,
}: {
  view: ActionCenterView;
  filters: CardFilters;
  onChange: Change;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <Label htmlFor="action-center-priority">{t('analytics.actionCenter.priorityLabel')}</Label>
        <Select
          id="action-center-priority"
          value={filters.severity}
          onChange={(event) => onChange({ severity: event.target.value as NudgeSeverity | '' })}
        >
          <option value="">{t('analytics.actionCenter.priority')}</option>
          {view.tiles.map((tile) => (
            <option key={tile.severity} value={tile.severity}>
              {t(tile.label)}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="action-center-type">{t('analytics.actionCenter.typeLabel')}</Label>
        <Select
          id="action-center-type"
          value={filters.rule}
          onChange={(event) => onChange({ rule: event.target.value as NudgeRule | '' })}
        >
          <option value="">{t('analytics.actionCenter.type')}</option>
          {view.types.map((option) => (
            <option key={option.rule} value={option.rule}>
              {t(RULE_LABELS[option.rule])}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex min-w-48 flex-1 flex-col gap-1">
        <Label htmlFor="action-center-search">{t('analytics.actionCenter.search')}</Label>
        <Input
          id="action-center-search"
          type="search"
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
        />
      </div>
    </div>
  );
}

export function FilterBar({
  view,
  filters,
  onChange,
}: {
  view: ActionCenterView;
  filters: CardFilters;
  onChange: Change;
}) {
  return (
    <div className="flex flex-col gap-3">
      <StatusTabs view={view} filters={filters} onChange={onChange} />
      <FilterFields view={view} filters={filters} onChange={onChange} />
    </div>
  );
}
