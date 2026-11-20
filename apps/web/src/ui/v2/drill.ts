import { createContext } from 'react';

/**
 * A figure that can open the rows it counted. A screen's model puts one on a KPI card, a Pareto bar or a bullet bar,
 * and the part turns it into a control. `figure` is the engine's figure key: it is all the address bar carries
 * (`?drawer=figure:<key>`), and the data seam turns it into rows. `label` is what that control is called aloud, in
 * the reader's language ("Show the rows behind Total downtime").
 */
export type Drill = { figure: string; label: string };

/**
 * What pressing a figure's control does. The screen's shell provides it (it opens the rows in the drawer); with no
 * shell around, as in a test, the control does nothing.
 */
export const DrillOpenContext = createContext<(drill: Drill) => void>(() => {});
