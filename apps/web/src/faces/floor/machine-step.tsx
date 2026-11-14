import { useTranslation } from 'react-i18next';
import type { Group, Machine } from '../../api.js';
import { Input, Label } from '../../ui/input.js';
import { Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import { FloorMachineRow } from './machine-row.js';
import { Browse } from './browse.js';
import { groupExample, groupMachines, searchMachines } from './machines.js';
import type { FloorData } from './use-floor.js';

export interface MachineStepProps {
  data: FloorData;
  query: string;
  onQuery: (query: string) => void;
  group: Group | null;
  onGroup: (group: Group) => void;
  onPick: (machine: Machine) => void;
  onOther: () => void;
}

function Rows(p: { data: FloorData; machines: Machine[]; onPick: (m: Machine) => void }) {
  return (
    <Stack gap={2}>
      {p.machines.map((m) => (
        <FloorMachineRow key={m.id} data={p.data} machine={m} onPick={() => p.onPick(m)} />
      ))}
    </Stack>
  );
}

/** Inside a group: type only the number (A1-3). */
function InGroup(p: MachineStepProps & { group: Group }) {
  const { t } = useTranslation();
  const members = groupMachines(p.data.config.machines, p.group, p.query);
  const example = groupExample(groupMachines(p.data.config.machines, p.group, ''), p.group);
  return (
    <Stack gap={3}>
      <Stack gap={2}>
        <Label htmlFor="floor-machine-id">{t('reportFloor.machineId')}</Label>
        <Input
          id="floor-machine-id"
          value={p.query}
          placeholder={t('reportFloor.groupPlaceholder', example)}
          onChange={(e) => p.onQuery(e.target.value)}
        />
        <Text size="footnote" tone="secondary">
          {t('reportFloor.groupHint', example)}
        </Text>
      </Stack>
      <Rows data={p.data} machines={members} onPick={p.onPick} />
    </Stack>
  );
}

/** Step 1 of 3: search, recent machines, Other work, the groups (A1-1, A1-2). */
export function MachineStep(p: MachineStepProps) {
  const { t } = useTranslation();
  if (p.group) return <InGroup {...p} group={p.group} />;
  const found = searchMachines(p.data.config.machines, p.query);
  return (
    <Stack gap={3}>
      <Text tone="secondary">{t('reportFloor.hint')}</Text>
      <Stack gap={2}>
        <Label htmlFor="floor-find">{t('reportFloor.find')}</Label>
        <Input
          id="floor-find"
          type="search"
          value={p.query}
          placeholder={t('reportFloor.findPlaceholder')}
          onChange={(e) => p.onQuery(e.target.value)}
        />
      </Stack>
      {!p.query.trim() ? <Browse {...p} /> : null}
      {p.query.trim() && found.length === 0 ? (
        <Text tone="secondary">{t('reportFloor.noMatch', { q: p.query })}</Text>
      ) : null}
      <Rows data={p.data} machines={found} onPick={p.onPick} />
    </Stack>
  );
}
