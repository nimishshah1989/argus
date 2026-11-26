/* eslint-disable i18next/no-literal-string -- query keys and typed unions only; every visible word goes through t() */
import { useTranslation } from 'react-i18next';
import type { GroupReply, MachineReply, ShiftReply } from '@uptimo/shared/plant-settings';
import { defineResource } from '../../../data/index.js';
import type { CrudRow, CrudSpec } from '../../../patterns/crud-spec.js';
import { CrudPage } from '../../../ui/v2/crud-page.js';
import { Takeaway, type TakeawayData } from '../../../ui/v2/takeaway.js';
import { analyticsProfileSpec } from '../../settings/analytics-profile-spec.js';
import { groupsSpec, machinesSpec, shiftsSpec } from './plant-specs.js';
import { groupsTakeaway, machinesTakeaway, shiftsTakeaway } from './model.js';

/** The rows of a list the page itself reads: the same cached query, whole (`nextCursor` is null). */
function useRows<Row extends CrudRow>(spec: CrudSpec<Row>): Row[] {
  const list = defineResource<unknown, Row>(spec).useList();
  return list.data?.pages.flatMap((p) => p.items) ?? [];
}

function Page<Row extends CrudRow>({
  spec,
  lead,
}: {
  spec: CrudSpec<Row>;
  lead: TakeawayData | null;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h2>{t(spec.titleKey)}</h2>
      {lead ? <Takeaway data={lead} /> : null}
      <CrudPage spec={spec} />
    </>
  );
}

export function MachinesView() {
  const { t } = useTranslation();
  const lead = machinesTakeaway(useRows<MachineReply>(machinesSpec));
  return (
    <Page
      spec={machinesSpec}
      lead={
        lead && {
          text: t('plant.machines.takeaway', lead),
          tone: lead.unset > 0 ? 'risk' : 'neutral',
          tag: t('plant.machines.title'),
        }
      }
    />
  );
}

export function GroupsView() {
  const { t } = useTranslation();
  const groups = useRows<GroupReply>(groupsSpec);
  const lead = groupsTakeaway(groups, useRows<MachineReply>(machinesSpec));
  const name = groups.find((g) => g.id === lead?.groupId)?.name ?? '';
  return (
    <Page
      spec={groupsSpec}
      lead={
        lead && {
          text: t(lead.hidden ? 'plant.groups.takeawayHidden' : 'plant.groups.takeaway', {
            name,
            n: lead.n,
            total: lead.total,
          }),
          tone: lead.hidden ? 'risk' : 'neutral',
          tag: t('plant.groups.title'),
        }
      }
    />
  );
}

export function ShiftsView() {
  const { t } = useTranslation();
  const profile = useRows<{ id: string; active: boolean; prodHrsPerDay?: unknown }>(
    analyticsProfileSpec as never,
  )[0]?.prodHrsPerDay;
  const production = typeof profile === 'number' ? profile : null;
  const lead = shiftsTakeaway(useRows<ShiftReply>(shiftsSpec), production);
  return (
    <Page
      spec={shiftsSpec}
      lead={
        lead && {
          text: t(
            lead.productionHours === null ? 'plant.shifts.takeawayOnly' : 'plant.shifts.takeaway',
            {
              count: lead.count,
              hours: lead.totalHours,
              production: lead.productionHours,
            },
          ),
          tone: 'neutral',
          tag: t('plant.shifts.title'),
        }
      }
    />
  );
}
