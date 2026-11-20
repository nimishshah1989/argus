import type { NavItem } from '../../../ui/v2/shell.js';
import { PageBody } from '../printed-page/PageBody.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/** The Bottleneck page the engine printed, in the v2 look: see `PageBody`. */
export function BottleneckView({
  model,
  nav,
  title,
}: {
  model: PrintedPageModel;
  nav: NavItem[];
  title: string;
}) {
  return <PageBody model={model} nav={nav} title={title} />;
}
