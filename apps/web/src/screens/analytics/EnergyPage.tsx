import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { MAX_DRILL_IDS, type FiguresReply } from '@uptimo/shared/analytics';
import { DrillPanel, EmptyState } from '../../ui/elements/index.js';
import { DrillTable } from './DrillTable.js';
import { EnergyRows } from './energy-rows.js';
import { EnergyGridView, type TilePick } from './energy-tiles.js';
import { contentOf, type EnergyContent, type EnergyTile } from './figure-content.js';
import { drillHref, parseDrill, type AnalyticsGroup } from './groups.js';
import { OVERVIEW } from './screen-state.js';
import { Template } from './shell/patterns/template.js';

type Figure = FiguresReply['figures'][number];
type Pick = TilePick;

const AXIS_CELL: Pick['axis'] = 'cell';
const AXIS_LOCATION: Pick['axis'] = 'location';

export function tileOf(content: EnergyContent, pick: Pick): EnergyTile | null {
  const grid = pick.axis === 'cell' ? content.byCell : content.byLocation;
  return grid.tiles.find((tile) => tile.key === pick.key) ?? null;
}

/** The machines a tile's panel lists: exactly the engine's own for that tile, so the panel always matches its count. */
export function panelIds(content: EnergyContent, pick: Pick): readonly string[] {
  return tileOf(content, pick)?.machineIds ?? [];
}

function titleOf(t: TFunction, pick: Pick): string {
  if (pick.axis === 'location') return t('analytics.energy.drillLocation', { location: pick.key });
  return t('analytics.energy.drillCell', {
    cell: pick.key === '—' ? t('analytics.energy.noCell') : pick.key,
  });
}

/** The three grids in the platform's order (cell, location, the per-machine average) and the figure's own rows link. */
function Grids({
  content,
  figure,
  group,
  linked,
  onPick,
}: {
  content: EnergyContent;
  figure: Figure;
  group: AnalyticsGroup;
  linked: boolean;
  onPick: (pick: Pick) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div data-span="full">
        <EnergyGridView
          grid={content.byCell}
          id="cell"
          title={t('analytics.energy.cellTitle')}
          axisLabel={t('analytics.drill.cell')}
          description={t('analytics.energy.cellDescription', { pct: content.effFactorPct })}
          onPick={(key) => onPick({ axis: AXIS_CELL, key })}
        />
      </div>
      <div data-span="full">
        <EnergyGridView
          grid={content.byLocation}
          id="location"
          title={t('analytics.energy.locationTitle')}
          axisLabel={t('analytics.energy.axisLocation')}
          description={t('analytics.energy.locationDescription')}
          onPick={(key) => onPick({ axis: AXIS_LOCATION, key })}
        />
      </div>
      <div data-span="full">
        <EnergyGridView
          grid={content.byMachine}
          id="machine"
          title={t('analytics.energy.machineTitle')}
          axisLabel={t('analytics.drill.cell')}
          description={t('analytics.energy.machineDescription')}
        />
      </div>
      {linked ? (
        <div data-span="full">
          <Link
            to={`${drillHref(group.id, figure.drill.type, figure.drill.ids)}&screen=${figure.screen}`}
            className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
          >
            {t('analytics.drill.open')}
          </Link>
        </div>
      ) : null}
    </>
  );
}

/** The side panel of the machines behind a tile; the last tile stays in it while it slides out. */
function TilePanel({
  content,
  pick,
  open,
  onClose,
}: {
  content: EnergyContent;
  pick: Pick | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <DrillPanel
      open={open && pick !== null && tileOf(content, pick) !== null}
      onClose={onClose}
      title={pick === null ? '' : titleOf(t, pick)}
      closeLabel={t('analytics.energy.back')}
    >
      {pick === null ? null : (
        <EnergyRows ids={panelIds(content, pick)} caption={titleOf(t, pick)} />
      )}
    </DrillPanel>
  );
}

/**
 * A5 energy (41e-1, rebuilt in the new look by ticket 87): the two load grids and the per-machine average grid on
 * the overview template. A tile is a figure (the connected load, with the running load, the machine count and the
 * average beneath it); a tile with machines opens a panel with the machines behind it, and the way back closes it.
 * `contentOf` maps the figure; this screen only places what it mapped. The figure's own "See the rows" link and
 * page drill stay as they were.
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
  // The panel closes by its own flag, so the last tile's title and rows stay while it slides out.
  const [open, setOpen] = useState(false);
  const content = figure ? contentOf(figure, t) : null;
  if (!figure || figure.status !== 'ready' || content?.kind !== 'energy')
    return (
      <Template
        title={t('analytics.screen.a5-energy')}
        kind={OVERVIEW}
        main={<EmptyState title={t('analytics.notComputed')} />}
      />
    );
  const drill = parseDrill(params.get('drill'));
  const ids = figure.drill.ids;
  const linked = ids.length > 0 && ids.length <= MAX_DRILL_IDS && drill === null;
  return (
    <>
      <Template
        title={content.title}
        kind={OVERVIEW}
        main={
          <>
            {drill === null ? null : (
              <div data-span="full">
                <DrillTable group={group} drill={drill} headingLevel={3} />
              </div>
            )}
            <Grids
              content={content}
              figure={figure}
              group={group}
              linked={linked}
              onPick={(next) => {
                setPick(next);
                setOpen(true);
              }}
            />
          </>
        }
      />
      <TilePanel content={content} pick={pick} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
