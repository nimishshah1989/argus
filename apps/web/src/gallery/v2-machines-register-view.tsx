/* eslint-disable i18next/no-literal-string -- screen keys and catalogue keys, not copy */
import { registersModel } from '../screens/v2/machines-register/adapter.js';
import { RegistersView } from '../screens/v2/machines-register/View.js';
import { MachinesScreen } from './v2-machines-screen.js';

/** The v2 Machines register as a screen will run it, fed from the answer key's `registers` reply. */
export default function V2MachinesRegisterView() {
  return (
    <MachinesScreen
      screen="machines-register"
      title="v2m.title.register"
      build={(reply, t) => registersModel(reply, t)}
    >
      {(model, shell) => <RegistersView model={model} {...shell} />}
    </MachinesScreen>
  );
}
