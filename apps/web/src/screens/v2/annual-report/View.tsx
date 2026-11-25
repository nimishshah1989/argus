import type { NavItem } from '../../../ui/v2/shell.js';
import type { AnnualReportModel } from './model.js';

/**
 * The Annual Report as drawn in wireframe S24 (#765): the lede, the period and the two downloads; the months as bars in
 * calendar order with the partial month starred and the worst month marked; the fifteen costliest machines as five bars
 * and a tail with the running share of the year; then every engine table worst first under its takeaway, with age and
 * PM as bars, the machines added as a cell strip, and each table whole under "Show the numbers". Every section sits in
 * an element with `data-section` set to its id: `months-chart`, `machines-chart`, the ids in `SECTIONS`, `commentary`.
 */
export function AnnualReportView(_props: {
  model: AnnualReportModel;
  nav: NavItem[];
  title: string;
}): never {
  throw new Error('not built: #765');
}
