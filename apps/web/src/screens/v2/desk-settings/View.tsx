/* eslint-disable i18next/no-literal-string -- severity and criticality codes, ids and routes only; every visible word goes through t() */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getConfig,
  getMe,
  isOffline,
  putMachineCriticality,
  putSeverityMatrix,
  type Criticality,
  type Machine,
  type Severity,
  type SeverityMatrix,
} from '../../../api.js';
import { EntityChip } from '../../../ui/v2/entity-chip.js';
import { KeyPill } from '../../../ui/v2/key-pill.js';
import { SeverityRow } from '../../../ui/v2/severity-row.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useNav } from '../nav.js';
import { SlaSections } from './SlaSection.js';
import {
  cellValue,
  criticalityTakeaway,
  highCells,
  HIGH,
  MATRIX_CELLS,
  type MatrixCell,
} from './model.js';

const SEVERITIES: Severity[] = ['S1', 'S2', 'S3', 'S4'];
const CRITICALITIES: Criticality[] = ['A', 'B', 'C'];

function useOnline(): boolean {
  const [online, setOnline] = useState(!isOffline());
  useEffect(() => {
    const update = () => setOnline(!isOffline());
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

function useMatrixDraft(stored: SeverityMatrix | undefined) {
  const [draft, setDraft] = useState<SeverityMatrix | null>(null);
  const [saved, setSaved] = useState(false);
  const matrix = draft ?? stored;
  function setCell(cell: MatrixCell, value: Severity) {
    if (!matrix) return;
    setSaved(false);
    if (cell === 'workRequest' || cell === 'urgentWorkRequest') {
      setDraft({ ...matrix, [cell]: value });
      return;
    }
    const [crit, kind] = cell.split('.') as [Criticality, 'stopped' | 'support'];
    setDraft({
      ...matrix,
      default: { ...matrix.default, [crit]: { ...matrix.default[crit], [kind]: value } },
    });
  }
  return { matrix, dirty: draft !== null, saved, setSaved, setCell, reset: () => setDraft(null) };
}
type MatrixDraft = ReturnType<typeof useMatrixDraft>;

function SeveritySelect(props: {
  value: Severity;
  label: string;
  disabled: boolean;
  onChange: (value: Severity) => void;
}) {
  return (
    <select
      className="v2-target"
      aria-label={props.label}
      value={props.value}
      disabled={props.disabled}
      onChange={(e) => props.onChange(e.target.value as Severity)}
    >
      {SEVERITIES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

function CriticalitySection(props: {
  machines: Machine[];
  disabled: boolean;
  pendingId: string | null;
  onChange: (machineId: string, criticality: Criticality | null) => void;
}) {
  const { t } = useTranslation();
  const { machines, disabled, pendingId, onChange } = props;
  const take = criticalityTakeaway(machines);
  return (
    <section className="v2-card">
      <h2 className="v2-h3">{t('settings.criticalityTitle')}</h2>
      <p>{t('settings.criticalityHelp')}</p>
      {take ? (
        <Takeaway
          data={{
            text: t('deskSettings.criticality.takeaway', take),
            tone: take.unset > 0 ? 'risk' : 'neutral',
            tag: t('settings.criticalityNone'),
          }}
        />
      ) : null}
      <ul className="v2-stack">
        {machines.map((m) => (
          <li key={m.id}>
            <EntityChip kind="machine" id={m.id} label={m.code} />
            <select
              className="v2-target"
              aria-label={t('settings.criticalityFor', { code: m.code })}
              value={m.criticality ?? ''}
              disabled={disabled || pendingId === m.id}
              onChange={(e) => onChange(m.id, (e.target.value || null) as Criticality | null)}
            >
              <option value="">{t('settings.criticalityNone')}</option>
              {CRITICALITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MatrixCellField(props: {
  cell: MatrixCell;
  label: string;
  draft: MatrixDraft;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { cell, label, draft, disabled } = props;
  const value = cellValue(draft.matrix as SeverityMatrix, cell);
  return (
    <label>
      {label}
      <SeveritySelect
        label={label}
        value={value}
        disabled={disabled}
        onChange={(v) => draft.setCell(cell, v)}
      />
      {value === HIGH ? <KeyPill text={t('insight.severity.high')} tone="loss" /> : null}
    </label>
  );
}

/** What to notice in the matrix: how many cells are High, and the cells by severity. */
function MatrixCounts({ matrix }: { matrix: SeverityMatrix }) {
  const { t } = useTranslation();
  const count = (s: Severity) => MATRIX_CELLS.filter((c) => cellValue(matrix, c) === s).length;
  return (
    <>
      <Takeaway
        data={{
          text: t('deskSettings.matrix.highCells', { count: highCells(matrix).length }),
          tone: 'risk',
          tag: t('insight.severity.high'),
        }}
      />
      <SeverityRow
        counts={{ high: count('S1'), medium: count('S2'), low: count('S3'), good: count('S4') }}
      />
    </>
  );
}

function MatrixSection(props: {
  draft: MatrixDraft;
  disabled: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const { draft, disabled, saving, onSave } = props;
  const labelOf = (cell: MatrixCell): string => {
    if (cell === 'workRequest') return t('settings.matrixWorkRequest');
    if (cell === 'urgentWorkRequest') return t('settings.matrixUrgentWorkRequest');
    const [criticality, kind] = cell.split('.');
    return t('settings.matrixCell', {
      criticality,
      kind: t(kind === 'stopped' ? 'settings.matrixStopped' : 'settings.matrixSupport'),
    });
  };
  return (
    <section className="v2-card">
      <h2 className="v2-h3">{t('settings.matrixTitle')}</h2>
      <p>{t('settings.matrixHelp')}</p>
      <MatrixCounts matrix={draft.matrix as SeverityMatrix} />
      <div className="v2-stack">
        {MATRIX_CELLS.map((cell) => (
          <MatrixCellField
            key={cell}
            cell={cell}
            label={labelOf(cell)}
            draft={draft}
            disabled={disabled}
          />
        ))}
      </div>
      <button
        type="button"
        className="v2-btn v2-btn-primary"
        disabled={disabled || saving || !draft.dirty}
        onClick={onSave}
      >
        {t('settings.saveMatrix')}
      </button>
      {draft.saved ? (
        <p role="status">
          <KeyPill text={t('settings.saved')} tone="gain" icon="check" />
        </p>
      ) : null}
    </section>
  );
}

function useSaves(online: boolean, draft: MatrixDraft) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch {
      setError(t('settings.saveFailed'));
    }
  }

  async function saveMatrix() {
    if (!draft.matrix || !online) return;
    setSaving(true);
    await run(async () => {
      await putSeverityMatrix(draft.matrix as SeverityMatrix);
      draft.reset();
      draft.setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['config'] });
    });
    setSaving(false);
  }

  function changeCriticality(machineId: string, criticality: Criticality | null) {
    if (!online) return;
    setPendingId(machineId);
    void run(async () => {
      await putMachineCriticality(machineId, criticality);
      await queryClient.invalidateQueries({ queryKey: ['config'] });
    }).finally(() => setPendingId(null));
  }

  return { saving, pendingId, error, saveMatrix, changeCriticality };
}

function Editor({
  machines,
  online,
  draft,
}: {
  machines: Machine[];
  online: boolean;
  draft: MatrixDraft;
}) {
  const { saving, pendingId, error, saveMatrix, changeCriticality } = useSaves(online, draft);
  return (
    <>
      {error ? (
        <p role="alert">
          <KeyPill text={error} tone="loss" icon="alert" />
        </p>
      ) : null}
      <CriticalitySection
        machines={machines}
        disabled={!online || saving}
        pendingId={pendingId}
        onChange={changeCriticality}
      />
      <MatrixSection
        draft={draft}
        disabled={!online || saving || pendingId !== null}
        saving={saving}
        onSave={() => void saveMatrix()}
      />
      <SlaSections online={online} />
    </>
  );
}

function Body(props: {
  loading: boolean;
  unavailable: boolean;
  hasMe: boolean;
  allowed: boolean;
  machines: Machine[];
  online: boolean;
  draft: MatrixDraft;
}) {
  const { t } = useTranslation();
  if (props.loading) return <p role="status">{t('settings.loading')}</p>;
  if (props.hasMe && !props.allowed) {
    return (
      <section className="v2-card">
        <h2 className="v2-h3">{t('settings.forbiddenTitle')}</h2>
        <p>{t('settings.forbiddenHelp')}</p>
        <p>{t('settings.forbiddenSlaHelp')}</p>
      </section>
    );
  }
  if (props.unavailable) {
    return (
      <p role="alert">
        <KeyPill text={t('settings.loadFailed')} tone="loss" icon="alert" />
      </p>
    );
  }
  return <Editor machines={props.machines} online={props.online} draft={props.draft} />;
}

/** Desk settings (S26-8): admin/head edits online; cached config is read-only offline. */
export function DeskSettingsView() {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const online = useOnline();
  const draft = useMatrixDraft(config.data?.severityMatrix);
  const role = me.data?.user.role;
  const nav = useNav('today', role).map((item) => ({ ...item, current: item.id === 'desk' }));
  const machines = [...(config.data?.machines ?? [])].sort((a, b) => a.code.localeCompare(b.code));
  return (
    <EntityShell nav={nav} title={t('settings.title')}>
      <Link to="/desk" className="v2-link v2-target">
        {t('settings.back')}
      </Link>
      {online ? null : (
        <p role="status">
          <KeyPill text={t('settings.offline')} tone="risk" icon="pause" />
        </p>
      )}
      <Body
        loading={config.isLoading || (online && me.isLoading)}
        unavailable={!draft.matrix || (online && !me.data)}
        hasMe={me.data !== undefined}
        allowed={role === 'admin' || role === 'head'}
        machines={machines}
        online={online}
        draft={draft}
      />
    </EntityShell>
  );
}
