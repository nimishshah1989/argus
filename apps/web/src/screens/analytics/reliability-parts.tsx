import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { displayDay } from './machine-values.js';
import { NOT_AVAILABLE, number } from './machine-parts.js';
import { InsightBanner, StatusChip } from '../../ui/elements/index.js';
import type { Tone4 } from '../../ui/meaning/index.js';
import { KeyKpi, KeyTable } from './key-body.js';
import { Section } from './parts.js';
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

/** A failure trend in words and a tone: coming faster is bad, slower is good, no clear trend is neither. */
const TREND_TONE: Record<keyof typeof TREND_WORDS, Tone4> = {
  improving: 'good',
  worsening: 'bad',
  no_clear_trend: 'neutral',
};

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
      <p className="text-footnote text-neutral-600">
        {t('analytics.page.drillTooMany', { tickets: number(link.count, 0) })}{' '}
        <Link to={link.href} className="font-semibold text-accent-text">
          {t('analytics.page.openLog')}
        </Link>
      </p>
    );
  return (
    <Link
      to={link.href}
      className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
    >
      {t('analytics.machine.seeRows')}
    </Link>
  );
}

type Fitted = Extract<ReliabilityView['fit'], { status: 'fitted' }>;

/** The three fitted numbers as tiles: shape, scale and mean time between failures, each as the engine gave it. */
function FitTiles({ fit }: { fit: Fitted }) {
  const { t } = useTranslation();
  const hours = t('analytics.machine.fit.hours');
  const tiles = [
    { label: t('analytics.machine.fit.shape'), value: number(fit.shape, 2), sub: null },
    { label: t('analytics.machine.fit.scale'), value: number(fit.scale, 1), sub: hours },
    { label: t('analytics.machine.fit.mean'), value: number(fit.meanHours, 1), sub: hours },
  ];
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {tiles.map((kpi) => (
        <li key={kpi.label}>
          <KeyKpi kpi={kpi} />
        </li>
      ))}
    </ul>
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
    <div className="flex flex-col gap-3">
      <p data-reliability="basis" className="text-footnote text-neutral-600">
        {fit.basis === 'category'
          ? t('analytics.machine.fit.categoryFit', { category: fit.category })
          : t('analytics.machine.fit.ownFailures')}
      </p>
      <FitTiles fit={fit} />
      <p data-reliability="sample" className="text-footnote text-neutral-600">
        {fit.basis === 'category'
          ? t('analytics.machine.fit.categorySample', { ...sample, own: number(fit.ownEvents, 0) })
          : t('analytics.machine.fit.sample', sample)}
      </p>
      <p data-reliability="quartiles" className="text-footnote text-neutral-600">
        {t('analytics.machine.fit.quartiles', {
          q25: number(fit.quartiles.q25, 1),
          median: number(fit.quartiles.median, 1),
          q75: number(fit.quartiles.q75, 1),
        })}
      </p>
      <p
        data-reliability="trend"
        className="flex flex-wrap items-center gap-2 text-footnote text-neutral-600"
      >
        <StatusChip tone={TREND_TONE[fit.trend.word]}>{t(TREND_WORDS[fit.trend.word])}</StatusChip>
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
    return <p className="text-body text-neutral-600">{t('analytics.machine.fit.noBasis')}</p>;
  const fit = view.fit;
  return (
    <InsightBanner
      tone="watch"
      title={t('analytics.machine.fit.notEnough')}
      action={<DrillFoot machineId={machineId} type="ticket" ids={view.drill.fit} />}
    >
      <p data-reliability="shortfall">
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
    </InsightBanner>
  );
}

/** The spares' body: the ranked table, the "N parts, M shown" line, and the empty state that offers no link. */
function SparesBody({ view, machineId }: { view: ReliabilityView; machineId: string }) {
  const { t } = useTranslation();
  const { rows, total } = view.spares;
  if (rows.length === 0)
    return <p className="text-body text-neutral-600">{t('analytics.machine.spares.none')}</p>;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-footnote text-neutral-600">{t('analytics.machine.spares.ranked')}</p>
      <KeyTable
        table={{
          title: '',
          header: [
            t('analytics.machine.spares.part'),
            t('analytics.machine.spares.uses'),
            t('analytics.machine.spares.hours'),
            t('analytics.machine.spares.lastUsed'),
          ],
          rows: rows.map((row) => [
            row.name,
            number(row.uses, 0),
            number(row.downtimeHours, 1),
            row.lastOn === null ? t(NOT_AVAILABLE) : displayDay(row.lastOn),
          ]),
          rowCount: rows.length,
          truncated: false,
        }}
      />
      {total !== null && total > rows.length ? (
        <p data-reliability="top" className="text-footnote text-neutral-600">
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
    <p className="text-body text-neutral-600">
      {ready ? t(NOT_AVAILABLE) : t('analytics.notComputed')}
    </p>
  );
  return (
    <>
      <Section title={t('analytics.machine.reliability')}>
        {view === null ? fallback : <FitBody view={view} machineId={machineId} />}
      </Section>
      <Section title={t('analytics.machine.spares')}>
        {view === null ? fallback : <SparesBody view={view} machineId={machineId} />}
      </Section>
    </>
  );
}
