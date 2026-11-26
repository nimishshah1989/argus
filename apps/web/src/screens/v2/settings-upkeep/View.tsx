import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getConfig } from '../../../api.js';
import { defineResource } from '../../../data/index.js';
import type { CrudRow, CrudSpec } from '../../../patterns/crud-spec.js';
import { CrudPage } from '../../../ui/v2/crud-page.js';
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import { ladderSpec } from './ladder-spec.js';
import { ladderSteps, pmTakeaway, registerTakeaway, rosterGaps } from './model.js';
import { pmPlansSpec } from './pm-plans-spec.js';
import { registersSpec } from './registers-spec.js';
import { RosterScreen, rosterSpec, todayIn } from './roster-spec.js';

/** A spec's rows, from the cache the kit `CrudPage` fills under the same key. */
function useRows<Row extends CrudRow>(spec: CrudSpec<Row>): Row[] {
  const list = defineResource<unknown, Row>(spec).useList();
  return list.data?.pages.flatMap((p) => p.items) ?? [];
}

/** A lookup list a takeaway names rows from, read under the key the page's own lookup uses. */
function useLookup<T>(spec: CrudSpec<never>, name: string): T[] {
  const source = spec.lookups![name]!;
  const q = useQuery({
    queryKey: [source.key, 'lookup'],
    queryFn: async () => (await defineResource<unknown, T>(source).list()).items,
  });
  return q.data ?? [];
}

/** The plant's own day once the config is in; takeaways wait for it. */
function useToday(): string | null {
  const config = useQuery({ queryKey: ['config'], queryFn: getConfig });
  return config.data ? todayIn(config.data.timeZone) : null;
}

/** "Sun 29-Nov" for a plant day. */
function dayLabel(day: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
      .formatToParts(new Date(`${day}T00:00:00Z`))
      .map((part) => [part.type, part.value]),
  );
  return `${p.weekday} ${p.day}-${p.month}`;
}

function Page({ lead, children }: { lead: TakeawayData | null; children: ReactNode }) {
  return (
    <>
      {lead ? <Takeaway data={lead} /> : null}
      {children}
    </>
  );
}

export function PmPlansView() {
  const { t } = useTranslation();
  const today = useToday();
  const plans = useRows(pmPlansSpec);
  const lead = today ? pmTakeaway(plans, today) : null;
  const data: TakeawayData | null =
    lead && lead.worst
      ? {
          text: t('pm.plans.takeaway.overdue', {
            count: lead.overdue,
            total: lead.total,
            days: lead.worst.daysLate,
          }),
          tone: 'loss',
          tag: t('status.pm.overdue'),
        }
      : lead?.next
        ? {
            text: t('pm.plans.takeaway.next', { date: lead.next.dueOn }),
            tone: 'neutral',
            tag: t('pm.menu.plans'),
          }
        : null;
  return (
    <Page lead={data}>
      <CrudPage spec={pmPlansSpec} />
    </Page>
  );
}

export function RegistersView() {
  const { t } = useTranslation();
  const today = useToday();
  const rows = useRows(registersSpec);
  const machines = useLookup<{ id: string; code: string }>(registersSpec as never, 'machines');
  const lead = today ? registerTakeaway(rows, today) : null;
  const name = (w: { machineId: string | null; kind: string }) => ({
    machine: machines.find((m) => m.id === w.machineId)?.code ?? t('plant.registers.noMachine'),
    kind: t(`plant.registers.kind.${w.kind}`),
  });
  const { soonest, next } = lead ?? {};
  const data: TakeawayData | null =
    soonest && lead
      ? {
          text: [
            soonest.days < 0
              ? t('plant.registers.takeaway.ended', { ...name(soonest), days: -soonest.days })
              : t('plant.registers.takeaway.ends', { ...name(soonest), days: soonest.days }),
            next && next.days >= 0
              ? t('plant.registers.takeaway.then', { ...name(next), days: next.days })
              : null,
          ]
            .filter(Boolean)
            .join(', '),
          tone: soonest.days < 0 ? 'loss' : soonest.days <= 30 ? 'risk' : 'neutral',
          tag: name(soonest).kind,
        }
      : null;
  return (
    <Page lead={data}>
      <CrudPage spec={registersSpec} />
    </Page>
  );
}

export function RosterView() {
  const { t } = useTranslation();
  const today = useToday();
  const entries = useRows(rosterSpec);
  const shifts = useLookup<{ id: string; name: string; active: boolean }>(
    rosterSpec as never,
    'shifts',
  );
  const found = today ? rosterGaps(entries, shifts as never, today) : null;
  const first = found?.gaps[0];
  const data: TakeawayData | null =
    found && found.slots > 0
      ? first
        ? {
            text: t('plant.roster.takeaway', {
              count: found.gaps.length,
              shift: shifts.find((s) => s.id === first.shiftId)?.name ?? '',
              day: dayLabel(first.date),
            }),
            tone: 'risk',
            tag: t('v2dc.status.gap'),
          }
        : { text: t('plant.roster.takeaway.full'), tone: 'gain', tag: t('plant.roster.title') }
      : null;
  return (
    <Page lead={data}>
      <RosterScreen />
    </Page>
  );
}

export function LadderView() {
  const { t } = useTranslation();
  const steps = ladderSteps(useRows(ladderSpec));
  const data: TakeawayData | null = steps.length
    ? {
        text: t('plant.ladder.takeaway', {
          steps: steps
            .map((s) =>
              t('plant.ladder.takeaway.step', { level: s.level, minutes: s.delayMinutes }),
            )
            .join(', '),
        }),
        tone: 'neutral',
        tag: t('plant.ladder.title'),
      }
    : null;
  return (
    <Page lead={data}>
      <CrudPage spec={ladderSpec} />
    </Page>
  );
}
