/* eslint-disable i18next/no-literal-string -- icon names, tones and kinds only; every visible word comes in the model or t() */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { SyncStatus } from '../../../ui/v2/sync-status.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import type { AgeBucket, BoardColumn, BoardModel } from './model.js';
import { AGE_INK, MachineTile, STATUS } from './parts.js';

/** The answer first: the stops verdict, then how fresh the numbers are, the sync pill and the refresh promise. */
function Verdict({ model }: { model: BoardModel }) {
  const { t } = useTranslation();
  const stops = model.takeaways['board.stops'];
  return (
    <div className="v2-verdict">
      {stops ? <Takeaway data={stops} /> : null}
      <p className="v2-sub v2-row v2-gap-8">
        <span>{model.updated}</span>
        <SyncStatus />
        <span>{t('live.refresh')}</span>
      </p>
    </div>
  );
}

/** The Desk's tabs on the left; "Report a problem" (primary) and "Open TV view" (wide screens only) on the right. */
function Actions({ links, tabs }: { links: BoardModel['links']; tabs?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {tabs ?? <span />}
      <div className="flex flex-wrap items-center gap-2">
        {links.map((link) =>
          link.wideOnly ? (
            <span key={link.to} className="hidden sm:block">
              <Link to={link.to} className="v2-btn">
                {link.label}
              </Link>
            </span>
          ) : (
            <Link key={link.to} to={link.to} className="v2-btn v2-btn-primary">
              {link.label}
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

/** Running and Stopped as KPI cards: the count, what it is out of, and how the stops split. */
function PulseCards({ pulse }: { pulse: BoardModel['pulse'] }) {
  const { t } = useTranslation();
  return (
    <section aria-label={pulse.aria} className="v2-grid v2-grid-2">
      <div className="v2-card v2-kpi">
        <div className="v2-kpi-label">{pulse.runningLabel}</div>
        <div className="v2-kpi-row">
          <span data-testid="count-running" className="v2-kpi-value">
            {pulse.running}
          </span>
        </div>
        <p className="v2-kpi-meaning">{pulse.share}</p>
      </div>
      <div className="v2-card v2-kpi">
        <div className="v2-kpi-label">{pulse.stoppedLabel}</div>
        <div className="v2-kpi-row">
          <span
            data-testid="count-stopped"
            className={`v2-kpi-value ${pulse.stopped > 0 ? 'v2-seg-loss' : ''}`}
          >
            {pulse.stopped}
          </span>
        </div>
        <p className="v2-kpi-meaning">{pulse.split}</p>
        {pulse.longest ? (
          <p className="v2-kpi-more">
            {pulse.longest} <KeyPill text={t('live.longest')} tone="loss" icon="alert" />
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** One status column as a card: its chip, count and name, then every stop, oldest first. Empty: the head alone. */
function ColumnCard({ column }: { column: BoardColumn }) {
  const { t } = useTranslation();
  const { tone, icon } = STATUS[column.status];
  return (
    <section aria-label={column.title} className="v2-card v2-pad">
      <div className="v2-card-head">
        <h2 className="v2-h2 v2-row v2-gap-8">
          <KeyPill text={column.chip} tone={tone} icon={icon} />{' '}
          <span>
            {column.count} · {column.title}
          </span>
        </h2>
      </div>
      {column.rows.length > 0 ? (
        <table className="v2-table">
          <tbody>
            {column.rows.map((row) => (
              <tr key={row.id} data-testid="tile">
                <td>
                  <span className="flex min-w-0 items-center gap-3">
                    <MachineTile segment={row.segment} tv={false} />
                    <span className="min-w-0">
                      <EntityChip kind="machine" id={row.id} label={row.code} />
                      <small className="v2-sub block">{row.sub}</small>
                    </span>
                  </span>
                </td>
                <td
                  className={`v2-num-cell whitespace-nowrap ${row.ageTone ? AGE_INK[row.ageTone] : ''}`}
                >
                  {row.age}
                  {row.longest ? (
                    <span className="block">
                      <KeyPill text={t('live.longest')} tone="loss" icon="alert" />
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

const countInk = (b: AgeBucket) =>
  b.tone === 'muted' ? 'board-muted' : b.tone === 'danger' ? AGE_INK.danger : '';

/** Open breakdowns by age: its line, then one bar per bucket against the largest; "Over 1 day" stands out. */
function AgesCard({ model }: { model: BoardModel }) {
  const { ages } = model;
  const take = model.takeaways['board.ages'];
  const most = Math.max(1, ...ages.buckets.map((b) => b.count));
  return (
    <section aria-label={ages.title} className="v2-card v2-pad">
      <div className="v2-card-head">
        <h2 className="v2-h2">{ages.title}</h2>
      </div>
      {take ? <Takeaway data={take} /> : null}
      <dl className="board-bars">
        {ages.buckets.map((bucket) => (
          <div key={bucket.key} className="board-bar" data-tone={bucket.tone ?? undefined}>
            <dt>
              {bucket.label}
              {bucket.key === 'overDay' && bucket.count > 0 ? (
                <KeyPill text={ages.overDayTitle} tone="loss" />
              ) : null}
            </dt>
            <dd>
              <span className="board-bar-track" aria-hidden="true">
                <span style={{ width: `${(bucket.count / most) * 100}%` }} />
              </span>
              <span
                data-testid={`age-${bucket.key}`}
                className={`board-bar-count ${countInk(bucket)}`}
              >
                {bucket.count}
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Response today and Repair today as KPI cards; "—" and no note when there is nothing to average. */
function DayCards({ today }: { today: BoardModel['today'] }) {
  return (
    <div className="v2-grid v2-grid-2">
      {today.map((tile) => (
        <div key={tile.id} role="group" aria-label={tile.label} className="v2-card v2-kpi">
          <div className="v2-kpi-label">{tile.label}</div>
          <div className="v2-kpi-row">
            <span className="v2-kpi-value">{tile.value}</span>
          </div>
          {tile.note ? <p className="v2-kpi-meaning">{tile.note}</p> : null}
        </div>
      ))}
    </div>
  );
}

/**
 * The browser board inside the Shell (S30): the verdict and freshness, the Desk tabs and actions, Running and Stopped
 * cards, the three status columns as tables with every stop, then the ages card beside the day score.
 */
export function BrowserBoard({ model, tabs }: { model: BoardModel; tabs?: ReactNode }): ReactNode {
  return (
    <>
      <Verdict model={model} />
      <Actions links={model.links} tabs={tabs} />
      <PulseCards pulse={model.pulse} />
      <div className="v2-grid v2-grid-3">
        {model.columns.map((column) => (
          <ColumnCard key={column.column} column={column} />
        ))}
      </div>
      <div className="v2-grid v2-grid-2">
        <AgesCard model={model} />
        <DayCards today={model.today} />
      </div>
    </>
  );
}
