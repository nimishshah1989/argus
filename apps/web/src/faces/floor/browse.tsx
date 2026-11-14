import { useTranslation } from 'react-i18next';
import type { Machine } from '../../api.js';
import { ChoiceCard, GroupSection, GroupTile, QuickChip } from '../../ui/floor-pieces.js';
import { Wrench } from '../../ui/icon.js';
import { Inline, Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import type { MachineStepProps } from './machine-step.js';
import { sections } from './machines.js';
import { readRecent } from './use-floor.js';

/** Step 1 before typing: recent machines, Other work, the segments and their group tiles (A1-1). */
export function Browse(p: MachineStepProps) {
  const { t } = useTranslation();
  const { machines } = p.data.config;
  const recent = readRecent()
    .map((id) => machines.find((m) => m.id === id))
    .filter((m): m is Machine => Boolean(m))
    .slice(0, 3);
  const count = (n: number) =>
    n === 1 ? t('reportFloor.oneMachine') : t('reportFloor.machines', { count: n });
  return (
    <Stack gap={4}>
      {recent.length > 0 ? (
        <Inline gap={2}>
          <Text size="footnote" tone="secondary" weight="bold">
            {t('reportFloor.recent')}
          </Text>
          {recent.map((m) => (
            <QuickChip key={m.id} label={m.code} onClick={() => p.onPick(m)} />
          ))}
        </Inline>
      ) : null}
      <ChoiceCard
        icon={Wrench}
        tone="neutral"
        title={t('reportFloor.other')}
        detail={t('reportFloor.otherDetail')}
        onClick={p.onOther}
      />
      {sections(p.data.config).map((s) => (
        <GroupSection key={s.segment.id} title={s.segment.name} count={s.count}>
          {s.groups.map(({ group, count: n }) => (
            <GroupTile
              key={group.id}
              code={group.code}
              name={group.name}
              count={count(n)}
              onClick={() => p.onGroup(group)}
            />
          ))}
        </GroupSection>
      ))}
    </Stack>
  );
}
