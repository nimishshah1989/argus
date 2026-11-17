import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import { useAnalyticsFigures } from '../../api.js';
import { useOnline } from '../../data/index.js';
import { StateNotice } from '../../patterns/frame.js';
import { viewState, type ViewState } from '../../patterns/view-state.js';
import { Stack } from '../../ui/layout.js';
import { DrillTable } from './DrillTable.js';
import { machineRecord, type MachineRecord } from './machine-record.js';
import { RecordBody } from './machine-summary.js';
import { MACHINES_PATH, parseDrill, type AnalyticsGroup } from './groups.js';

type Figure = FiguresReply['figures'][number];

/** The record's own identity line: category and cell, when the record carries them. */
function Subtitle({ record }: { record: MachineRecord | null }) {
  const parts = [record?.machine.category, record?.machine.cell].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  );
  if (parts.length === 0) return null;
  return <p className="text-footnote text-neutral-600">{parts.join(' · ')}</p>;
}

/** The honest body: not computed, no record, or the whole record. */
function MachineBody({
  ready,
  record,
  asOf,
  machineId,
}: {
  ready: boolean;
  record: MachineRecord | null;
  asOf: string;
  machineId: string;
}) {
  const { t } = useTranslation();
  if (!ready)
    return (
      <div data-machine="not-computed" className="rounded-2xl bg-surface p-4 shadow-card">
        <p className="text-body font-medium text-neutral-600">{t('analytics.notComputed')}</p>
      </div>
    );
  if (record === null)
    return <p className="text-body text-neutral-600">{t('analytics.machine.noRecord')}</p>;
  return <RecordBody record={record} asOf={asOf} machineId={machineId} />;
}

/**
 * One machine's page (39b) at `/analytics/machines/:id`: nameplate, age, floor area, load, breakdown summary,
 * PM visits/hours, record completeness and the cell moves, every block drilled to the rows behind it. A figure
 * that is not computed, a record the engine does not hold and a fact the plant never recorded all say so.
 */
export function MachinePage({ group }: { group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const [params] = useSearchParams();
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
      <StateNotice
        state={state as Exclude<ViewState, 'ready'>}
        empty={t('analytics.empty')}
        onRetry={() => void figures.refetch()}
      />
    );
  const figure: Figure | undefined = figures.data.figures.find(
    (candidate) => candidate.screen === 'machine-page',
  );
  const ready = figure?.status === 'ready';
  const record = ready && figure ? machineRecord(figure.value, id) : null;
  const drill = parseDrill(params.get('drill'));
  return (
    <Stack gap={6}>
      <Link
        to={MACHINES_PATH}
        className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
      >
        {t('analytics.machine.back')}
      </Link>
      <div className="flex flex-col gap-1">
        <h2 className="text-title2 font-semibold">
          {record?.machine.code ?? t('analytics.machine.title')}
        </h2>
        <Subtitle record={record} />
      </div>
      {drill ? <DrillTable group={group} drill={drill} /> : null}
      <MachineBody ready={ready} record={record} asOf={figures.data.asOf} machineId={id} />
    </Stack>
  );
}
