import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import i18n from 'i18next';
import { BreakdownLogView } from '../screens/v2/breakdown-log/View.js';
import { everyMatchOf } from '../screens/v2/breakdown-log/live.js';
import { EMPTY_QUERY, type LogModel, type LogQuery } from '../screens/v2/breakdown-log/model.js';
import { workbookLog } from '../screens/v2/breakdown-log/source.js';
import { logSheets } from '../screens/v2/breakdown-log/sweep.js';
import { EntityShell } from '../screens/v2/entity/EntityShell.js';
import { useScreenModel } from '../screens/v2/data.js';
import { useNav } from '../screens/v2/nav.js';
import { ScreenStates } from '../ui/v2/screen-states.js';
import { previewProvider } from './v2-preview.js';

/**
 * The v2 Breakdown Log as a screen will run it: every search, sort, filter and page is a new query to the seam, which
 * answers one page; the page already on screen stays up while the next one comes.
 */
export default function V2BreakdownLogView() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState<LogQuery>(EMPTY_QUERY);
  const provider = useMemo(() => previewProvider<'breakdown-log'>(params.get('state')), [params]);
  const loaded = useScreenModel('breakdown-log', query, provider);
  const last = useRef<LogModel>(undefined);
  if (loaded.state === 'ready' && loaded.model) last.current = loaded.model;
  const model = loaded.model ?? (loaded.state === 'loading' ? last.current : undefined);
  const nav = useNav('problems');
  const { t } = useTranslation();
  const title = t('analytics.screen.breakdown-log');
  if (!model)
    return (
      <EntityShell nav={nav} title={title}>
        <ScreenStates loaded={loaded}>{() => null}</ScreenStates>
      </EntityShell>
    );
  return (
    <BreakdownLogView
      model={model}
      loading={loaded.state === 'loading'}
      nav={nav}
      title={title}
      onQuery={setQuery}
      sheets={logSheets(everyMatchOf(workbookLog, query, i18n.t.bind(i18n)), model.words)}
    />
  );
}
