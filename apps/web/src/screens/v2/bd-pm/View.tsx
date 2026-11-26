import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
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
      model={{ ...model, figures: model.figures.slice(0, 4) }}
      nav={nav}
      title={title}
      after={
        model.figures.length > 4 ? (
          <ShowDetail>
            <Row cols={2}>
              {model.figures.slice(4).map((f) => (
                <FigureTile key={f.id} figure={f} />
              ))}
            </Row>
          </ShowDetail>
        ) : undefined
      }
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
