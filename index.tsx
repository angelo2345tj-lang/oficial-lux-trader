import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';

const App = lazy(() => import('./App'));
import { ExecutionProvider } from './context/ExecutionContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { registerServiceWorker } from './src/registerSW';
import { bootstrapRealtime } from './services/realtime/bootstrapRealtime';
import { initMobilePlatform, registerMobileTouchFeedback } from './services/mobile';

async function boot() {
  await bootstrapRealtime();
  registerServiceWorker();
  await initMobilePlatform();
  registerMobileTouchFeedback();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Could not find root element to mount to');
  }

  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <ErrorBoundary>
      <ExecutionProvider>
        <Suspense
          fallback={
            <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 text-sm">
              Lux Trader FX…
            </div>
          }
        >
          <App />
        </Suspense>
      </ExecutionProvider>
    </ErrorBoundary>
  );
}

void boot();
