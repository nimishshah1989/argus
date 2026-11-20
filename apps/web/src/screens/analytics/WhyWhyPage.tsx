import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MAX_DRILL_IDS, type FiguresReply } from '@uptimo/shared/analytics';
import { getMe } from '../../api.js';
import { Stack } from '../../ui/layout.js';
import { contentOf } from './figure-content.js';
import { drillHref, type AnalyticsGroup } from './groups.js';
import {
  Candidates,
  WhyWhyForm,
  mayWrite,
  shownName,
  useWhyWhyRecord,
  type Table,
  type Viewer,
} from './why-why-parts.js';

type Figure = FiguresReply['figures'][number];

/** The figure's own rows, through the face's one drill seam; over the limit it opens the log instead. */
function DrillLink({ figure, group }: { figure: Figure; group: AnalyticsGroup }) {
  const { t } = useTranslation();
  const ids = figure.drill.ids;
  if (ids.length === 0) return null;
  const direct = ids.length <= MAX_DRILL_IDS;
  return (
    <Link
      to={
        direct
          ? `${drillHref(group.id, 'ticket', ids)}&screen=${encodeURIComponent(figure.screen)}`
          : `/analytics/${group.id}?screen=breakdown-log`
      }
      className="inline-flex min-h-target-min items-center text-footnote font-semibold text-accent-text"
    >
      {t(direct ? 'analytics.drill.open' : 'analytics.page.openLog')}
    </Link>
  );
}

/** The page once its key table is readable: the refusal, the open record, the candidates and the drill. */
function A6Body({
  figure,
  group,
  table,
  title,
  user,
}: {
  figure: Figure;
  group: AnalyticsGroup;
  table: Table;
  title: string;
  user: Viewer | undefined;
}) {
  const { t } = useTranslation();
  const record = useWhyWhyRecord(table.rows);
  const choice = record.choice;
  const write = mayWrite(user);
  return (
    <Stack gap={4}>
      <h2 className="text-title3 font-semibold">{title}</h2>
      {write ? null : (
        <p role="status" className="text-body font-medium text-danger-ink">
          {t('analytics.whyWhy.refused')}
        </p>
      )}
      {record.failure === null ? null : (
        <p role="alert" className="text-body font-medium text-danger-ink">
          {t(record.failure)}
        </p>
      )}
      {choice === null ? null : (
        <WhyWhyForm
          key={choice.ticketId}
          choice={choice}
          author={shownName(user)}
          saving={record.save.isPending}
          saved={record.save.isSuccess}
          onSave={(body) => record.save.mutate({ ticketId: choice.ticketId, body })}
          onCancel={record.close}
          onPdf={() => void record.pdf()}
        />
      )}
      <Candidates
        table={table}
        write={write}
        onPick={(index, ticketId, completed) => void record.open(ticketId, index, completed)}
      />
      <DrillLink figure={figure} group={group} />
    </Stack>
  );
}

/**
 * A6 Why-Why (41e-2): the engine's candidate page, with the platform's status badge and its row action. A row
 * opens the five whys and the required conclusion; the author is the signed-in person the server writes, and the
 * PDF is the saved record's own sheet. After a save the figures reply is fetched again, so the row reads Completed
 * without a reload.
 */
export function WhyWhyPage({
  figure,
  group,
}: {
  figure: Figure | undefined;
  group: AnalyticsGroup;
}) {
  const { t } = useTranslation();
  const me = useQuery({ queryKey: ['me'], queryFn: getMe });
  const content = figure ? contentOf(figure, t) : null;
  const table = content?.kind === 'page' ? content.tables[0] : undefined;
  if (!figure || figure.status !== 'ready' || content?.kind !== 'page' || table === undefined)
    return (
      <div data-page="not-computed" className="rounded-2xl bg-surface p-4 shadow-card">
        <p className="text-body font-medium text-neutral-600">{t('analytics.notComputed')}</p>
      </div>
    );
  return (
    <A6Body
      figure={figure}
      group={group}
      table={table}
      title={content.title}
      user={me.data?.user}
    />
  );
}
