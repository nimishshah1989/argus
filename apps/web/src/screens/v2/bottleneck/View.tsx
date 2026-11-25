/* eslint-disable i18next/no-literal-string -- the download's file name is not a visible word */
import { DownloadExcel } from '../../../ui/v2/download-excel.js';
import { FigureTile } from '../../../ui/v2/figure-tile.js';
import { Row } from '../../../ui/v2/row.js';
import type { NavItem } from '../../../ui/v2/shell.js';
import { ShowDetail } from '../../../ui/v2/show-detail.js';
import { Takeaway } from '../../../ui/v2/takeaway.js';
import { PageBody } from '../printed-page/PageBody.js';
import { sectionOf } from './adapter.js';
import type { BottleneckModel } from './model.js';
import { bottleneckSheets } from './sweep.js';

/**
 * The Bottleneck page the engine printed, in the v2 look, each table opening with its takeaway: see `PageBody`. Four
 * figures above the fold, the rest under Show detail, and the tables as one Excel file.
 */
export function BottleneckView({
  model,
  nav,
  title,
}: {
  model: BottleneckModel;
  nav: NavItem[];
  title: string;
}) {
  const folded = model.figures.slice(4);
  return (
    <PageBody
      model={{ ...model, figures: model.figures.slice(0, 4) }}
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
      after={
        <>
          {folded.length > 0 ? (
            <ShowDetail>
              <Row cols={4}>
                {folded.map((figure) => (
                  <FigureTile key={figure.id} figure={figure} />
                ))}
              </Row>
            </ShowDetail>
          ) : null}
          <div>
            <DownloadExcel file="bottleneck-forecast" sheets={bottleneckSheets(model)} />
          </div>
        </>
      }
    />
  );
}
