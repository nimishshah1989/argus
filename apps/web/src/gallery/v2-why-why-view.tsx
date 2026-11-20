import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel } from '../screens/v2/data.js';
import type { WhyWhyActions, WhyWhyRow } from '../screens/v2/why-why/model.js';
import { whyWhyModelFromKey } from '../screens/v2/why-why/source.js';
import { WhyWhyView } from '../screens/v2/why-why/View.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

/**
 * The v2 why-why screen on the engine's frozen answer: the model through the shared seam, the load states from the kit
 * in the same shell, and the form open on the row you start. `&role=op` shows the refusal; nothing is ever saved here.
 */
export default function V2WhyWhyView() {
  const [params] = useSearchParams();
  const provider = useMemo(
    () => previewProvider<'why-why'>(params.get('state')) ?? (() => whyWhyModelFromKey()),
    [params],
  );
  const loaded = useScreenModel('why-why', {}, provider);
  const nav = useNav('reliability');
  const { t } = useTranslation();
  const [open, setOpen] = useState<WhyWhyRow | null>(null);
  const title = t('v2r.ww.title');
  if (loaded.state !== 'ready' || !loaded.model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  const actions: WhyWhyActions = {
    write: params.get('role') !== 'op',
    author: t('analytics.whyWhy.author', { name: 'Gallery' }),
    failure: null,
    open: open && {
      rowId: open.id,
      machine: open.machine.label,
      date: open.date.shown,
      completed: open.status.done,
      record: null,
    },
    saving: false,
    saved: false,
    onStart: setOpen,
    onSave: () => setOpen(null),
    onPdf: () => {},
    onCancel: () => setOpen(null),
  };
  return <WhyWhyView model={loaded.model} nav={nav} title={title} actions={actions} />;
}
