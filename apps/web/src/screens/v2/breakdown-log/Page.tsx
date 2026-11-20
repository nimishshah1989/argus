import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { SavedCopyNotice, ScreenStates, type Loaded } from '../../../ui/v2/screen-states.js';
import { useScreenModel } from '../data.js';
import { EntityShell } from '../entity/EntityShell.js';
import { liveReply } from '../figures/live.js';
import { useKept } from '../kept.js';
import { LiveFrame, type LiveEntry } from '../live-frame.js';
import { useRefreshOnFigures } from '../refresh.js';
import { downloadCsv, logCsv } from './csv.js';
import { everyMatchOf } from './live.js';
import { EMPTY_QUERY, type LogModel, type LogQuery } from './model.js';
import { BreakdownLogView } from './View.js';

export const BREAKDOWN_LOG_ENTRY: LiveEntry = {
  group: 'breakdowns',
  section: 'problems',
  screen: 'breakdown-log',
};

/**
 * The Breakdown Log at `/analytics/breakdowns`, on the engine's figures the way v1 read them: every search, sort, filter
 * and page asks the seam for one page, the page on screen stays while the next comes, and the figures are read again
 * every 30 seconds as v1's were. The export writes the whole narrowed log from the same reply.
 */
export function BreakdownLogPage() {
  const client = useQueryClient();
  const [query, setQuery] = useState<LogQuery>(EMPTY_QUERY);
  const loaded = useScreenModel('breakdown-log', query);
  useRefreshOnFigures(loaded.retry);
  const model = useKept(loaded);
  const exportLog = async (): Promise<void> => {
    const { header, rows } = everyMatchOf(await liveReply(client), query, i18n.t.bind(i18n));
    downloadCsv(logCsv(header, rows));
  };
  return (
    <BreakdownLogFrame loaded={loaded} model={model} onQuery={setQuery} onExport={exportLog} />
  );
}

/** What the page draws for where its load stands: the log, or the state in the shell under the screen's title. */
export function BreakdownLogFrame({
  loaded,
  model,
  onQuery,
  onExport,
}: {
  loaded: Loaded<LogModel>;
  model: LogModel | undefined;
  onQuery: (query: LogQuery) => void;
  onExport: () => Promise<void>;
}) {
  const { t } = useTranslation();
  // A refresh that failed after a good load leaves the last answer on screen, and says so.
  const stale = loaded.state === 'error' || loaded.state === 'offline';
  const title = t('analytics.screen.breakdown-log');
  return (
    <LiveFrame
      notice={model && stale ? <SavedCopyNotice text={t('v2a.saved')} /> : null}
      entry={BREAKDOWN_LOG_ENTRY}
    >
      {(nav) =>
        model ? (
          <BreakdownLogView
            model={model}
            loading={loaded.state === 'loading'}
            nav={nav}
            title={title}
            onQuery={onQuery}
            onExport={onExport}
          />
        ) : (
          <EntityShell nav={nav} title={title}>
            <ScreenStates loaded={loaded} emptyText={t('analytics.log.empty')}>
              {() => null}
            </ScreenStates>
          </EntityShell>
        )
      }
    </LiveFrame>
  );
}
