import { useEffect, useState } from 'react';
import type { Shift } from './api.js';

/** People are handing over around a shift's start and end; an update prompt waits this long either side. */
const CHANGEOVER_MIN = 15;
const DAY_MIN = 1440;

function minuteOfDay(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

/** The plant's clock, in minutes since its midnight (the plant's time zone, not the phone's). */
function plantMinute(now: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(now);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part('hour') * 60 + part('minute');
}

/** True within 15 minutes of any shift start or end, wrapping past midnight. */
export function inChangeover(now: Date, shifts: Shift[], timeZone?: string): boolean {
  const minute = plantMinute(now, timeZone);
  return shifts
    .flatMap((shift) => [shift.starts_at, shift.ends_at])
    .some((edge) => {
      const gap = Math.abs(minute - minuteOfDay(edge));
      return Math.min(gap, DAY_MIN - gap) <= CHANGEOVER_MIN;
    });
}

/** Asks the waiting worker to take over; the page reloads when it does (`controllerchange`). */
export function applyUpdate(registration: ServiceWorkerRegistration): void {
  registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * The registration whose new version is installed and waiting, if any. A first install has no
 * controller and activates by itself, so only an update to a running app counts.
 */
export function useWaitingUpdate(): ServiceWorkerRegistration | null {
  const [waiting, setWaiting] = useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    let reloading = false;
    const reload = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const watch = (registration: ServiceWorkerRegistration) => {
      const check = () => {
        if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration);
      };
      check();
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', check);
      });
    };
    void navigator.serviceWorker.getRegistration().then((registration) => {
      if (registration) watch(registration);
    });
    navigator.serviceWorker.addEventListener('controllerchange', reload);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', reload);
  }, []);
  return waiting;
}
