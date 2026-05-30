import { mobileLog } from './mobileLogger';

let sentinel: WakeLockSentinel | null = null;
let refCount = 0;

async function requestScreenWakeLock(): Promise<void> {
  if (!('wakeLock' in navigator)) {
    mobileLog.debug('Screen Wake Lock API unavailable', 'WakeLock');
    return;
  }
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      mobileLog.debug('wake lock released by system', 'WakeLock');
      sentinel = null;
    });
    mobileLog.info('wake lock acquired', 'WakeLock');
  } catch (e) {
    mobileLog.warn('wake lock request failed', 'WakeLock', e);
  }
}

export const wakeLockManager = {
  async acquire(reason = 'analysis'): Promise<void> {
    refCount += 1;
    if (sentinel) return;
    await requestScreenWakeLock();
    mobileLog.debug(`acquire reason=${reason} refs=${refCount}`, 'WakeLock');
  },

  async release(): Promise<void> {
    refCount = Math.max(0, refCount - 1);
    if (refCount > 0) return;
    if (!sentinel) return;
    try {
      await sentinel.release();
      sentinel = null;
      mobileLog.info('wake lock released', 'WakeLock');
    } catch (e) {
      mobileLog.warn('wake lock release failed', 'WakeLock', e);
    }
  },

  /** Re-adquire após visibility (Android libera wake lock ao background). */
  async onVisible(): Promise<void> {
    if (refCount > 0 && !sentinel) {
      await requestScreenWakeLock();
    }
  },

  isActive(): boolean {
    return sentinel != null;
  },
};
