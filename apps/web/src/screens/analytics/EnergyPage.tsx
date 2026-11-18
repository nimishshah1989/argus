import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MAX_DRILL_IDS, type FiguresReply } from '@uptimo/shared/analytics';
import type { MachineRow } from '@uptimo/domain';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { Grids, type TilePick } from './EnergyGrids.js';
import { contentOf, type EnergyContent, type EnergyTile } from './figure-content.js';
import { drillHref, parseDrill, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];
type Pick = TilePick;
type Drill = NonNullable<ReturnType<typeof parseDrill>>;

const MACHINE = 'machine';

function matches(row: MachineRow, pick: Pick): boolean {
  if (pick.axis === 'location') return row.location === pick.key;
  const cell = row.cell?.trim() ?? '';
  return pick.key === '—' ? cell === '' : cell === pick.key;
}

function tileOf(content: EnergyContent, pick: Pick): EnergyTile | null {
  const grid = pick.axis === 'cell' ? content.byCell : content.byLocation;
  return grid.tiles.find((tile) => tile.key === pick.key) ?? null;
}

function titleOf(t: TFunction, pick: Pick): string {
  if (pick.axis === 'location') return t('analytics.energy.drillLocation', { location: pick.key });
  return t('analytics.energy.drillCell', {
    cell: pick.key === '—' ? t('analytics.energy.noCell') : pick.key,
  });
}

/** A tile filter or the figure's own drill, rendered above the grids; only one is shown at a time. */
function EnergyDrill({
  content,
  figure,
  group,
  pick,
  drill,
  onBack,
}: {
  content: EnergyContent;
  figure: Figure;
  group: AnalyticsGroup;
  pick: Pick | null;
  drill: Drill | null;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  if (pick !== null) {
    if (tileOf(content, pick) === null) return null;
    return (
      <DrillTable
        group={group}
        drill={{ type: MACHINE, ids: figure.drill.ids }}
        where={(row) => matches(row as MachineRow, pick)}
        title={titleOf(t, pick)}
        onBack={onBack}
        backLabel={t('analytics.energy.back')}
      />
    );
  }
  return drill === null ? null : <DrillTable group={group} drill={drill} />;
}

/** The figure's own "See the rows": every CNC machine behind the grids, hidden while a tile or drill is open. */
function DrillLink({
  figure,
  group,
  hidden,
}: {
  figure: Figure;
  group: AnalyticsGroup;
  hidden: boolean;
}) {
  const { t } = useTranslation();
  const ids = figure.drill.ids;
  if (hidden || ids.length === 0 || ids.length > MAX_DRILL_IDS) return null;
  return (
    <Link
      to={`${drillHref(group.id, figure.drill.type, ids)}&screen=${figure.screen}`}
      className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
    >
      {t('analytics.drill.open')}
    </Link>
  );
}

/**
 * A5 energy (41e-1): the two keyed heat grids and the per-machine average grid, in the platform's green scale and
 * its Connected/Running words. A tile click filters the figure's own machine drill reply by that cell or location;
 * the screen keeps one filter at a time, and the way back clears it. `contentOf` maps the figure; this module
 * only paints what it mapped.
 */
export function EnergyPage({
  figure,
  group,
}: {
  figure: Figure | undefined;
  group: AnalyticsGroup;
}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [pick, setPick] = useState<Pick | null>(null);
  const content = figure ? contentOf(figure, t) : null;
  if (!figure || figure.status !== 'ready' || content?.kind !== 'energy')
    return (
      <div data-page="not-computed" className="rounded-2xl bg-surface p-4 shadow-card">
        <p className="text-body font-medium text-neutral-600">{t('analytics.notComputed')}</p>
      </div>
    );
  const drill = parseDrill(params.get('drill'));
  const choose = (axis: Pick['axis'], key: string) =>
    setPick((current) =>
      current !== null && current.axis === axis && current.key === key ? null : { axis, key },
    );
  return (
    <Stack gap={6}>
      <h2 className="text-title3 font-semibold">{content.title}</h2>
      <EnergyDrill
        content={content}
        figure={figure}
        group={group}
        pick={pick}
        drill={drill}
        onBack={() => setPick(null)}
      />
      <Grids content={content} selected={pick} onPick={choose} />
      <DrillLink figure={figure} group={group} hidden={pick !== null || drill !== null} />
    </Stack>
  );
}
