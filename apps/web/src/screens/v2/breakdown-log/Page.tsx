import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import type { FiguresReply } from '@uptimo/shared/analytics';
import type { Sheet } from '@uptimo/shared/xlsx';
import { analyticsFiguresQuery } from '../../../api.js';
import { SavedCopyNotice, ScreenStates, type Loaded } from '../../../ui/v2/screen-states.js';
import { useScreenModel } from '../data.js';
import { EntityShell } from '../entity/EntityShell.js';
import { useKept } from '../kept.js';
import { LiveFrame, type LiveEntry } from '../live-frame.js';
import { useRefreshOnFigures } from '../refresh.js';
import { everyMatchOf } from './live.js';
import { EMPTY_QUERY, type LogModel, type LogQuery } from './model.js';
import { logSheets } from './sweep.js';
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
  const reply = client.getQueryData<FiguresReply>(analyticsFiguresQuery.queryKey);
  const sheets = useMemo(
    () =>
      reply && model ? logSheets(everyMatchOf(reply, query, i18n.t.bind(i18n)), model.words) : [],
    [reply, query, model],
  );
  return <BreakdownLogFrame loaded={loaded} model={model} onQuery={setQuery} sheets={sheets} />;
}

/** What the page draws for where its load stands: the log, or the state in the shell under the screen's title. */
export function BreakdownLogFrame({
  loaded,
  model,
  onQuery,
  sheets,
}: {
  loaded: Loaded<LogModel>;
  model: LogModel | undefined;
  onQuery: (query: LogQuery) => void;
  sheets: Sheet[];
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
            sheets={sheets}
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
