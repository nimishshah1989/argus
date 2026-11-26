/* eslint-disable i18next/no-literal-string -- screen ids and routes only; every visible word goes through t() */
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { correctMove } from '../../api.js';
import { ApiError, isOffline } from '../../data/index.js';
import { ScreenStates } from '../../ui/v2/screen-states.js';
import { correctionError } from '../analytics/machine-values.js';
import type { GroupId } from '../analytics/groups.js';
import { CellLogView } from './cell-change-log/View.js';
import type { CellLogModel } from './cell-change-log/model.js';
import { useScreenModel, type ScreenModel, type ScreenParams } from './data.js';
import { savedFigures } from './figures/live.js';
import { EntityShell } from './entity/EntityShell.js';
import { LiveFrame, ModelFrame, type ModelKey, type PageConfig } from './live-frame.js';
import { useRefreshOnFigures } from './refresh.js';
import type { SectionId } from '../analytics/shell/shell-data.js';

/** The live registry's page components that need more than a model, and `ModelPage` for the ones that do not. */

/** One head's or admin's correction of a move's date: the server's words on a refusal; never offline. */
function useCorrect(afterwards: () => void) {
  const { t } = useTranslation();
  const client = useQueryClient();
  return async (move: { id: string; machineId: string }, day: string): Promise<void> => {
    if (isOffline()) throw new Error(t('kit.form.needsConnection'));
    try {
      await correctMove(move.machineId, move.id, day);
    } catch (caught) {
      const named = caught instanceof ApiError ? correctionError(caught).date : undefined;
      throw new Error(named ?? t('analytics.cellLog.refused'), { cause: caught });
    }
    await client.invalidateQueries({ queryKey: ['analytics-figures'] });
    afterwards();
  };
}

export function CellChangeLogPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const loaded = useScreenModel('cell-change-log', {});
  const [corrected, setCorrected] = useState(false);
  const correct = useCorrect(() => {
    setCorrected(true);
    loaded.retry();
  });
  // The list is the saved copy when the refresh failed; after a correction it says so, so the old date is not read as the new.
  const saved = loaded.state === 'ready' && savedFigures(client);
  const stale = saved ? (corrected ? 'afterCorrection' : 'saved') : undefined;
  useEffect(() => {
    if (loaded.state === 'ready' && !saved) setCorrected(false);
  }, [loaded.state, saved]);
  const last = useRef<CellLogModel>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  const model = loaded.model ?? (loaded.state === 'loading' ? last.current : undefined);
  const title = t('v2m.title.log');
  return (
    <LiveFrame entry={{ group: 'machines', section: 'machines', screen: 'cell-change-log' }}>
      {(nav) =>
        model ? (
          <CellLogView model={model} nav={nav} title={title} onCorrect={correct} stale={stale} />
        ) : (
          <EntityShell nav={nav} title={title}>
            <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
          </EntityShell>
        )
      }
    </LiveFrame>
  );
}

/** A screen that only draws its model: the model through the shared seam, the states in the shell until it is ready. */
export function ModelPage<K extends ModelKey>(config: PageConfig<K>) {
  const loaded = useScreenModel(config.screen, {} as ScreenParams<K>);
  useRefreshOnFigures(loaded.retry);
  /** The screen stays as it was while a refresh loads or fails: the figures refresh every 30 seconds, as they did in v1. */
  const last = useRef<ScreenModel<K>>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  return <ModelFrame {...config} loaded={loaded} lastGood={last.current} />;
}

export const screenOf = (group: GroupId, section: SectionId, screen: string) => ({
  group,
  section,
  screen,
});
