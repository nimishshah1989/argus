/* eslint-disable i18next/no-literal-string -- template kind, state and fact ids are prop values, not copy */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { Card } from '../../ui/card.js';
import { displayDay } from './machine-values.js';
import { NOT_AVAILABLE, number } from './machine-parts.js';
import { Block, Facts } from './facts.js';
import { EngineTable } from './engine-table.js';
import {
  TREND_WORDS,
  drillLinkOf,
  reliabilityOf,
  type ReliabilityView,
} from './reliability-values.js';

/**
 * The machine page's reliability block (ticket 67, R13/R14): the fit in three plain cards with its sample, its
 * Kaplan-Meier quartiles and its Crow-AMSAA word, "Not enough history" with both counts, the critical spares as a
 * four-column table, and each list's drill — the machine's own tickets, or the Breakdown log above the 200-id cap.
 * Copy is the catalogue's; the stored figure is read through `reliabilityOf`, never trusted to a shape.
 */

type Figure = FiguresReply['figures'][number];

/** A list's drill: the machine's own rows, or the house fallback once it names more than one ask may take. */
function DrillFoot({
  machineId,
  type,
  ids,
}: {
  machineId: string;
  type: string;
  ids: readonly string[];
}) {
  const { t } = useTranslation();
  const link = drillLinkOf(machineId, type, ids);
  if (link === null) return null;
  if (link.kind === 'log')
    return (
      <p className="rg-note">
        {t('analytics.page.drillTooMany', { tickets: number(link.count, 0) })}{' '}
        <Link to={link.href}>{t('analytics.page.openLog')}</Link>
      </p>
    );
  return (
    <Link to={link.href} className="rg-link">
      {t('analytics.machine.seeRows')}
    </Link>
  );
}

/** The three numbers, the basis, the sample, the quartiles and the trend word beside its slope. */
function Fitted({ view, machineId }: { view: ReliabilityView; machineId: string }) {
  const { t } = useTranslation();
  if (view.fit.status !== 'fitted') return null;
  const fit = view.fit;
  const sample = {
    events: number(fit.events, 0),
    intervals: number(fit.completeIntervals, 0),
    hours: number(fit.censoredHours, 1),
  };
  return (
    <div className="rg-stack">
      <p data-reliability="basis" className="rg-note">
        {fit.basis === 'category'
          ? t('analytics.machine.fit.categoryFit', { category: fit.category })
          : t('analytics.machine.fit.ownFailures')}
      </p>
      <Facts
        facts={[
          { id: 'shape', label: t('analytics.machine.fit.shape'), value: number(fit.shape, 2) },
          {
            id: 'scale',
            label: t('analytics.machine.fit.scale'),
            value: number(fit.scale, 1),
            note: t('analytics.machine.fit.hours'),
          },
          {
            id: 'mean',
            label: t('analytics.machine.fit.mean'),
            value: number(fit.meanHours, 1),
            note: t('analytics.machine.fit.hours'),
          },
        ]}
      />
      <p data-reliability="sample" className="rg-note">
        {fit.basis === 'category'
          ? t('analytics.machine.fit.categorySample', { ...sample, own: number(fit.ownEvents, 0) })
          : t('analytics.machine.fit.sample', sample)}
      </p>
      <p data-reliability="quartiles" className="rg-note">
        {t('analytics.machine.fit.quartiles', {
          q25: number(fit.quartiles.q25, 1),
          median: number(fit.quartiles.median, 1),
          q75: number(fit.quartiles.q75, 1),
        })}
      </p>
      <p data-reliability="trend" className="rg-note">
        <strong>{t(TREND_WORDS[fit.trend.word])}</strong>{' '}
        <span>
          {t('analytics.machine.fit.trend', {
            beta: number(fit.trend.beta, 2),
            n: number(fit.trend.n, 0),
          })}
        </span>
      </p>
      <DrillFoot machineId={machineId} type="ticket" ids={view.drill.fit} />
    </div>
  );
}

/** The fit's body: its own or its category's numbers, "not enough history", or no working-hours basis. */
function FitBody({ view, machineId }: { view: ReliabilityView; machineId: string }) {
  const { t } = useTranslation();
  if (view.fit.status === 'fitted') return <Fitted view={view} machineId={machineId} />;
  if (view.fit.status === 'no_basis')
    return <p className="rg-note">{t('analytics.machine.fit.noBasis')}</p>;
  const fit = view.fit;
  return (
    <div className="rg-stack">
      <p className="rg-subhead">{t('analytics.machine.fit.notEnough')}</p>
      <p data-reliability="shortfall" className="rg-note">
        {fit.category === null
          ? t('analytics.machine.fit.notEnoughNoCategory', {
              own: number(fit.ownEvents, 0),
              minimum: number(fit.minimum, 0),
            })
          : t('analytics.machine.fit.notEnoughDetail', {
              own: number(fit.ownEvents, 0),
              categoryEvents: number(fit.categoryEvents, 0),
              category: fit.category,
              minimum: number(fit.minimum, 0),
            })}
      </p>
      <DrillFoot machineId={machineId} type="ticket" ids={view.drill.fit} />
    </div>
  );
}

/** The spares' body: the ranked table, the "N parts, M shown" line, and the empty state that offers no link. */
function SparesBody({ view, machineId }: { view: ReliabilityView; machineId: string }) {
  const { t } = useTranslation();
  const { rows, total } = view.spares;
  if (rows.length === 0) return <p className="rg-note">{t('analytics.machine.spares.none')}</p>;
  return (
    <div className="rg-stack">
      <p className="rg-note">{t('analytics.machine.spares.ranked')}</p>
      <EngineTable
        caption={t('analytics.machine.spares.part')}
        header={[
          t('analytics.machine.spares.part'),
          t('analytics.machine.spares.uses'),
          t('analytics.machine.spares.hours'),
          t('analytics.machine.spares.lastUsed'),
        ]}
        rows={rows.map((row, index) => ({
          index,
          row: [
            row.name,
            number(row.uses, 0),
            number(row.downtimeHours, 1),
            row.lastOn === null ? t(NOT_AVAILABLE) : displayDay(row.lastOn),
          ],
        }))}
        unsortable={new Set([3])}
      />
      {total !== null && total > rows.length ? (
        <p data-reliability="top" className="rg-note">
          {t('analytics.machine.spares.topFive', {
            total: number(total, 0),
            shown: number(rows.length, 0),
          })}
        </p>
      ) : null}
      <DrillFoot machineId={machineId} type="ticket" ids={view.drill.spares} />
    </div>
  );
}

/** The two sections: the reliability fit and the critical spares, each honest when it has nothing to print. */
export function Reliability({
  figure,
  machineId,
}: {
  figure: Figure | undefined;
  machineId: string;
}) {
  const { t } = useTranslation();
  const ready = figure?.status === 'ready';
  const view = ready && figure ? reliabilityOf(figure.value, machineId) : null;
  const fallback = (
    <p className="rg-note">{ready ? t(NOT_AVAILABLE) : t('analytics.notComputed')}</p>
  );
  return (
    <>
      <Card named title={t('analytics.machine.reliability')}>
        {view === null ? fallback : <FitBody view={view} machineId={machineId} />}
      </Card>
      <Block title={t('analytics.machine.spares')}>
        {view === null ? fallback : <SparesBody view={view} machineId={machineId} />}
      </Block>
    </>
  );
}
