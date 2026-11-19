import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from '../api.js';
import {
  CriticalitySection,
  MatrixSection,
  SettingsHeader,
} from '../components/SettingsSections.js';
import { SlaSettingsSections } from '../components/SlaSettingsSections.js';
import { Banner } from '../ui/banner.js';
import { LoadingState } from '../ui/elements/states.js';

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
  function patchMatrix(patch: Partial<SeverityMatrix>) {
    if (!matrix) return;
    setDraft({ ...matrix, ...patch });
    setSaved(false);
  }
  function patchCell(criticality: Criticality, kind: 'stopped' | 'support', value: Severity) {
    if (!matrix) return;
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

function SettingsEditor({
  machines,
  online,
  draft,
}: {
  machines: Machine[];
  online: boolean;
  draft: ReturnType<typeof useMatrixDraft>;
}) {
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

  return (
    <SettingsPanels
      machines={machines}
      online={online}
      draft={draft}
      saving={saving}
      pendingId={pendingId}
      error={error}
      onSave={saveMatrix}
      onChange={changeCriticality}
    />
  );
}

function SettingsPanels({
  machines,
  online,
  draft,
  saving,
  pendingId,
  error,
  onSave,
  onChange,
}: {
  machines: Machine[];
  online: boolean;
  draft: ReturnType<typeof useMatrixDraft>;
  saving: boolean;
  pendingId: string | null;
  error: string | null;
  onSave: () => void;
  onChange: (machineId: string, criticality: Criticality | null) => void;
}) {
  return (
    <>
      {error && (
        <div className="mt-4">
          <Banner tone="error" title={error} />
        </div>
      )}
      <CriticalitySection
        machines={machines}
        disabled={!online || saving}
        pendingId={pendingId}
        onChange={onChange}
      />
      <MatrixSection
        matrix={draft.matrix as SeverityMatrix}
        dirty={draft.dirty}
        disabled={!online || saving || pendingId !== null}
        saving={saving}
        saved={draft.saved}
        onCell={draft.patchCell}
        onField={draft.patchMatrix}
        onSave={onSave}
      />
      <SlaSettingsSections online={online} />
    </>
  );
}

function SettingsBody({
  loading,
  unavailable,
  hasMe,
  allowed,
  machines,
  online,
  draft,
}: {
  loading: boolean;
  unavailable: boolean;
  hasMe: boolean;
  allowed: boolean;
  machines: Machine[];
  online: boolean;
  draft: ReturnType<typeof useMatrixDraft>;
}) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="mt-6">
        <LoadingState label={t('settings.loading')} tiles={1} />
      </div>
    );
  }
  if (hasMe && !allowed) {
    return (
      <section className="mt-6 rounded-card bg-surface p-4 shadow-card">
        <h2 className="text-title3 font-semibold">{t('settings.forbiddenTitle')}</h2>
        <p className="mt-2 text-neutral-600">{t('settings.forbiddenHelp')}</p>
        <p className="mt-2 text-neutral-600">{t('settings.forbiddenSlaHelp')}</p>
      </section>
    );
  }
  if (unavailable) {
    return (
      <div className="mt-6">
        <Banner tone="error" title={t('settings.loadFailed')} />
      </div>
    );
  }
  return <SettingsEditor machines={machines} online={online} draft={draft} />;
}

/** Settings (M2-2.1): admin/head edits online; cached config is read-only offline. */
export function Settings() {
  const { t } = useTranslation();
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const online = useOnline();
  const draft = useMatrixDraft(config.data?.severityMatrix);
  const role = me.data?.user.role;
  const allowed = role === 'admin' || role === 'head';
  const machines = [...(config.data?.machines ?? [])].sort((a, b) => a.code.localeCompare(b.code));
  const loading = config.isLoading || (online && me.isLoading);
  const unavailable = !draft.matrix || (online && !me.data);
  return (
    <main className="mx-auto max-w-3xl p-4 pb-16">
      <SettingsHeader />
      {!online && (
        <div className="mt-4 overflow-hidden rounded-xl">
          <Banner tone="offline" title={t('settings.offline')} />
        </div>
      )}
      <SettingsBody
        loading={loading}
        unavailable={unavailable}
        hasMe={me.data !== undefined}
        allowed={allowed}
        machines={machines}
        online={online}
        draft={draft}
      />
    </main>
  );
}
