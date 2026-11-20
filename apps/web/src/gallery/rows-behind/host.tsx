import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useScreenModel, type Provider } from '../../screens/v2/data.js';
import { EntityDetail } from '../../screens/v2/entity/Detail.js';
import { entityHref } from '../../screens/v2/entity/href.js';
import { useEntityParam } from '../../screens/v2/entity/url.js';
import type { DrawerSpec } from '../../ui/v2/drawer.js';
import {
  RowsBehind,
  type RowsBehindModel,
  type RowsBehindWords,
} from '../../ui/v2/domain/rows-behind.js';
import { DrillOpenContext } from '../../ui/v2/drill.js';
import { EntityOpenContext, type EntityRef } from '../../ui/v2/entity-chip.js';
import { ScreenStates, type Loaded, type LoadState } from '../../ui/v2/screen-states.js';
import { Shell, type NavItem } from '../../ui/v2/shell.js';
import { figureLabels } from './words.js';
import { useFigureParam } from './url.js';

type Load = (figure: string) => Promise<RowsBehindModel | null>;

/** The rows of the figure the URL asks for; a figure no longer asked for is dropped, and a new one starts loading. */
function useRows(figure: string | null, load: Load): Loaded<RowsBehindModel> {
  const [result, setResult] = useState<{ state: LoadState; model?: RowsBehindModel }>({
    state: 'loading',
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (figure === null) return;
    let live = true;
    setResult({ state: 'loading' });
    load(figure).then(
      (model) => live && setResult(model ? { state: 'ready', model } : { state: 'empty' }),
      () => live && setResult({ state: 'error' }),
    );
    return () => {
      live = false;
    };
  }, [figure, load, attempt]);
  return { ...result, retry: () => setAttempt((n) => n + 1) };
}

const NOT_ASKED: Provider<'entity'> = () => new Promise(() => {});
const NONE: EntityRef = { kind: 'machine', id: '' };

/** The drawer for a machine, cell, person or decision a chip in the rows opens: the same one every screen has. */
function useEntityDrawer(asked: EntityRef | null, close: () => void): DrawerSpec | null {
  const { t } = useTranslation();
  const loaded = useScreenModel('entity', asked ?? NONE, asked ? undefined : NOT_ASKED);
  if (!asked) return null;
  return {
    id: `${asked.kind}:${asked.id}`,
    label: loaded.model?.label ?? t('common.loading'),
    onClose: close,
    fullPage: { href: entityHref(asked), label: t('ashell.entity.fullPage') },
    content: (
      <ScreenStates loaded={loaded} emptyText={t('ashell.entity.notFound')}>
        {(model) => <EntityDetail model={model} />}
      </ScreenStates>
    ),
  };
}

/**
 * The shell a screen runs in once the rows-behind panel is wired into `EntityShell`: the drawer shows the rows behind
 * the figure `?drawer=figure:<key>` names, a figure's control opens it, and a chip in the rows opens that machine's
 * drawer on top, so Back returns to the rows. Until then the gallery hosts it here, outside `screens/v2`.
 */
export function RowsBehindHost({
  nav,
  title,
  words,
  load,
  children,
}: {
  nav: NavItem[];
  title: string;
  words: RowsBehindWords;
  load: Load;
  children: ReactNode;
}) {
  const figure = useFigureParam();
  const entity = useEntityParam();
  const rows = useRows(figure.current, load);
  const entityDrawer = useEntityDrawer(entity.current, entity.close);
  const { t } = useTranslation();
  const drawer: DrawerSpec | null = figure.current
    ? {
        id: `figure:${figure.current}`,
        label: figureLabels[figure.current] ?? t('common.loading'),
        onClose: figure.close,
        content: <RowsBehind loaded={rows} words={words} />,
      }
    : entityDrawer;
  const pressEntity = (ref: EntityRef) =>
    entity.current?.kind === ref.kind && entity.current.id === ref.id
      ? entity.close()
      : entity.open(ref);
  return (
    <DrillOpenContext.Provider
      value={(d) => (figure.current === d.figure ? figure.close() : figure.open(d.figure))}
    >
      <EntityOpenContext.Provider value={pressEntity}>
        <Shell nav={nav} title={title} drawer={drawer}>
          {children}
        </Shell>
      </EntityOpenContext.Provider>
    </DrillOpenContext.Provider>
  );
}
