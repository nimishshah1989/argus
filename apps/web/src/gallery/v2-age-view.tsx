/* eslint-disable i18next/no-literal-string -- screen keys and catalogue keys, not copy */
import { ageModel } from '../screens/v2/age/adapter.js';
import { AgeView } from '../screens/v2/age/View.js';
import { MachinesScreen } from './v2-machines-screen.js';

/** The v2 Age analysis as a screen will run it, fed from the answer key's `a8-age` reply. */
export default function V2AgeView() {
  return (
    <MachinesScreen screen="age" title="v2m.title.age" build={(reply, t) => ageModel(reply, t)}>
      {(model, shell) => <AgeView model={model} {...shell} />}
    </MachinesScreen>
  );
}
