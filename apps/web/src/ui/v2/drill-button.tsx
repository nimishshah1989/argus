import { useContext } from 'react';
import { Button } from './button.js';
import { DrillOpenContext, type Drill } from './drill.js';

/** The control that opens the rows behind a figure drawn as a table or a chart; its name is the drill's label. */
export function DrillButton({ drill }: { drill: Drill }) {
  const open = useContext(DrillOpenContext);
  return <Button onClick={() => open(drill)}>{drill.label}</Button>;
}
