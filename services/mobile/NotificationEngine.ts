import { LocalNotifications } from '@capacitor/local-notifications';
import { TradeSignal, SignalType } from '../../types';
import { mobileLog } from './mobileLogger';
import { isNativeApp } from './platform';

export type LuxNotificationType =
  | 'BUY'
  | 'SELL'
  | 'REVERSAL'
  | 'BREAKOUT'
  | 'WS_DISCONNECTED'
  | 'WS_RECONNECTED'
  | 'VOLATILITY';

const CHANNEL_ID = 'lux_signals';
const GROUP_ID = 'lux_trader_alerts';

let channelsReady = false;
let idSeq = 1000;

function nextId(): number {
  idSeq += 1;
  return idSeq;
}

async function ensureChannels(): Promise<void> {
  if (!isNativeApp() || channelsReady) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Sinais Lux Trader FX',
      description: 'Alertas institucionais de trading',
      importance: 5,
      visibility: 1,
      sound: 'lux_alert.wav',
      vibration: true,
      lights: true,
      lightColor: '#3b82f6',
    });
    await LocalNotifications.createChannel({
      id: 'lux_system',
      name: 'Sistema',
      description: 'Conexão e status do terminal',
      importance: 4,
      visibility: 1,
      vibration: false,
    });
    channelsReady = true;
    mobileLog.info('notification channels ready', 'Notifications');
  } catch (e) {
    mobileLog.warn('channel setup skipped', 'Notifications', e);
  }
}

async function showNative(
  type: LuxNotificationType,
  title: string,
  body: string,
  extra?: Record<string, unknown>
): Promise<void> {
  await ensureChannels();
  const channelId = type.startsWith('WS_') ? 'lux_system' : CHANNEL_ID;

  if (isNativeApp()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: nextId(),
            title,
            body,
            channelId,
            group: GROUP_ID,
            groupSummary: false,
            sound: type.startsWith('WS_') ? undefined : 'lux_alert.wav',
            smallIcon: 'ic_stat_lux',
            iconColor: '#3b82f6',
            extra: { type, ...extra },
          },
        ],
      });
      return;
    } catch (e) {
      mobileLog.warn('local notification failed', 'Notifications', e);
    }
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/icons/icon-192x192.png',
      tag: `lux-${type}`,
    });
  }
}

export const notificationEngine = {
  async requestPermissions(): Promise<boolean> {
    if (isNativeApp()) {
      const { display } = await LocalNotifications.requestPermissions();
      return display === 'granted';
    }
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const r = await Notification.requestPermission();
    return r === 'granted';
  },

  async notifyBuySignal(signal: TradeSignal): Promise<void> {
    await showNative(
      'BUY',
      '🟢 SINAL BUY',
      `${signal.asset} · Score ${Math.round(signal.score ?? 0)}%`,
      { asset: signal.asset }
    );
  },

  async notifySellSignal(signal: TradeSignal): Promise<void> {
    await showNative(
      'SELL',
      '🔴 SINAL SELL',
      `${signal.asset} · Score ${Math.round(signal.score ?? 0)}%`,
      { asset: signal.asset }
    );
  },

  async notifyReversalAlert(asset: string, direction: string): Promise<void> {
    await showNative('REVERSAL', '⚡ Reversão detectada', `${asset} · ${direction}`);
  },

  async notifyBreakoutAlert(asset: string): Promise<void> {
    await showNative('BREAKOUT', '📈 Breakout', `${asset} · estrutura rompida`);
  },

  async notifyVolatilityAlert(asset: string, level: string): Promise<void> {
    await showNative('VOLATILITY', '🌊 Volatilidade', `${asset} · ${level}`);
  },

  async notifyWebsocketDisconnected(): Promise<void> {
    await showNative('WS_DISCONNECTED', 'Conexão pausada', 'Reconectando em segundo plano…');
  },

  async notifyReconnectSuccess(): Promise<void> {
    await showNative('WS_RECONNECTED', 'Mercado ao vivo', 'WebSocket restaurado');
  },

  async notifyFromSignal(signal: TradeSignal): Promise<void> {
    if (signal.type === SignalType.BUY) return this.notifyBuySignal(signal);
    if (signal.type === SignalType.SELL) return this.notifySellSignal(signal);
  },
};
