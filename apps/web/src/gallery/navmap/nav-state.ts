import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isRole, sectionsFor, type RoleId, type Section } from './nav-data.js';

export const PERIODS = ['ytd', '2026', '2025', '2024', 'custom'] as const;
export type Period = (typeof PERIODS)[number];

export interface NavState {
  role: RoleId;
  sections: Section[];
  section: Section;
  screenId: string;
  period: Period;
  from: string;
  to: string;
  theme: 'light' | 'dark';
  set: (patch: Record<string, string>) => void;
  go: (sectionId: string, screenId: string) => void;
}

/** The preview's whole state lives in the address (role, place, period, theme), so a view can be linked. */
export function useNavState(): NavState {
  const [params, setParams] = useSearchParams();
  const set = useCallback(
    (patch: Record<string, string>) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          for (const [k, v] of Object.entries(patch)) next.set(k, v);
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );
  const go = useCallback((section: string, tab: string) => set({ section, tab }), [set]);
  return useMemo(() => {
    const raw = params.get('role');
    const role = isRole(raw) ? raw : 'head';
    const sections = sectionsFor(role);
    // A role that does not see the chosen section falls back to its first one: never a dead page.
    const section = sections.find((x) => x.id === params.get('section')) ?? sections[0]!;
    const screenId =
      section.screens.find((x) => x.id === params.get('tab'))?.id ?? section.screens[0]!.id;
    const p = params.get('period');
    const period = (PERIODS as readonly string[]).includes(p ?? '') ? (p as Period) : 'ytd';
    const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
    return {
      role,
      sections,
      section,
      screenId,
      period,
      from: params.get('from') ?? '',
      to: params.get('to') ?? '',
      theme,
      set,
      go,
    };
  }, [params, set, go]);
}
