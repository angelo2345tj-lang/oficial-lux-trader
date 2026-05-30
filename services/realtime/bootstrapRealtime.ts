import { realtimeOrchestrator } from './InstitutionalRealtimeOrchestrator';

export { realtimeOrchestrator };
export const institutionalRealtimeOrchestrator = realtimeOrchestrator;

let bootPromise: Promise<void> | null = null;

declare global {
  interface Window {
    __luxRealtimeInitialized?: boolean;
    __luxRealtimeRunning?: boolean;
  }
}

/** Bootstrap global — 1x antes do React montar. */
export function bootstrapRealtime(): Promise<void> {
  if (!bootPromise) {
    bootPromise = realtimeOrchestrator.initialize().then(() => {
      if (typeof window !== 'undefined') {
        window.__luxRealtimeInitialized = true;
      }
    });
  }
  return bootPromise;
}

/** Cleanup PWA/mobile — único teardown do pipeline realtime. */
export function destroyRealtime(): void {
  realtimeOrchestrator.destroy();
  bootPromise = null;
  if (typeof window !== 'undefined') {
    window.__luxRealtimeInitialized = false;
    window.__luxRealtimeRunning = false;
  }
}
