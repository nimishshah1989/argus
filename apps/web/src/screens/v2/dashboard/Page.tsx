/* eslint-disable i18next/no-literal-string -- screen ids and a catalogue key only; every visible word goes through t() */
import i18n from 'i18next';
import { useRef } from 'react';
import { useActionCenterBoard } from '../../../api.js';
import { useScreenModel, type ScreenModel } from '../data.js';
import { ModelFrame } from '../live-frame.js';
import { actionCenterOf } from './adapter.js';
import { useRefresh } from './refresh.js';
import { ActionCenter, DashboardView } from './View.js';

/**
 * The Dashboard reads again every 30 seconds, as v1's Today did: what needs you now and the Action Center count must not
 * go stale. It keeps the last good model while a refresh loads or fails (`modelToShow`), and shows the Action Center
 * count even while the figures load or fail, as v1 did.
 */
export function DashboardPage() {
  const loaded = useScreenModel('dashboard', {});
  useRefresh(loaded.retry);
  const last = useRef<ScreenModel<'dashboard'>>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  const board = useActionCenterBoard().data;
  const note = actionCenterOf(board ?? null, (key, values) => i18n.t(key, { ...values }) as string);
  return (
    <ModelFrame<'dashboard'>
      entry={{ group: 'today', section: 'today', screen: 'dashboard' }}
      title="analytics.screen.dashboard"
      before={<ActionCenter note={note} />}
      draw={(model, shell) => <DashboardView model={model} {...shell} />}
      loaded={loaded}
      lastGood={last.current}
    />
  );
}
