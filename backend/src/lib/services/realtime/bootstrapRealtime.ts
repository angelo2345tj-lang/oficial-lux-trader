import { realtimeOrchestrator } from './InstitutionalRealtimeOrchestrator';

export { realtimeOrchestrator };
export const institutionalRealtimeOrchestrator = realtimeOrchestrator;

let bootPromise: Promise<void> | null = null;

/** Bootstrap global — 1x antes do React montar. */
export function bootstrapRealtime(): Promise<void> {
  if (!bootPromise) {
    bootPromise = realtimeOrchestrator.initialize();
  }
  return bootPromise;
}
