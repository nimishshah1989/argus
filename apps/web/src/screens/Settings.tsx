import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  getConfig,
  getSettings,
  putMachineCriticality,
  putSetting,
  type SeverityMatrix,
} from '../api.js';

const SEVERITIES = ['S1', 'S2', 'S3', 'S4'] as const;
const CRITICALITIES = ['A', 'B', 'C'] as const;
const KINDS = ['stopped', 'support'] as const;

const DEFAULT_MATRIX: SeverityMatrix = {
  default: {
    A: { stopped: 'S1', support: 'S2' },
    B: { stopped: 'S2', support: 'S3' },
    C: { stopped: 'S3', support: 'S4' },
  },
  workRequest: 'S4',
  urgentWorkRequest: 'S3',
};

const selectClass =
  'min-h-11 rounded-lg border border-neutral-300 bg-white px-2 text-base text-neutral-900';

function SeveritySelect({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      className={selectClass}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {SEVERITIES.map((severity) => (
        <option key={severity} value={severity}>
          {severity}
        </option>
      ))}
    </select>
  );
}

/** Machine criticality list: one row per machine, A/B/C or unset. */
function CriticalitySection({
  machines,
  onChange,
}: {
  machines: Array<{ id: string; code: string; criticality: string | null }>;
  onChange: (machineId: string, criticality: 'A' | 'B' | 'C' | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('settings.criticalityTitle')}</h2>
      <p className="mt-1 text-sm text-neutral-500">{t('settings.criticalityHelp')}</p>
      <ul className="mt-3 divide-y divide-neutral-100">
        {machines.map((machine) => (
          <li key={machine.id} className="flex items-center justify-between gap-3 py-2">
            <span className="text-base font-medium">{machine.code}</span>
            <select
              aria-label={t('settings.criticalityFor', { code: machine.code })}
              className={selectClass}
              value={machine.criticality ?? ''}
              onChange={(event) =>
                onChange(machine.id, (event.target.value || null) as 'A' | 'B' | 'C' | null)
              }
            >
              <option value="">{t('settings.criticalityNone')}</option>
              {CRITICALITIES.map((criticality) => (
                <option key={criticality} value={criticality}>
                  {criticality}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Work-request severity selects (urgent and non-urgent). */
function WorkRequestFields({
  matrix,
  onField,
}: {
  matrix: SeverityMatrix;
  onField: (patch: Partial<SeverityMatrix>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <label className="text-sm text-neutral-600">
        {t('settings.matrixWorkRequest')}
        <span className="mt-1 block">
          <SeveritySelect
            label={t('settings.matrixWorkRequest')}
            value={matrix.workRequest}
            onChange={(value) => onField({ workRequest: value })}
          />
        </span>
      </label>
      <label className="text-sm text-neutral-600">
        {t('settings.matrixUrgentWorkRequest')}
        <span className="mt-1 block">
          <SeveritySelect
            label={t('settings.matrixUrgentWorkRequest')}
            value={matrix.urgentWorkRequest}
            onChange={(value) => onField({ urgentWorkRequest: value })}
          />
        </span>
      </label>
    </div>
  );
}

/** The 3×2 criticality × kind grid. */
function MatrixGrid({
  matrix,
  onCell,
}: {
  matrix: SeverityMatrix;
  onCell: (criticality: 'A' | 'B' | 'C', kind: 'stopped' | 'support', value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="text-left text-neutral-500">
          <th className="py-2 font-medium">{t('settings.matrixCriticality')}</th>
          <th className="py-2 font-medium">{t('settings.matrixStopped')}</th>
          <th className="py-2 font-medium">{t('settings.matrixSupport')}</th>
        </tr>
      </thead>
      <tbody>
        {CRITICALITIES.map((criticality) => (
          <tr key={criticality} className="border-t border-neutral-100">
            <td className="py-2 font-semibold">{criticality}</td>
            {KINDS.map((kind) => (
              <td key={kind} className="py-2 pr-3">
                <SeveritySelect
                  label={t('settings.matrixCell', { criticality, kind })}
                  value={matrix.default[criticality][kind]}
                  onChange={(value) => onCell(criticality, kind, value)}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The 3×2 criticality × kind grid plus work-request selects and save. */
function MatrixSection({
  matrix,
  dirty,
  saving,
  saved,
  onCell,
  onField,
  onSave,
}: {
  matrix: SeverityMatrix;
  dirty: boolean;
  saving: boolean;
  saved: boolean;
  onCell: (criticality: 'A' | 'B' | 'C', kind: 'stopped' | 'support', value: string) => void;
  onField: (patch: Partial<SeverityMatrix>) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('settings.matrixTitle')}</h2>
      <p className="mt-1 text-sm text-neutral-500">{t('settings.matrixHelp')}</p>
      <MatrixGrid matrix={matrix} onCell={onCell} />
      <WorkRequestFields matrix={matrix} onField={onField} />

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={onSave}
          className="min-h-13 rounded-xl bg-neutral-900 px-5 text-base font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {t('settings.saveMatrix')}
        </button>
        {saved && <p className="text-sm text-running">{t('settings.saved')}</p>}
      </div>
    </section>
  );
}

function SettingsHeader() {
  const { t } = useTranslation();
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
      <Link
        to="/desk"
        className="inline-flex min-h-11 items-center rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100"
      >
        {t('settings.back')}
      </Link>
    </header>
  );
}

/** Matrix draft state: edits are local until saved, then the server copy refreshes. */
function useMatrixDraft(stored: unknown) {
  const [draft, setDraft] = useState<SeverityMatrix | null>(null);
  const [saved, setSaved] = useState(false);
  const matrix: SeverityMatrix = draft ?? (stored as SeverityMatrix | undefined) ?? DEFAULT_MATRIX;

  function patchMatrix(patch: Partial<SeverityMatrix>) {
    setDraft({ ...matrix, ...patch });
    setSaved(false);
  }

  function patchCell(criticality: 'A' | 'B' | 'C', kind: 'stopped' | 'support', value: string) {
    patchMatrix({
      default: {
        ...matrix.default,
        [criticality]: { ...matrix.default[criticality], [kind]: value },
      },
    });
  }

  return {
    matrix,
    dirty: draft !== null,
    saved,
    setSaved,
    patchMatrix,
    patchCell,
    reset: () => setDraft(null),
  };
}

/**
 * Settings screen (M2-2.1): machine criticality and the severity matrix.
 * Admin/head only — the API enforces the same gate.
 */
export function Settings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const settings = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stored = settings.data?.find((row) => row.key === 'severity_matrix')?.value;
  const draft = useMatrixDraft(stored);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('settings.saveFailed'));
    }
  }

  async function saveMatrix() {
    setSaving(true);
    await run(async () => {
      await putSetting('severity_matrix', draft.matrix);
      draft.reset();
      draft.setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
      await queryClient.invalidateQueries({ queryKey: ['config'] });
    });
    setSaving(false);
  }

  function changeCriticality(machineId: string, criticality: 'A' | 'B' | 'C' | null) {
    void run(async () => {
      await putMachineCriticality(machineId, criticality);
      await queryClient.invalidateQueries({ queryKey: ['config'] });
    });
  }

  const machines = [...(config.data?.machines ?? [])].sort((a, b) => a.code.localeCompare(b.code));

  return (
    <main className="mx-auto max-w-3xl p-4 pb-16">
      <SettingsHeader />

      {error && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <CriticalitySection machines={machines} onChange={changeCriticality} />
      <MatrixSection
        matrix={draft.matrix}
        dirty={draft.dirty}
        saving={saving}
        saved={draft.saved}
        onCell={draft.patchCell}
        onField={draft.patchMatrix}
        onSave={saveMatrix}
      />
    </main>
  );
}
