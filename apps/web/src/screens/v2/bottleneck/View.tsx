import type { NavItem } from '../../../ui/v2/shell.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { PageBody } from '../printed-page/PageBody.js';
import { sectionOf } from './adapter.js';
import type { BottleneckModel } from './model.js';

/** The Bottleneck page the engine printed, in the v2 look, each table opening with its takeaway: see `PageBody`. */
export function BottleneckView({
  model,
  nav,
  title,
}: {
  model: BottleneckModel;
  nav: NavItem[];
  title: string;
}) {
  return (
    <PageBody
      model={model}
      nav={nav}
      title={title}
      around={(table, drawn) => {
        const line = model.takeaways?.[sectionOf(table.title, table.header[0]?.label) ?? ''];
        return line ? (
          <>
            <Takeaway data={line} />
            {drawn}
          </>
        ) : (
          drawn
        );
      }}
    />
  );
}
