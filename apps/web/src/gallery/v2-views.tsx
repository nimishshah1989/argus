import { lazy, Suspense, type ComponentType } from 'react';

type Loader = () => Promise<{ default: ComponentType }>;

/** `./v2-team-focus-view.tsx` is the gallery view `v2-team-focus`; any other file name is not a view. */
const VIEW_FILE = /^\.\/(v2-[a-z0-9-]+)-view\.tsx$/;

/** One lazy view per file found, each its own chunk, so a v2 screen adds its view without editing the gallery. */
export function viewsFrom(
  loaders: Record<string, Loader>,
): Record<string, () => React.JSX.Element> {
  const views: Record<string, () => React.JSX.Element> = {};
  for (const [path, load] of Object.entries(loaders)) {
    const name = VIEW_FILE.exec(path)?.[1];
    if (!name) continue;
    const View = lazy(load);
    views[name] = () => (
      <Suspense fallback={null}>
        <View />
      </Suspense>
    );
  }
  return views;
}

/** The v2 screens' views, found in `gallery/v2-<name>-view.tsx`: `?view=v2-<name>`. */
export const V2_VIEWS = viewsFrom(import.meta.glob<{ default: ComponentType }>('./v2-*-view.tsx'));
