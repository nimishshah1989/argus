import { createContext, useContext } from 'react';

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

/** Where a card goes when pressed: the rows behind its figure (the drawer), or the page that explains it (a link). */
export type Destination = { drill?: Drill; link?: { href: string; label: string } };

/**
 * The destinations map, as the kit reads it (ADR 0058): given a card's id and its label, where that card goes. The
 * screen's frame provides it (`screens/v2/destinations.ts`, scoped to the screen on show); with none around, as in a
 * test or the gallery, a card goes only where its own model says.
 */
export const DestinationContext = createContext<(id: string, label: string) => Destination>(
  () => ({}),
);

/** A card's own drill or link wins; only a card whose model named neither looks itself up in the map. */
export function useDestination(id: string, label: string, own: Destination): Destination {
  const lookUp = useContext(DestinationContext);
  return own.drill || own.link ? own : lookUp(id, label);
}

/** What the whole card is when pressed: a link to a page (it outranks rows when a model names both), the rows behind its figure, or nothing. */
export const stretchOf = (to: Destination) => (to.link ? 'link' : to.drill ? 'drill' : undefined);
