import type { ScreenEntry } from '../data.js';
import type { MachinePageModel } from './model.js';

declare module '../data.js' {
  interface Screens {
    /** One machine's own page, by its id or code; nothing when the engine has no page for it. */
    machine: { params: { id: string }; model: MachinePageModel };
  }
}

export const screen: ScreenEntry<'machine'> = {
  key: 'machine',
  provider: async ({ id }, { client }) => {
    const [live, { machinePageModel }, { refuseUnlessAnalytics }] = await Promise.all([
      import('../figures/live.js'),
      import('./adapter.js'),
      import('../figures/refuse.js'),
    ]);
    const [role, reply, config] = await Promise.all([
      live.liveRole(client),
      live.liveReply(client),
      live.liveConfig(client),
    ]);
    refuseUnlessAnalytics(role);
    const machine = config.machines.find((m) => m.id === id || m.code === id);
    // The tasks are an extra: a read that fails says so in its own block, never takes the page with it.
    const tickets = await live.liveMachineTickets(client, machine?.id ?? id).catch(() => null);
    return machinePageModel(
      reply,
      { param: id, machines: config.machines, tickets, timeZone: config.timeZone },
      live.catalogue,
    );
  },
};
