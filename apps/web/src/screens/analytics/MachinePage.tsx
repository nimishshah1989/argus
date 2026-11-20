/* eslint-disable i18next/no-literal-string -- template kind, state and fact ids are prop values, not copy */
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { viewState } from '../../patterns/view-state.js';
import { DrillTrail, EmptyState } from '../../ui/elements/index.js';
import { Template } from './shell/patterns/template.js';
import { DrillTable } from './DrillTable.js';
import { machineIdOf, machineRecord, type MachineRecord } from './machine-record.js';
import { MachineAside, MachineMain } from './machine-summary.js';
import { MachineTiles } from './machine-tiles.js';
import { MACHINES_PATH, parseDrill, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/** The page's frame with the state line in place of the record: loading, offline or the error with Retry. */
function NotReady({
  title,
  state,
  empty,
  onRetry,
}: {
  title: string;
  state: string;
  empty: string;
  onRetry: () => void;
}) {
  if (state === 'error')
    return <Template kind="entity" title={title} state="error" onRetry={onRetry} main={null} />;
  if (state === 'empty')
    return <Template kind="entity" title={title} state="empty" empty={empty} main={null} />;
  return (
    <Template
      kind="entity"
      title={title}
      state={state === 'offline' ? 'offline' : 'loading'}
      main={null}
    />
  );
}

/** The machine's category and cell, the line under its code; none when the record holds neither. */
function ledeOf(record: MachineRecord): string | undefined {
  const parts = [record.machine.category, record.machine.cell].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  );
  return parts.length === 0 ? undefined : parts.join(' · ');
}

/**
 * The page once the figures are in: the record the engine holds for this machine, or the words for why not. `id` is the
 * machine's id or its code (a v2 chip's link carries the code).
 */
export function MachineView({
  group,
  figures,
  id: asked,
}: {
  group: AnalyticsGroup;
  figures: FiguresReply;
  id: string;
}) {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const figure: Figure | undefined = figures.figures.find(
    (candidate) => candidate.screen === 'machine-page',
  );
  // The second figure on this screen (67 R11): the reliability block is found by key, so it never becomes a tile.
  const reliability: Figure | undefined = figures.figures.find(
    (candidate) => candidate.key === 'reliability',
  );
  const ready = figure?.status === 'ready';
  const id = ready ? machineIdOf(figure?.value, asked) : asked;
  const record = ready && figure ? machineRecord(figure.value, id) : null;
  const drill = parseDrill(params.get('drill'));
  const code = record?.machine.code ?? t('analytics.machine.title');
  const frame = {
    kind: 'entity',
    title: code,
    trail: (
      <DrillTrail
        label={t('analytics.machine.trail')}
        steps={[{ label: t('analytics.machine.back'), to: MACHINES_PATH }, { label: code }]}
      />
    ),
  } as const;
  const drillArea = drill
    ? {
        drill: <DrillTable bare group={group} drill={drill} />,
        drillTitle: t('analytics.drill.title'),
      }
    : {};
  if (record === null)
    return (
      <Template
        {...frame}
        {...drillArea}
        main={
          <EmptyState title={t(ready ? 'analytics.machine.noRecord' : 'analytics.notComputed')} />
        }
      />
    );
  return (
    <Template
      {...frame}
      {...drillArea}
      lede={ledeOf(record)}
      figures={<MachineTiles record={record} asOf={figures.asOf} machineId={id} />}
      main={
        <MachineMain record={record} asOf={figures.asOf} machineId={id} reliability={reliability} />
      }
      aside={<MachineAside record={record} machineId={id} />}
    />
  );
}

/**
 * One machine's page (39b) at `/analytics/machines/:id`, on the entity template: its headline figures in a row, its
 * history in the long column and its nameplate beside it, every block drilled to the rows behind it. A figure that
 * is not computed, a record the engine does not hold and a fact the plant never recorded all say so.
 */
export function MachinePage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const figures = useAnalyticsFigures();
  const online = useOnline();
  const state = viewState({
    online,
    hasData: figures.data !== undefined,
    isEmpty: false,
    error: figures.error,
  });
  if (state !== 'ready' || !figures.data)
    return (
      <NotReady
        title={t('analytics.machine.title')}
        state={state}
        empty={t('analytics.empty')}
        onRetry={() => void figures.refetch()}
      />
    );
  return <MachineView group={group} figures={figures.data} id={id} />;
}
