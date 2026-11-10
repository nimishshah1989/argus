import type { Figures as TicketFigures, RaiseKind } from '../api.js';
import { formatMinutes } from './format.js';

interface Props {
  figures: TicketFigures | null;
  kind: RaiseKind;
  names: Record<string, string>;
}

export function Figures({ figures, kind, names }: Props) {
  if (!figures) return null;
  const downtime = kind === 'stopped' ? (figures.downtimeMin ?? figures.downAccMin) : null;
  const stats = [
    { label: 'Response', value: formatMinutes(figures.responseMin) },
    { label: 'Hands-on', value: formatMinutes(figures.activeMin) },
    { label: 'Waiting', value: formatMinutes(figures.waitMin) },
    ...(figures.vendorMin > 0
      ? [{ label: 'Vendor wait', value: formatMinutes(figures.vendorMin) }]
      : []),
    ...(figures.handoverWaitMin > 0
      ? [{ label: 'Handover wait', value: formatMinutes(figures.handoverWaitMin) }]
      : []),
    ...(downtime === null ? [] : [{ label: 'Downtime', value: formatMinutes(downtime) }]),
    ...(figures.followMin === null
      ? []
      : [{ label: 'Follow-up', value: formatMinutes(figures.followMin) }]),
    { label: 'Repair', value: formatMinutes(figures.repairMin) },
  ];
  const people = Object.entries(figures.perPerson).sort(([, a], [, b]) => b - a);

  return (
    <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="text-sm font-medium text-neutral-600">Figures</h2>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-xs text-neutral-500">{stat.label}</dt>
            <dd className="mt-0.5 text-base font-semibold">{stat.value}</dd>
          </div>
        ))}
      </dl>
      {people.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-medium text-neutral-500">Per person</h3>
          <ul className="mt-2 space-y-1">
            {people.map(([personId, minutes]) => (
              <li key={personId} className="flex justify-between gap-3 text-base">
                <span>{names[personId] ?? 'Team member'}</span>
                <span className="text-neutral-600">{formatMinutes(minutes)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
