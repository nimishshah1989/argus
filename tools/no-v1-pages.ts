/**
 * Guard (ADR 0051, "nothing of old should remain"): every page the app routes to is a v2 screen.
 *
 * `v1PageErrors(root)` reads `<root>/apps/web/src/App.tsx`, resolves the component of each `<Route … element={<X …/>}>`
 * to the file its import names (`./x.js` → `x.tsx` or `x.ts`), and returns one error per route whose component file is
 * outside `apps/web/src/screens/v2/`. A `<Navigate …/>` element and the `/gallery` route are allowed. It also returns one
 * error per file under `apps/web/src/screens/v2/` that imports a `.tsx` file from `screens/analytics`, `screens/desk`,
 * `screens/settings`, `screens/*.tsx` or `faces/` (a v1 component); `.ts` logic files there are allowed.
 * Each error names the route path or the importing file, and the v1 file, relative to `root`. No errors: `[]`.
 */
export function v1PageErrors(root: string): string[] {
  void root;
  throw new Error('not implemented');
}
