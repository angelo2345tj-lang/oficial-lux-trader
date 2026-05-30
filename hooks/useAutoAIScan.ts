import { useCallback, useEffect, useRef } from 'react';

const MIN_INTERVAL_MS = 20_000;
const DEFAULT_INTERVAL_MS = 28_000;

export function useAutoAIScan(options: {
  enabled: boolean;
  onScan: () => void | Promise<void>;
  isAnalyzing: boolean;
  intervalMs?: number;
}) {
  const { enabled, onScan, isAnalyzing, intervalMs = DEFAULT_INTERVAL_MS } = options;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const analyzingRef = useRef(isAnalyzing);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    analyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const runScan = useCallback(async () => {
    if (busyRef.current || analyzingRef.current) return;
    busyRef.current = true;
    try {
      await onScanRef.current();
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!enabled) return;

    const safeMs = Math.max(MIN_INTERVAL_MS, intervalMs);
    const t = window.setTimeout(() => void runScan(), 1200);
    timerRef.current = setInterval(() => {
      void runScan();
    }, safeMs);

    return () => {
      window.clearTimeout(t);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, intervalMs, runScan]);

  return { triggerNow: runScan };
}
