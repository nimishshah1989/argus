import { useTranslation } from 'react-i18next';
import { pendingTasksOn } from '@uptimo/shared/tasks';
import type { Machine } from '../../api.js';
import { Banner } from '../../ui/banner.js';
import { ChoiceCard, MachineCard } from '../../ui/floor-pieces.js';
import { LifeBuoy, OctagonX } from '../../ui/icon.js';
import { Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import type { ReportState } from './report-state.js';
import type { FloorData } from './use-floor.js';

export function machineDetail(data: FloorData, machine: Machine): string {
  const group = data.config.groups.find((g) => g.id === machine.group_id);
  return [group?.name ?? machine.category, machine.cell].filter(Boolean).join(' · ');
}

/** The card above Step 2: which machine this is (A1-4), and the tasks it already carries (v3.reporting.05). */
export function SituationLead(p: { data: FloorData; machine: Machine; report: ReportState }) {
  const { t } = useTranslation();
  const support = p.report.supportTicket;
  const labels: Record<string, string> = {};
  for (const item of p.data.config.lists.task_reason ?? []) labels[item.code] = item.label;
  const pending = pendingTasksOn(p.data.openAll, p.machine.id);
  return (
    <Stack gap={4}>
      <MachineCard
        label={t('reportFloor.machine')}
        code={p.machine.code}
        detail={machineDetail(p.data, p.machine)}
      />
      {support ? (
        <Banner tone="attention" title={t('reportFloor.kindSupport')}>
          {t('reportFloor.supportTicket', { ref: support.ref })}
        </Banner>
      ) : null}
      {pending.length > 0 ? (
        <Banner tone="attention" title={t('tasks.warningTitle')}>
          <Stack gap={1}>
            {pending.map((task) => {
              const reason = task.taskReason ? (labels[task.taskReason] ?? task.taskReason) : '—';
              return (
                <Text key={task.id} size="footnote">
                  {t(task.taskExpectedOn ? 'tasks.warningBody' : 'tasks.warningBodyNoDate', {
                    ref: task.ref,
                    reason,
                    date: task.taskExpectedOn ?? '',
                  })}
                </Text>
              );
            })}
          </Stack>
        </Banner>
      ) : null}
    </Stack>
  );
}

/** Step 2 of 3: stopped or running with support; on a support ticket, upgrade or open it (A3-6). */
export function SituationStep({ report, next }: { report: ReportState; next: () => void }) {
  const { t } = useTranslation();
  const support = report.supportTicket;
  const ref = support?.ref ?? '';
  const stopped = () => {
    report.setKind('stopped');
    next();
  };
  const needsSupport = () => {
    if (support) return report.setSheet(support);
    report.setKind('support');
    next();
  };
  return (
    <Stack gap={3}>
      <ChoiceCard
        icon={OctagonX}
        tone="danger"
        title={t('reportFloor.stopped')}
        detail={t(support ? 'reportFloor.upgradeDetail' : 'reportFloor.stoppedDetail', { ref })}
        onClick={stopped}
      />
      <ChoiceCard
        icon={LifeBuoy}
        tone="warning"
        title={t(support ? 'reportFloor.stillSupport' : 'reportFloor.support')}
        detail={t(support ? 'reportFloor.stillSupportDetail' : 'reportFloor.supportDetail', {
          ref,
        })}
        onClick={needsSupport}
      />
    </Stack>
  );
}
