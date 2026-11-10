import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import './style.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchInterval: 30_000 },
  },
});

if (import.meta.env.PROD) {
  // Precache the app shell (AC5a); no offline write queue yet (AC5b).
  navigator.serviceWorker.register('/sw.js').catch(() => undefined);
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
