/* eslint-disable i18next/no-literal-string -- screen keys and catalogue keys, not copy */
import { footprintModel } from '../screens/v2/footprint/adapter.js';
import { FootprintView } from '../screens/v2/footprint/View.js';
import { MachinesScreen } from './v2-machines-screen.js';

/** The v2 Footprint as a screen will run it, fed from the answer key's `a7-footprint` reply. */
export default function V2FootprintView() {
  return (
    <MachinesScreen
      screen="footprint"
      title="v2m.title.footprint"
      build={(reply, t) => footprintModel(reply, t)}
    >
      {(model, shell) => <FootprintView model={model} {...shell} />}
    </MachinesScreen>
  );
}
