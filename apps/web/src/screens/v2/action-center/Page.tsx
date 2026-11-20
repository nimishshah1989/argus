/* eslint-disable i18next/no-literal-string -- the write bodies carry the server's status words, not copy */
import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ActionCenterBoardReply, NudgeAckBody } from '@uptimo/shared';
import { actionCenterBoardQuery, reopenNudge, writeNudge } from '../../../api.js';
import { isOffline } from '../../../data/index.js';
import { ScreenStates } from '../../../ui/v2/screen-states.js';
import { useScreenModel } from '../data.js';
import { EntityShell } from '../entity/EntityShell.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { ActionCenterView } from './View.js';
import type { ActionCenterModel } from './model.js';

/**
 * The live Action Center: reads the board, and sends each write (acknowledge, snooze, resolve, reopen) to the server,
 * which answers the whole fresh board. A write that fails says so and leaves the board as it was; offline it is not sent.
 */
export function ActionCenterPage({ nav, title }: { nav: NavItem[]; title: string }) {
  const { t } = useTranslation();
  const loaded = useScreenModel('action-center', {});
  const client = useQueryClient();
  const [failed, setFailed] = useState(false);
  const last = useRef<ActionCenterModel>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  const model = loaded.model ?? (loaded.state === 'loading' ? last.current : undefined);

  const send = async (write: () => Promise<ActionCenterBoardReply>) => {
    setFailed(false);
    try {
      if (isOffline()) throw new Error(t('kit.form.needsConnection'));
      client.setQueryData(actionCenterBoardQuery.queryKey, await write());
      loaded.retry();
    } catch {
      setFailed(true);
    }
  };
  const body = (key: string, next: NudgeAckBody) => send(() => writeNudge(key, next));

  if (!model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return (
    <ActionCenterView
      model={model}
      nav={nav}
      title={title}
      failed={failed}
      onAcknowledge={(key, values) => void body(key, { status: 'ack', ...values })}
      onSnooze={(key) => void body(key, { status: 'snooze' })}
      onResolve={(key) => void body(key, { status: 'resolved' })}
      onReopen={(key) => void send(() => reopenNudge(key))}
    />
  );
}
