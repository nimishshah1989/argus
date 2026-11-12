import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Criticality, Machine, Severity, SeverityMatrix } from '../api.js';

const SEVERITIES: Severity[] = ['S1', 'S2', 'S3', 'S4'];
const CRITICALITIES: Criticality[] = ['A', 'B', 'C'];
const KINDS = ['stopped', 'support'] as const;
const WORK_FIELDS = [
  { key: 'workRequest', label: 'settings.matrixWorkRequest' },
  { key: 'urgentWorkRequest', label: 'settings.matrixUrgentWorkRequest' },
] as const;
const selectClass =
  'min-h-13 rounded-lg border border-neutral-300 bg-white px-2 text-base text-neutral-900 disabled:opacity-60';

function SeveritySelect({
  value,
  label,
  disabled,
  onChange,
}: {
  value: Severity;
  label: string;
  disabled: boolean;
  onChange: (value: Severity) => void;
}) {
  return (
    <select
      aria-label={label}
      className={selectClass}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as Severity)}
    >
      {SEVERITIES.map((severity) => (
        <option key={severity} value={severity}>
          {severity}
        </option>
      ))}
    </select>
  );
}

export function CriticalitySection({
  machines,
  disabled,
  pendingId,
  onChange,
}: {
  machines: Machine[];
  disabled: boolean;
  pendingId: string | null;
  onChange: (machineId: string, criticality: Criticality | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('settings.criticalityTitle')}</h2>
      <p className="mt-1 text-sm text-neutral-600">{t('settings.criticalityHelp')}</p>
      <ul className="mt-3 divide-y divide-neutral-100">
        {machines.map((machine) => (
          <li key={machine.id} className="flex items-center justify-between gap-3 py-2">
            <span className="text-base font-medium">{machine.code}</span>
            <select
              aria-label={t('settings.criticalityFor', { code: machine.code })}
              className={selectClass}
              value={machine.criticality ?? ''}
              disabled={disabled || pendingId === machine.id}
              onChange={(event) =>
                onChange(machine.id, (event.target.value || null) as Criticality | null)
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

function WorkRequestFields({
  matrix,
  disabled,
  onField,
}: {
  matrix: SeverityMatrix;
  disabled: boolean;
  onField: (patch: Partial<SeverityMatrix>) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {WORK_FIELDS.map((field) => (
        <label key={field.key} className="text-sm text-neutral-600">
          {t(field.label)}
          <span className="mt-1 block">
            <SeveritySelect
              label={t(field.label)}
              value={matrix[field.key]}
              disabled={disabled}
              onChange={(value) => onField({ [field.key]: value })}
            />
          </span>
        </label>
      ))}
    </div>
  );
}

function MatrixGrid({
  matrix,
  disabled,
  onCell,
}: {
  matrix: SeverityMatrix;
  disabled: boolean;
  onCell: (criticality: Criticality, kind: 'stopped' | 'support', value: Severity) => void;
}) {
  const { t } = useTranslation();
  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="text-left text-neutral-600">
          <th className="py-2 font-medium">{t('settings.matrixCriticality')}</th>
          <th className="py-2 font-medium">{t('settings.matrixStopped')}</th>
          <th className="py-2 font-medium">{t('settings.matrixSupport')}</th>
        </tr>
      </thead>
      <tbody>
        {CRITICALITIES.map((criticality) => (
          <tr key={criticality} className="border-t border-neutral-100">
            <td className="py-2 font-semibold">{criticality}</td>
            {KINDS.map((kind) => {
              const kindLabel = t(
                kind === 'stopped' ? 'settings.matrixStopped' : 'settings.matrixSupport',
              );
              return (
                <td key={kind} className="py-2 pr-3">
                  <SeveritySelect
                    label={t('settings.matrixCell', { criticality, kind: kindLabel })}
                    value={matrix.default[criticality][kind]}
                    disabled={disabled}
                    onChange={(value) => onCell(criticality, kind, value)}
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MatrixSection(props: {
  matrix: SeverityMatrix;
  dirty: boolean;
  disabled: boolean;
  saving: boolean;
  saved: boolean;
  onCell: (criticality: Criticality, kind: 'stopped' | 'support', value: Severity) => void;
  onField: (patch: Partial<SeverityMatrix>) => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const { matrix, dirty, disabled, saving, saved, onCell, onField, onSave } = props;
  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">{t('settings.matrixTitle')}</h2>
      <p className="mt-1 text-sm text-neutral-600">{t('settings.matrixHelp')}</p>
      <MatrixGrid matrix={matrix} disabled={disabled} onCell={onCell} />
      <WorkRequestFields matrix={matrix} disabled={disabled} onField={onField} />
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || saving || !dirty}
          onClick={onSave}
          className="min-h-13 rounded-xl bg-neutral-900 px-5 text-base font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {t('settings.saveMatrix')}
        </button>
        {saved && (
          <p role="status" className="text-sm text-running">
            {t('settings.saved')}
          </p>
        )}
      </div>
    </section>
  );
}

export function SettingsHeader() {
  const { t } = useTranslation();
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
      <Link
        to="/desk"
        className="inline-flex min-h-13 items-center rounded-xl border border-neutral-300 bg-white px-4 text-base font-semibold text-neutral-900 hover:bg-neutral-100"
      >
        {t('settings.back')}
      </Link>
    </header>
  );
}
