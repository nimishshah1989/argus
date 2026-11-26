import { DownloadExcel } from '../../../ui/v2/download-excel.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { PageBody } from '../printed-page/PageBody.js';
import { sectionOf } from './adapter.js';
import type { ForecastLabModel } from './model.js';
import { labSheets } from './sweep.js';

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
      model={{ ...model, figures: model.figures.slice(0, 4) }}
      nav={nav}
      title={title}
      after={
        <>
          {model.figures.length > 4 ? (
            <ShowDetail>
              <Row cols={4}>
                {model.figures.slice(4).map((figure) => (
                  <FigureTile key={figure.id} figure={figure} />
                ))}
              </Row>
            </ShowDetail>
          ) : null}
          <div>
            {/* eslint-disable-next-line i18next/no-literal-string -- a file name, not copy */}
            <DownloadExcel file="forecast-lab" sheets={labSheets(model)} />
          </div>
        </>
      }
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
