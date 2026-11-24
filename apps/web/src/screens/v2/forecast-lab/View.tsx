import type { NavItem } from '../../../ui/v2/shell.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { PageBody } from '../printed-page/PageBody.js';
import { sectionOf } from './adapter.js';
import type { ForecastLabModel } from './model.js';

/** The Forecast Lab page the engine printed, in the v2 look: see `PageBody`; each table opens with its takeaway. */
export function ForecastLabView({
  model,
  nav,
  title,
}: {
  model: ForecastLabModel;
  nav: NavItem[];
  title: string;
}) {
  return (
    <PageBody
      model={model}
      nav={nav}
      title={title}
      around={(table, drawn) => {
        const takeaway = model.takeaways?.[sectionOf(table.title)];
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
