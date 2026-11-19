/* eslint-disable i18next/no-literal-string -- only prop names and ids remain; every visible string goes through t() */
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { SegmentedBar } from '../../ui/segmented-bar.js';
import { controlRoom } from './direction-control-room.js';
import { directionProps, type ScreenProps } from './direction-props.js';
import { instrument } from './direction-instrument.js';
import { ledger } from './direction-ledger.js';
import { addStrings } from './strings.js';
import './picker.css';

addStrings({
  title: 'Design directions',
  back: 'Back to the gallery',
  picker: 'Design directions',
  'name.instrument': 'Instrument',
  'name.control-room': 'Control Room',
  'name.ledger': 'Ledger',
  'idea.instrument': 'Refined light with layered depth. It finishes today’s world.',
  'idea.control-room': 'Dense, with signals standing out of a graphite ground. Ready for the TV.',
  'idea.ledger': 'Warm paper, ruled lines, figures set like a printed report.',
  screen: 'Screen',
  'screen.elements': 'Elements',
  'screen.today': 'Today',
  'screen.machine': 'Machine',
  'screen.breakdowns': 'Breakdowns',
  'screen.floor': 'Floor step',
  theme: 'Theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  language: 'Language',
  'language.en': 'English',
  'language.gu': 'Gujarati',
});

const DIRECTIONS = [
  { id: 'instrument', direction: instrument },
  { id: 'control-room', direction: controlRoom },
  { id: 'ledger', direction: ledger },
] as const;

type Screen = ComponentType<ScreenProps>;
const FOUND = import.meta.glob<{ default: Screen }>('./screen-*.tsx');
/** The screens that exist so far, in the picker's order; each packet adds its own file. */
const SCREENS = ['elements', 'today', 'machine', 'breakdowns', 'floor'].flatMap((id) => {
  const load = FOUND[`./screen-${id}.tsx`];
  return load ? [{ id, Body: lazy(load) }] : [];
});

/** Set the direction's properties on `<html>`; leaving, or switching, removes every one of them. */
function useInlineProperties(props: Record<string, string>): void {
  useLayoutEffect(() => {
    const style = document.documentElement.style;
    for (const [name, value] of Object.entries(props)) style.setProperty(name, value);
    return () => Object.keys(props).forEach((name) => style.removeProperty(name));
  }, [props]);
}

/** Keys 1 to 3 pick a direction and the arrows step through them, unless a field has the focus. */
function useDirectionKeys(index: number, go: (to: number) => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = DIRECTIONS.length;
      if (e.key >= '1' && e.key <= String(n)) go(Number(e.key) - 1);
      else if (e.key === 'ArrowRight') go((index + 1) % n);
      else if (e.key === 'ArrowLeft') go((index - 1 + n) % n);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, go]);
}

/** The floating pill of PICKER.md: harness chrome, never themed by the direction it flips. */
function Picker({ index, onPick }: { index: number; onPick: (to: number) => void }) {
  const { t } = useTranslation('directions');
  const nav = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    const move = () => {
      const item = nav.current?.querySelectorAll<HTMLElement>('.proto-picker-item')[index];
      const mark = nav.current?.querySelector<HTMLElement>('.proto-picker-highlight');
      if (!item || !mark) return;
      mark.style.width = `${item.offsetWidth}px`;
      mark.style.transform = `translateX(${item.offsetLeft}px)`;
    };
    move();
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
  }, [index]);
  // The slide starts after first paint, so loading the page does not animate it.
  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <nav
      ref={nav}
      className="proto-picker"
      aria-label={t('picker')}
      data-ready={ready ? '' : undefined}
    >
      <span className="proto-picker-highlight" aria-hidden="true" />
      {DIRECTIONS.map(({ id }, i) => (
        <button
          key={id}
          type="button"
          className="proto-picker-item"
          data-active={i === index ? '' : undefined}
          aria-current={i === index ? 'true' : undefined}
          aria-keyshortcuts={String(i + 1)}
          onClick={() => onPick(i)}
        >
          {t(`name.${id}`)}
        </button>
      ))}
    </nav>
  );
}

type Setter = (key: string, value: string) => void;

function Bar(p: { name: string; param: string; ids: string[]; selected: string; set: Setter }) {
  const { t } = useTranslation('directions');
  return (
    <div className="overflow-x-auto">
      <SegmentedBar
        label={t(p.name)}
        items={p.ids.map((id) => ({ id, label: t(`${p.name}.${id}`) }))}
        selected={p.selected}
        onSelect={(id) => p.set(p.param, id)}
      />
    </div>
  );
}

/** `/gallery?view=directions`: one stage, three directions, flipped by `?v=`; screen, theme and language ride along. */
export default function Directions() {
  const { t } = useTranslation('directions');
  const [params, setParams] = useSearchParams();
  const asked = Number(params.get('v'));
  const index = asked >= 1 && asked <= DIRECTIONS.length ? asked - 1 : 0;
  const current = DIRECTIONS[index]!;
  const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
  const lang = params.get('lang') === 'gu' ? 'gu' : 'en';
  const screen = SCREENS.find((s) => s.id === params.get('s')) ?? SCREENS[0];
  const set: Setter = (key, value) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set(key, value);
        return next;
      },
      { replace: true },
    );
  const go = (to: number) => set('v', String(to + 1));
  useInlineProperties(useMemo(() => directionProps(current.direction, theme), [current, theme]));
  useDirectionKeys(index, go);
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 pb-24">
      <h1 className="text-title2 font-semibold">{t('title')}</h1>
      <Link to="/gallery" className="min-h-target-min text-footnote text-accent-text underline">
        {t('back')}
      </Link>
      {screen && SCREENS.length > 1 ? (
        <Bar
          name="screen"
          param="s"
          ids={SCREENS.map((s) => s.id)}
          selected={screen.id}
          set={set}
        />
      ) : null}
      <Bar name="theme" param="theme" ids={['light', 'dark']} selected={theme} set={set} />
      <Bar name="language" param="lang" ids={['en', 'gu']} selected={lang} set={set} />
      <section
        key={`${current.id}-${theme}-${lang}`}
        data-testid="directions-stage"
        data-direction={current.id}
        aria-labelledby="directions-name"
        className="flex flex-col gap-4"
      >
        <h2 id="directions-name" className="text-title3 font-semibold">
          {t(`name.${current.id}`)}
        </h2>
        <p className="text-footnote text-neutral-600">{t(`idea.${current.id}`)}</p>
        <Suspense fallback={null}>
          {screen ? <screen.Body direction={current.direction} theme={theme} /> : null}
        </Suspense>
      </section>
      <Picker index={index} onPick={go} />
    </main>
  );
}
