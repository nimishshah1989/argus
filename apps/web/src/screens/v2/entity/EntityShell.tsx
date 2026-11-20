import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import type { MessageKey } from '@uptimo/shared/i18n';
import { useTranslation } from 'react-i18next';
import type { DrawerSpec } from '../../../ui/v2/drawer.js';
import { EntityOpenContext, type EntityRef } from '../../../ui/v2/entity-chip.js';
import { ScreenStates, type Loaded } from '../../../ui/v2/screen-states.js';
import { RowsBehind, type RowsBehindModel } from '../../../ui/v2/domain/rows-behind.js';
import { DrillOpenContext } from '../../../ui/v2/drill.js';
import { Shell } from '../../../ui/v2/shell.js';
import { useScreenModel, type Provider } from '../data.js';
import { EntityDetail } from './Detail.js';
import { entityHref } from './href.js';
import type { EntityModel } from './model.js';
import { rowsWords } from '../rows-behind/words.js';
import { useEntityParam, useFigureParam } from './url.js';

/** What a screen that holds an entity live gives the drawer instead of the port's version of it. */
export type LocalEntity = Pick<DrawerSpec, 'label' | 'content'>;
export type EntityShellProps = Omit<ComponentProps<typeof Shell>, 'drawer'> & {
  /** A screen's own version of an entity it holds live (a decision with its Decide button); null falls through to the port. */
  local?: (ref: EntityRef) => LocalEntity | null;
  /** Where the rows behind a figure come from; the app's own (the engine's drill) when left out. A preview or a test may pass its own. */
  rows?: Provider<'rows-behind'>;
};

/** What a route puts above every screen inside it (the section's other screens): a screen draws it without knowing. */
export const ChromeContext = createContext<ReactNode>(null);

/** Asked for while the drawer is closed or a screen holds the entity itself: nothing is fetched, so it never answers. */
const NOT_ASKED: Provider<'entity'> = () => new Promise(() => {});
const NONE: EntityRef = { kind: 'machine', id: '' };
const NO_FIGURE = { figure: '' };
const NOT_ASKED_ROWS: Provider<'rows-behind'> = () => new Promise(() => {});
const same = (a: EntityRef | null, b: EntityRef) => a?.kind === b.kind && a.id === b.id;

/**
 * The model for what the URL asks for. A result for a thing no longer asked for (the reader moved to another before
 * it arrived) is not shown: the drawer says "loading" until the right one is here.
 */
function useEntity(asked: EntityRef | null, fetch: boolean): Loaded<EntityModel> {
  // The params change when a screen stops holding the entity, so that starts the load a never-answering provider skipped.
  const params = asked && fetch ? asked : NONE;
  const loaded = useScreenModel('entity', params, asked && fetch ? undefined : NOT_ASKED);
  const m = loaded.model;
  const current = loaded.state === 'ready' && m && asked && same(asked, { kind: m.kind, id: m.id });
  return current || loaded.state !== 'ready'
    ? loaded
    : { ...loaded, state: 'loading', model: undefined };
}

function useEntityDrawer(
  asked: EntityRef | null,
  close: () => void,
  local: EntityShellProps['local'],
): DrawerSpec | null {
  const { t } = useTranslation();
  const here = asked && local ? local(asked) : null;
  const loaded = useEntity(asked, !here);
  if (!asked) return null;
  const common = {
    id: `${asked.kind}:${asked.id}`,
    onClose: close,
    fullPage: { href: entityHref(asked), label: t('ashell.entity.fullPage') },
  };
  if (here) return { ...common, ...here };
  return {
    ...common,
    label: loaded.model?.label ?? t('common.loading'),
    content: (
      <ScreenStates loaded={loaded} emptyText={t('ashell.entity.notFound')}>
        {(model) => <EntityDetail model={model} />}
      </ScreenStates>
    ),
  };
}

/**
 * The drawer for the rows behind the figure the URL names (`?drawer=figure:<key>`): the figure's name while they load,
 * then the figure, its value and what it counted, the rows, and where they came from.
 */
function useRowsDrawer(
  figure: string | null,
  close: () => void,
  given: Provider<'rows-behind'> | undefined,
): DrawerSpec | null {
  const { t } = useTranslation();
  const loaded = useScreenModel(
    'rows-behind',
    figure ? { figure } : NO_FIGURE,
    figure ? given : NOT_ASKED_ROWS,
  );
  if (!figure) return null;
  const current: Loaded<RowsBehindModel> =
    loaded.state === 'ready' && loaded.model?.figure !== figure
      ? { ...loaded, state: 'loading', model: undefined }
      : loaded;
  return {
    id: `figure:${figure}`,
    label: current.model?.label ?? t('common.loading'),
    onClose: close,
    content: (
      <RowsBehind
        loaded={current}
        words={rowsWords((key, values) => t(key as MessageKey, { ...values })).table}
      />
    ),
  };
}

/**
 * The v2 shell for every screen: the kit's `Shell` with the entity drawer wired to the URL (`?drawer=kind:id`). A
 * chip, row or square anywhere inside opens its thing through `EntityOpenContext`; pressing the open one again
 * closes it. The drawer's content comes from the screen's own `local`, else from the `entity` port. A figure's
 * control opens the rows behind it (`?drawer=figure:<key>`) through `DrillOpenContext`, and a machine pressed in
 * those rows opens on top of them, so Back returns to the rows.
 */
export function EntityShell({ local, rows, children, ...shell }: EntityShellProps) {
  const { current, open, close } = useEntityParam();
  const figure = useFigureParam();
  const entityDrawer = useEntityDrawer(current, close, local);
  const rowsDrawer = useRowsDrawer(figure.current, figure.close, rows);
  const chrome = useContext(ChromeContext);
  const press = (ref: EntityRef) => (same(current, ref) ? close() : open(ref));
  const drill = (d: { figure: string }) =>
    figure.current === d.figure ? figure.close() : figure.open(d.figure);
  return (
    <DrillOpenContext.Provider value={drill}>
      <EntityOpenContext.Provider value={press}>
        <Shell {...shell} drawer={rowsDrawer ?? entityDrawer}>
          {chrome}
          {children}
        </Shell>
      </EntityOpenContext.Provider>
    </DrillOpenContext.Provider>
  );
}
