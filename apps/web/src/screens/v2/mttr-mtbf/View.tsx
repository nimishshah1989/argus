import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import { PageBody } from '../printed-page/PageBody.js';
import type { PrintedPageModel } from '../printed-page/page-model.js';

/** The page the engine printed, in the v2 look: see `PageBody`. Four figures above the fold, the rest under Show detail. */
export function MttrMtbfView({
  model,
  nav,
  title,
}: {
  model: PrintedPageModel;
  nav: NavItem[];
  title: string;
}) {
  const folded = model.figures.slice(4);
  return (
    <PageBody
      model={{ ...model, figures: model.figures.slice(0, 4) }}
      nav={nav}
      title={title}
      fold={
        folded.length > 0 ? (
          <ShowDetail>
            <Row cols={4}>
              {folded.map((figure) => (
                <FigureTile key={figure.id} figure={figure} />
              ))}
            </Row>
          </ShowDetail>
        ) : undefined
      }
    />
  );
}
