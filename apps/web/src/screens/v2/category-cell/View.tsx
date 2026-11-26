import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { PageBody } from '../printed-page/PageBody.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/** The page the engine printed, in the v2 look: see `PageBody`. Past four figures, the rest fold under Show detail. */
export function CategoryCellView({
  model,
  nav,
  title,
}: {
  model: PrintedPageModel;
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
    />
  );
}
