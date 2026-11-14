import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { worthRetrying } from './data/index.js';
import { applyConfigLanguage } from './i18n/index.js';
import { replayOutbox } from './offline/replay.js';
import './style.css';

const queryClient = new QueryClient({
  defaultOptions: {
    // `always` so mutations/reads still run when offline: the outbox must enqueue an offline
    // close and cached reads must still render (TanStack Query's default 'online' gate would
    // pause the mutation before it ever reaches command()).
    queries: {
      staleTime: 30_000,
      refetchInterval: 30_000,
      networkMode: 'always',
      // Two more tries for a dropped connection or a server fault; a refusal (401, 403, 404) never passes.
      retry: (count, error) => count < 2 && worthRetrying(error),
    },
    mutations: { networkMode: 'always' },
  },
});

if (import.meta.env.PROD) {
  // Precache the app shell (AC5a); the write outbox is app-level (AC5b), not the worker.
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

/** The steps that finish signing in; nothing replays until they are done (review of PR 225). */
const SIGN_IN_STEPS = ['/login', '/who', '/password'];

/** Replay queued offline commands, then refresh whatever the screens are showing. */
function replayAndRefresh(): void {
  if (SIGN_IN_STEPS.includes(window.location.pathname)) return;
  void replayOutbox().then(
    (summary) => {
      if (summary.replayed > 0) void queryClient.invalidateQueries();
    },
    () => undefined,
  );
}

void replayAndRefresh();
window.addEventListener('online', replayAndRefresh);
applyConfigLanguage();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
