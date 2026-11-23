import { panned, zoomed, type View } from './bubble-math.js';

/**
 * What the plot keeps: the zoomed window (null while the whole picture is in view, so it follows the data when a
 * refresh changes the extent) and the key of what is plotted (the filters), which starts the picture again when it changes.
 */
export type PlotState = { view: View | null; key: string };

export type PlotAction =
  | { type: 'zoom'; factor: number; full: View; at?: { x: number; y: number } }
  | { type: 'pan'; dx: number; dy: number; full: View }
  | { type: 'reset' }
  | { type: 'key'; key: string };

export function plotReducer(state: PlotState, action: PlotAction): PlotState {
  switch (action.type) {
    case 'zoom':
      return {
        ...state,
        view: zoomed(state.view ?? action.full, action.full, action.factor, action.at),
      };
    case 'pan':
      return {
        ...state,
        view: panned(state.view ?? action.full, action.full, action.dx, action.dy),
      };
    case 'reset':
      return { ...state, view: null };
    case 'key':
      return action.key === state.key ? state : { view: null, key: action.key };
  }
}
