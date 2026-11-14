import { useTranslation } from 'react-i18next';
import { QuickChip } from '../../ui/floor-pieces.js';
import { Input, Label, Select, Textarea } from '../../ui/input.js';
import { Inline, Stack } from '../../ui/layout.js';
import { Text } from '../../ui/text.js';
import type { FloorData } from './use-floor.js';

export type Form = {
  place: string;
  typed: string;
  workType: string;
  needed: string;
  urgent: boolean;
};
export const EMPTY: Form = { place: '', typed: '', workType: '', needed: '', urgent: false };

function Urgency({ urgent, set }: { urgent: boolean; set: (patch: Partial<Form>) => void }) {
  const { t } = useTranslation();
  const form = { urgent };
  return (
    <Stack gap={2}>
      <Text size="footnote" weight="bold">
        {t('reportFloor.urgency')}
      </Text>
      <Inline gap={2}>
        <QuickChip
          label={t('reportFloor.normal')}
          pressed={!form.urgent}
          onClick={() => set({ urgent: false })}
        />
        <QuickChip
          label={t('reportFloor.urgent')}
          pressed={form.urgent}
          onClick={() => set({ urgent: true })}
        />
      </Inline>
    </Stack>
  );
}

export function Fields(p: { data: FloorData; form: Form; set: (patch: Partial<Form>) => void }) {
  const { t } = useTranslation();
  const { form, set } = p;
  const places = [...new Set(p.data.config.machines.map((m) => m.cell).filter(Boolean))];
  const types = (p.data.config.lists.work_type ?? []).filter((item) => item.active);
  return (
    <Stack gap={4}>
      <Text tone="secondary">{t('reportFloor.otherIntro')}</Text>
      <Stack gap={2}>
        <Label htmlFor="other-place">{t('floor.where')}</Label>
        <Select
          id="other-place"
          value={form.place}
          onChange={(e) => set({ place: e.target.value })}
        >
          <option value="">{t('reportFloor.selectPlace')}</option>
          {places.map((place) => (
            <option key={place}>{place}</option>
          ))}
        </Select>
        <Input
          aria-label={t('reportFloor.typePlace')}
          placeholder={t('reportFloor.typePlace')}
          value={form.typed}
          onChange={(e) => set({ typed: e.target.value })}
        />
      </Stack>
      <Stack gap={2}>
        <Label htmlFor="other-type">{t('reportFloor.workType')}</Label>
        <Select
          id="other-type"
          value={form.workType}
          onChange={(e) => set({ workType: e.target.value })}
        >
          <option value="">{t('reportFloor.selectWork')}</option>
          {types.map((item) => (
            <option key={item.id}>{item.label}</option>
          ))}
        </Select>
      </Stack>
      <Stack gap={2}>
        <Label htmlFor="other-needed">{t('reportFloor.needed')}</Label>
        <Textarea
          id="other-needed"
          placeholder={t('reportFloor.neededPlaceholder')}
          value={form.needed}
          onChange={(e) => set({ needed: e.target.value })}
        />
      </Stack>
      <Urgency urgent={form.urgent} set={set} />
    </Stack>
  );
}
