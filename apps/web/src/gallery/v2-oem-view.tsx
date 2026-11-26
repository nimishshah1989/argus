/* eslint-disable i18next/no-literal-string -- screen keys and catalogue keys, not copy */
import { oemModel } from '../screens/v2/oem/adapter.js';
import { OemView } from '../screens/v2/oem/View.js';
import { MachinesScreen } from './v2-machines-screen.js';

/** The v2 OEM analytics as a screen will run it, fed from the platform's own OEM page (the engine does not compute it yet). Money shows to a head, plant head or admin: `&role=op` hides it. */
export default function V2OemView() {
  return (
    <MachinesScreen
      screen="oem"
      title="v2m.title.oem"
      build={(reply, t) => oemModel(reply, t, { mayDecide: false })}
    >
      {(model, shell) => <OemView model={model} {...shell} />}
    </MachinesScreen>
  );
}
