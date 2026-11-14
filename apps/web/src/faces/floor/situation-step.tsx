import { useTranslation } from 'react-i18next';
import type { Machine } from '../../api.js';
import { Card } from '../../ui/card.js';
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

/** The card above Step 2: which machine this is (A1-4). */
export function SituationLead(p: { data: FloorData; machine: Machine; report: ReportState }) {
  const { t } = useTranslation();
  const support = p.report.supportTicket;
  return (
    <Stack gap={4}>
      <MachineCard
        label={t('reportFloor.machine')}
        code={p.machine.code}
        detail={machineDetail(p.data, p.machine)}
      />
      {support ? (
        <Card title={t('reportFloor.kindSupport')}>
          <Text>{t('reportFloor.supportTicket', { ref: support.ref })}</Text>
        </Card>
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
