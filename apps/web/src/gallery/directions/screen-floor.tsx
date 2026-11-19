/* eslint-disable i18next/no-literal-string -- only class names, ids and the sample's machine codes remain; every word goes through t() */
import { useTranslation } from 'react-i18next';
import { ChoiceCard, GroupSection, GroupTile, QuickChip } from '../../ui/floor-pieces.js';
import { CirclePlus, List, Wrench } from '../../ui/icon.js';
import { Input, Label } from '../../ui/input.js';
import { DISPLAY_STYLE } from './direction-props.js';
import { groupKey, RECENT, SEGMENTS } from './floor-sample.js';

/** The direction's corners and depth on the kit's tap cards; the layout is untouched. */
const SHAPED =
  '[&_button]:[border-radius:var(--proto-radius-tile)] [&_button]:[box-shadow:var(--proto-shadow-raised)]';
const none = (): void => undefined;

function Header() {
  const { t } = useTranslation();
  return (
    <header className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-surface px-4 py-2">
      <p className="text-title3 font-bold">{t('floor.title')}</p>
      <p className="text-caption text-neutral-600">{t('kit.wizard.step', { n: 1, total: 3 })}</p>
    </header>
  );
}

/** The two floor tabs, drawn but not linked: a tap here must not leave the preview. */
function Tabs() {
  const { t } = useTranslation();
  const tab = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-caption font-semibold';
  return (
    <div className="flex border-t border-neutral-200 bg-surface">
      <span className={`${tab} text-accent-text`}>
        <CirclePlus aria-hidden size={22} />
        {t('nav.report')}
      </span>
      <span className={`${tab} text-neutral-600`}>
        <List aria-hidden size={22} />
        {t('floor.complaints')}
      </span>
    </div>
  );
}

function Groups() {
  const { t } = useTranslation();
  const { t: d } = useTranslation('directions');
  const count = (n: number) =>
    n === 1 ? t('reportFloor.oneMachine') : t('reportFloor.machines', { count: n });
  return (
    <div data-part="groups" className={`flex flex-col gap-4 ${SHAPED}`}>
      {SEGMENTS.map(({ id, groups }) => (
        <GroupSection
          key={id}
          title={d(`floor.segment.${id}`)}
          count={groups.reduce((n, g) => n + g.machines, 0)}
        >
          {groups.map((g) => (
            <GroupTile
              key={g.code}
              code={g.code}
              name={d(groupKey(g.code))}
              count={count(g.machines)}
              onClick={none}
            />
          ))}
        </GroupSection>
      ))}
    </div>
  );
}

/** Step 1 of the real floor (A1-1) in the direction's colours, corners and type; positions are v3's and the lock's. */
export default function ScreenFloor() {
  const { t } = useTranslation();
  const { t: d } = useTranslation('directions');
  return (
    <div data-screen="floor" className="flex flex-col gap-3">
      <p data-caption className="text-footnote text-neutral-600">
        {d('floor.caption')}
      </p>
      <div
        data-floor-frame
        className="mx-auto w-full max-w-sm overflow-hidden border border-neutral-200 bg-neutral-100"
      >
        <Header />
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-title2 font-bold" style={DISPLAY_STYLE}>
              {t('floor.whichMachine')}
            </h3>
            <p className="text-neutral-600">{t('reportFloor.hint')}</p>
          </div>
          <div data-part="search" className="flex flex-col gap-2">
            <Label htmlFor="floor-find">{t('reportFloor.find')}</Label>
            <Input id="floor-find" type="search" placeholder={t('reportFloor.findPlaceholder')} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-footnote font-bold text-neutral-600">{t('reportFloor.recent')}</p>
            {RECENT.map((code) => (
              <QuickChip key={code} label={code} onClick={none} />
            ))}
          </div>
          <div data-part="other" className={SHAPED}>
            <ChoiceCard
              icon={Wrench}
              tone="neutral"
              title={t('reportFloor.other')}
              detail={t('reportFloor.otherDetail')}
              onClick={none}
            />
          </div>
          <Groups />
        </div>
        <Tabs />
      </div>
    </div>
  );
}
