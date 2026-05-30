import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Device } from '@capacitor/device';
import { setRuntimeDetected, isNativeApp, markNativeReady, getRuntime } from './platform';
import { appStateManager } from './AppStateManager';
import { notificationEngine } from './NotificationEngine';
import { offlineCache } from './OfflineCache';
import { mobileInstitutionalSocket } from '../websocket/MobileInstitutionalSocket';
import { mobileLog } from './mobileLogger';
import { persistSignal } from '../../src/state/signalStore';
import { isValidInstitutionalPayload } from '../institutional/institutionalCommit';
import { resolveSnapshotId } from '../institutional/snapshotId';
import { wakeLockManager } from './WakeLockManager';

let booted = false;

export async function initMobilePlatform(): Promise<void> {
  if (booted || typeof window === 'undefined') return;
  booted = true;
  setRuntimeDetected();

  const runtime = getRuntime();
  mobileLog.info(`platform init runtime=${runtime}`, 'Mobile');

  if (Capacitor.isNativePlatform()) {
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#07090E' });
      await StatusBar.setOverlaysWebView({ overlay: true });
    } catch {
      /* web */
    }

    try {
      await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
    } catch {
      /* */
    }

    const info = await Device.getInfo();
    mobileLog.info(`device ${info.manufacturer} ${info.model} OS ${info.osVersion}`, 'Android');

    mobileInstitutionalSocket.retain();
    await appStateManager.start();
    await notificationEngine.requestPermissions();
    await wakeLockManager.acquire('session');

    document.documentElement.classList.add('lux-native', `lux-${Capacitor.getPlatform()}`);
  } else if (runtime === 'pwa') {
    document.documentElement.classList.add('lux-pwa');
    mobileLog.info('PWA standalone detected', 'PWA');
  }

  const hydrated = await offlineCache.hydrateOnStartup();
  if (hydrated.signal) {
    const snap = resolveSnapshotId(undefined, hydrated.signal.id);
    const payload = snap
      ? {
          symbol: hydrated.signal.asset,
          timeframe: hydrated.dashboard?.timeframe ?? '60',
          timestamp: new Date().toISOString(),
          snapshotId: snap,
          snapshotTimestamp: Date.now(),
          marketSequence: 0,
          signal: hydrated.signal,
          direction:
            hydrated.signal.type === 'BUY'
              ? ('BUY' as const)
              : hydrated.signal.type === 'SELL'
                ? ('SELL' as const)
                : ('NEUTRAL' as const),
          confidence: hydrated.signal.confidence ?? hydrated.signal.score,
          status: 'OK' as const,
        }
      : null;

    if (payload && isValidInstitutionalPayload(payload, hydrated.signal.asset)) {
      persistSignal(hydrated.signal);
      mobileLog.info('restored signal from offline cache', 'Mobile', { snap });
    } else {
      mobileLog.warn('offline signal rejected — stale or invalid snapshot', 'Mobile');
      await offlineCache.clearSignal();
    }
  }

  if (Capacitor.isNativePlatform()) {
    window.setTimeout(() => {
      void SplashScreen.hide({ fadeOutDuration: 400 });
    }, 400);
  }

  markNativeReady();
}

export async function luxHapticLight(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* */
  }
}

export function registerMobileTouchFeedback(): void {
  if (!isNativeApp()) return;
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('button, [role="button"], a')) {
        void luxHapticLight();
      }
    },
    { passive: true, capture: true }
  );
}
