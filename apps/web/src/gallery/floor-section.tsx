/* eslint-disable i18next/no-literal-string -- sample machine codes and prop values only; every visible word goes through t() */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChoiceCard,
  GroupSection,
  GroupTile,
  MachineCard,
  MachineRow,
  QuickChip,
} from '../ui/floor-pieces.js';
import { LifeBuoy, OctagonX, Wrench } from '../ui/icon.js';
import { Checkbox, Select, Textarea } from '../ui/input.js';
import { Inline, Stack } from '../ui/layout.js';
import { StatusPill } from '../ui/status/status-pill.js';
import { Text } from '../ui/text.js';

const none = () => undefined;
const CHIPS = ['floor.chip1', 'floor.chip2', 'floor.chip3'];

function Rows() {
  const { t } = useTranslation('gallery');
  return (
    <>
      <MachineCard label={t('floor.machine')} code="VC-17" detail={t('floor.detail')} />
      <MachineRow
        code="VC-17"
        detail={t('floor.detail')}
        status={<StatusPill group="ticket" id="running" />}
        onClick={none}
      />
      <MachineRow
        code="TC-217"
        detail={t('floor.needsSupport')}
        status={<StatusPill group="ticket" id="support" />}
        onClick={none}
      />
      <GroupSection title="CNC" count={90}>
        <GroupTile code="VC" name={t('floor.groupName')} count={t('floor.count')} onClick={none} />
        <GroupTile code="TC" name={t('floor.groupName2')} count={t('floor.count')} onClick={none} />
      </GroupSection>
    </>
  );
}

function Choices() {
  const { t } = useTranslation('gallery');
  return (
    <>
      <ChoiceCard
        icon={Wrench}
        tone="neutral"
        title={t('floor.other')}
        detail={t('floor.otherDetail')}
        onClick={none}
      />
      <ChoiceCard
        icon={OctagonX}
        tone="danger"
        title={t('floor.stopped')}
        detail={t('floor.stoppedDetail')}
        onClick={none}
      />
      <ChoiceCard
        icon={LifeBuoy}
        tone="warning"
        title={t('floor.support')}
        detail={t('floor.supportDetail')}
        onClick={none}
      />
    </>
  );
}

/** Ticket 15's floor pieces: machine card and row, group tile, choice card, quick-problem chip, fields. */
export function FloorSection() {
  const { t } = useTranslation('gallery');
  const [chip, setChip] = useState('');
  return (
    <section data-testid="gallery-floor" aria-labelledby="gallery-floor-h">
      <Stack gap={3}>
        <h2 id="gallery-floor-h" className="text-title3 font-semibold">
          {t('section.floor')}
        </h2>
        <Rows />
        <Choices />
        <Inline gap={2}>
          {CHIPS.map((key) => (
            <QuickChip
              key={key}
              label={t(key)}
              pressed={chip === key}
              onClick={() => setChip(key)}
            />
          ))}
        </Inline>
        <Textarea aria-label={t('floor.problem')} placeholder={t('floor.problem')} />
        <Select aria-label={t('floor.select')}>
          <option>{t('floor.select')}</option>
        </Select>
        <Checkbox label={t('floor.startNow')} />
        <Text size="footnote" tone="secondary">
          {t('floor.reportingAs')}
        </Text>
      </Stack>
    </section>
  );
}
