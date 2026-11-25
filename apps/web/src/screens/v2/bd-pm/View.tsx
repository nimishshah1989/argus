import { Takeaway } from '../../../ui/v2/takeaway.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { PageBody } from '../printed-page/PageBody.js';
import { sectionOf } from './adapter.js';
import type { BdPmModel } from './model.js';

/**
 * The page the engine printed, in the v2 look: see `PageBody`. Each table opens with its kit line (ticket 658), found by
 * the table's title; the figures and the tables are drawn as printed.
 */
export function BdPmView({
  model,
  nav,
  title,
}: {
  model: BdPmModel;
  nav: NavItem[];
  title: string;
}) {
  return (
    <PageBody
      model={model}
      nav={nav}
      title={title}
      around={(table, drawn) => {
        const id = sectionOf(table.title);
        const takeaway = id === undefined ? null : (model.takeaways?.[id] ?? null);
        return takeaway ? (
          <>
            <Takeaway data={takeaway} />
            {drawn}
          </>
        ) : (
          drawn
        );
      }}
    />
  );
}
