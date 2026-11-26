import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Banner } from '../../../ui/banner.js';
import { Card } from '../../../ui/card.js';
import { LoadingState } from '../../../ui/elements/states.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { ListHeading, rowClass } from './Frame.js';
import type { TeamModel, TicketRowItem, WindowBlock } from './team-model.js';

export type TeamViewProps = { model: TeamModel };

/** A row inside a card: no second shadow, a tint instead. */
const innerRow =
  'flex min-h-target items-center justify-between gap-3 rounded-xl bg-v2-subtle px-4 py-3';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <ListHeading>{title}</ListHeading>
      {children}
    </section>
  );
}

function Rows({ rows, empty }: { rows: TicketRowItem[]; empty: string }) {
  if (rows.length === 0) return <p className="v2-sub">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.id}>
          <Link to={`/desk/${row.id}`} className={rowClass}>
            <span className="min-w-0">
              <span className="v2-h3 block">{row.ref}</span>
              <span className="v2-sub block truncate">{row.machine}</span>
              <span className="v2-sub block truncate">{row.detail}</span>
            </span>
            <span className="v2-sub shrink-0 text-right">{row.time}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** A window's own loading, error, empty or rows. */
function Window({ block, children }: { block: WindowBlock; children?: ReactNode }) {
  const { t } = useTranslation();
  if (block.state === 'loading') return <LoadingState label={t('common.loading')} tiles={1} />;
  if (block.state === 'error') return <Banner tone="error" title={block.error ?? ''} />;
  return (
    <>
      <Rows rows={block.rows} empty={block.empty} />
      {block.rows.length > 0 && children}
    </>
  );
}

function WorkingNow({ model }: TeamViewProps) {
  if (model.working.length === 0) return <p className="v2-sub">{model.words.nobody}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {model.working.map((lead) => (
        <li key={lead.personId}>
          <Card>
            <div className="flex items-center justify-between gap-3">
              <p className="v2-h3">{lead.name}</p>
              <p className="v2-pill v2-pill-neutral">{lead.minutes}</p>
            </div>
            <ul className="flex flex-col gap-2">
              {lead.jobs.map((job) => (
                <li key={job.id}>
                  <Link to={`/desk/${job.id}`} className={innerRow}>
                    <span className="v2-h3">{job.ref}</span>
                    <span className="v2-sub">{job.machine}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Monthly({ model }: TeamViewProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <h3 className="v2-h3">{model.words.monthly}</h3>
      {model.closed.months.map((month) => (
        <Card key={month.month}>
          <p className="v2-h3">{month.label}</p>
          <ul className="space-y-1">
            {month.rows.map((person) => (
              <li key={person.personId} className="flex justify-between gap-3">
                <span>{person.name}</span>
                <span className="v2-sub text-right">
                  <span className="block">
                    {person.primary} {t('role.primary')}
                  </span>
                  {person.support && (
                    <span className="block">
                      {person.support} {t('role.support')}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/**
 * `/desk/team` under the frame's title: the takeaway, then regions Working now, Waiting, Not started, Cancelled
 * last 24 hours, Closed last 30 days (with the h3 Monthly totals per person), in v1's control order. No h1.
 */
export function TeamView({ model }: TeamViewProps): ReactNode {
  const { words } = model;
  const line = model.takeaways['desk.team'];
  return (
    <>
      {line && <Takeaway data={line} />}
      <Section title={words.workingNow}>
        <WorkingNow model={model} />
      </Section>
      <Section title={words.waiting}>
        <Rows rows={model.waiting} empty={words.none} />
      </Section>
      <Section title={words.notStarted}>
        <Rows rows={model.notStarted} empty={words.none} />
      </Section>
      <Section title={words.cancelled}>
        <Window block={model.cancelled} />
      </Section>
      <Section title={words.closed}>
        <Window block={model.closed}>
          <Monthly model={model} />
        </Window>
      </Section>
    </>
  );
}
