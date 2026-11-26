import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Notice } from '../../../ui/v2/notice.js';
import { Skeleton } from '../../../ui/v2/screen-states.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { ListCard, PlainRow } from './parts.js';
import type { TeamModel, TicketRowItem, WindowBlock } from './team-model.js';

export type TeamViewProps = { model: TeamModel };

function Rows({ rows, empty }: { rows: TicketRowItem[]; empty: string }) {
  if (rows.length === 0) return <p className="v2-sub">{empty}</p>;
  return (
    <ul className="v2-desk-rows">
      {rows.map((row) => (
        <PlainRow
          key={row.id}
          id={row.id}
          title={row.ref}
          lines={[row.machine, row.detail]}
          time={row.time}
        />
      ))}
    </ul>
  );
}

/** A window's own loading, error, empty or rows. */
function Window({ block, children }: { block: WindowBlock; children?: ReactNode }) {
  if (block.state === 'loading') return <Skeleton blocks={1} />;
  if (block.state === 'error') return <Notice tone="loss" title={block.error ?? ''} />;
  return (
    <>
      <Rows rows={block.rows} empty={block.empty} />
      {block.rows.length > 0 && children}
    </>
  );
}

/** Working now: one row per person on a job, with their crew role, the job's state and their minutes on it. */
function WorkingNow({ model }: TeamViewProps) {
  const rows = [...model.working, ...model.paused];
  if (rows.length === 0) return <p className="v2-sub">{model.words.nobody}</p>;
  return (
    <ul className="v2-desk-rows">
      {model.working.length === 0 && <li className="v2-sub">{model.words.nobody}</li>}
      {rows.map((row) => (
        <PlainRow
          key={row.key}
          id={row.ticketId}
          title={row.ref}
          lines={[row.machine, `${row.name} · ${row.role}`]}
          status={
            <span className={`v2-pill ${row.paused ? 'v2-pill-risk' : 'v2-pill-plan'}`}>
              {row.state}
            </span>
          }
          time={row.minutes}
        />
      ))}
    </ul>
  );
}

/** Monthly totals per person: each month a small table of primary and support jobs, most first. */
function Monthly({ model }: TeamViewProps) {
  const { t } = useTranslation();
  return (
    <div className="v2-stack">
      <h3 className="v2-h3">{model.words.monthly}</h3>
      {model.closed.months.map((month) => (
        <table key={month.month} className="v2-table">
          <caption className="v2-sub">{month.label}</caption>
          <thead>
            <tr>
              <th scope="col">{t('detail.col.person')}</th>
              <th scope="col">{t('role.primary')}</th>
              <th scope="col">{t('role.support')}</th>
            </tr>
          </thead>
          <tbody>
            {month.rows.map((person) => (
              <tr key={person.personId}>
                <td>{person.name}</td>
                <td className="v2-num-cell">
                  {person.primary} {t('role.primary')}
                </td>
                <td className="v2-num-cell">
                  {person.support ? `${person.support} ${t('role.support')}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}

/**
 * The Team tab (S28): the takeaway, then Working now, Waiting, Not started, Cancelled last 24 hours and Closed last
 * 30 days with the monthly totals per person, in v1's order. The Shell's header carries the title.
 */
export function TeamView({ model }: TeamViewProps): ReactNode {
  const { words } = model;
  const line = model.takeaways['desk.team'];
  return (
    <>
      {line && <Takeaway data={line} />}
      <ListCard title={words.workingNow}>
        <WorkingNow model={model} />
      </ListCard>
      <ListCard title={words.waiting}>
        <Rows rows={model.waiting} empty={words.none} />
      </ListCard>
      <ListCard title={words.notStarted}>
        <Rows rows={model.notStarted} empty={words.none} />
      </ListCard>
      <ListCard title={words.cancelled}>
        <Window block={model.cancelled} />
      </ListCard>
      <ListCard title={words.closed}>
        <Window block={model.closed}>
          <Monthly model={model} />
        </Window>
      </ListCard>
    </>
  );
}
