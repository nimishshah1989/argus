/* eslint-disable i18next/no-literal-string -- icon names and route constants only; every visible word goes through t() */
import { useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getMe } from '../../../api.js';
import { personKey } from '../../../data/person-cache.js';
import { Icon } from '../../../ui/v2/icons.js';
import { SavedCopyNotice, ScreenStates, type Loaded } from '../../../ui/v2/screen-states.js';
import { ACTION_CENTER_PATH } from '../../analytics/groups.js';
import { ChromeContext, EntityShell } from '../entity/EntityShell.js';
import { useNav } from '../nav.js';
import { SectionTabs } from '../section-tabs.js';
import { useScreenModel } from '../data.js';
import type { ActionCenterModel } from './model.js';
import { rereadThen, useRefresh } from './refresh.js';
import { ActionCenterView } from './View.js';
import { useNudgeWrites } from './writes.js';

/**
 * What the page shows while the next read is on its way or has failed on the connection: the last answer, for the
 * person it was read for and nobody else, as v1 kept its data while it refetched. A refusal or an empty answer is
 * never covered by an old one.
 */
function useKept(loaded: Loaded<ActionCenterModel>): ActionCenterModel | undefined {
  const last = useRef<{ who: string; model: ActionCenterModel }>(undefined);
  if (loaded.state === 'ready' && loaded.model)
    last.current = { who: personKey(), model: loaded.model };
  const mine = last.current?.who === personKey() ? last.current.model : undefined;
  const holds =
    loaded.state === 'loading' || loaded.state === 'offline' || loaded.state === 'error';
  return loaded.model ?? (holds ? mine : undefined);
}

/** The refusal in v1's words, in the status line it always was. */
function Refused() {
  const { t } = useTranslation();
  return (
    <div className="v2-states v2-state-box" data-state="refused" role="status">
      <span className="v2-seg-risk">
        <Icon name="alert" size={24} />
      </span>
      <p>{t('analytics.actionCenter.refused')}</p>
    </div>
  );
}

/**
 * The Action Center at `/analytics/today/action-center`: the board v1 read, the same four writes, the same refresh every
 * 30 seconds. While a refresh is on its way, or failed on the connection, the last answer stays; a write reads again.
 */
export function ActionCenterPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const role = useQuery({ queryKey: ['me'], queryFn: getMe }).data?.user.role;
  const nav = useNav('today', role);
  const loaded = useScreenModel('action-center', {});
  useRefresh(loaded.retry);
  const acts = useNudgeWrites(() => rereadThen(client, loaded.retry));
  const model = useKept(loaded);
  const title = t('analytics.screen.action-center');
  const stale = loaded.state === 'offline' || loaded.state === 'error';
  const chrome = (
    <>
      <SectionTabs section="today" current={ACTION_CENTER_PATH} />
      {model && stale ? <SavedCopyNotice text={t('v2a.saved')} /> : null}
    </>
  );
  return (
    <ChromeContext.Provider value={chrome}>
      {model ? (
        <ActionCenterView model={model} nav={nav} title={title} {...acts} />
      ) : (
        <EntityShell nav={nav} title={title}>
          {loaded.state === 'refused' ? (
            <Refused />
          ) : (
            <ScreenStates loaded={loaded} emptyText={t('analytics.actionCenter.emptyOpen')}>
              {() => null}
            </ScreenStates>
          )}
        </EntityShell>
      )}
    </ChromeContext.Provider>
  );
}
