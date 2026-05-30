import { ANALYSIS_MIN_GAP_MS, AUTO_ANALYSIS_MIN_GAP_MS } from '../realtime/realtimeConfig';

let lastAnalyzeAt = 0;
let lastAutoAnalyzeAt = 0;
let lastManualAnalyzeAt = 0;

export type AnalyzeTrigger = 'manual' | 'auto' | 'boot' | 'refresh';

export function canStartAnalysis(
  trigger: AnalyzeTrigger,
  now = Date.now()
): { ok: boolean; reason?: string } {
  console.log('[TRACE] canStartAnalysis called - trigger=', trigger, ' lastAnalyzeAt=', lastAnalyzeAt, ' now=', now, ' gap=', now - lastAnalyzeAt, ' ANALYSIS_MIN_GAP_MS=', ANALYSIS_MIN_GAP_MS);
  if (now - lastAnalyzeAt < ANALYSIS_MIN_GAP_MS) {
    console.log('[TRACE] canStartAnalysis BLOCKED by global-gap - gap=', now - lastAnalyzeAt, ' < ', ANALYSIS_MIN_GAP_MS);
    return { ok: false, reason: 'global-gap' };
  }
  if (trigger === 'manual' && now - lastManualAnalyzeAt < 1500) {
    console.log('[TRACE] canStartAnalysis BLOCKED by manual-debounce - gap=', now - lastManualAnalyzeAt, ' < 1500');
    return { ok: false, reason: 'manual-debounce' };
  }
  if (
    (trigger === 'auto' || trigger === 'refresh' || trigger === 'boot') &&
    now - lastAutoAnalyzeAt < AUTO_ANALYSIS_MIN_GAP_MS
  ) {
    console.log('[TRACE] canStartAnalysis BLOCKED by auto-gap - gap=', now - lastAutoAnalyzeAt, ' < ', AUTO_ANALYSIS_MIN_GAP_MS);
    return { ok: false, reason: 'auto-gap' };
  }
  console.log('[TRACE] canStartAnalysis ALLOWED');
  return { ok: true };
}

export function markAnalysisStarted(trigger: AnalyzeTrigger, now = Date.now()): void {
  console.log('[TRACE] markAnalysisStarted called - trigger=', trigger, ' now=', now);
  lastAnalyzeAt = now;
  if (trigger === 'manual') {
    lastManualAnalyzeAt = now;
  } else {
    lastAutoAnalyzeAt = now;
  }
}

export function resetAnalysisDebounce(): void {
  console.log('[TRACE] resetAnalysisDebounce called - resetting all timestamps');
  lastAnalyzeAt = 0;
  lastAutoAnalyzeAt = 0;
  lastManualAnalyzeAt = 0;
}
