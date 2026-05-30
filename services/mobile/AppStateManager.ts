import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { realtimeOrchestrator } from '../realtime/InstitutionalRealtimeOrchestrator';
import { wakeLockManager } from './WakeLockManager';
import { offlineCache } from './OfflineCache';
import { mobileLog } from './mobileLogger';
import { isNativeApp } from './platform';

let started = false;

export const appStateManager = {
  async start(): Promise<void> {
    if (started || !isNativeApp()) return;
    started = true;

    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        realtimeOrchestrator.enterForeground();
        void wakeLockManager.acquire('foreground');
      } else {
        realtimeOrchestrator.enterBackground();
        void wakeLockManager.release();
        mobileLog.info('app backgrounded', 'Background');
      }
    });

    App.addListener('pause', () => {
      realtimeOrchestrator.enterBackground();
    });

    App.addListener('resume', () => {
      realtimeOrchestrator.enterForeground();
      void wakeLockManager.onVisible();
    });

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          realtimeOrchestrator.enterForeground();
          void wakeLockManager.onVisible();
        }
      });
    }

    Network.addListener('networkStatusChange', (status) => {
      mobileLog.info(`network ${status.connected ? 'online' : 'offline'}`, 'Mobile', status);
      if (status.connected) {
        realtimeOrchestrator.enterForeground();
      }
    });

    const net = await Network.getStatus();
    mobileLog.info(`initial network connected=${net.connected}`, 'Mobile');
  },

  async syncOfflineOnResume(): Promise<void> {
    const hydrated = await offlineCache.hydrateOnStartup();
    return void hydrated;
  },
};
